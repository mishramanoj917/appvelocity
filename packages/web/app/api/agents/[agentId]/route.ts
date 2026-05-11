import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { agentRegistry } from '@/lib/agent-registry';
import { jobStore } from '@/lib/job-store';
import { saveProject } from '@/lib/project-store';

const LaunchSchema = z.object({
  action: z.string(),
  params: z.record(z.string(), z.any()),
  options: z
    .object({
      dryRun: z.boolean().optional(),
      verbose: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/agents/[agentId]
 * Launches an agent job and returns a jobId for polling / streaming.
 *
 * Accepts either:
 *   application/json   — standard JSON body (existing behaviour)
 *   multipart/form-data — when a plugin ZIP is uploaded alongside params
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;

  // Apply per-request API key overrides from custom headers (set via the UI settings modal).
  // Acceptable for a single-instance demo — falls back to process.env when headers absent.
  const anthropicKey = request.headers.get('x-anthropic-key');
  const openaiKey    = request.headers.get('x-openai-key');
  const llmUrl       = request.headers.get('x-llm-url');
  if (anthropicKey) process.env['ANTHROPIC_API_KEY'] = anthropicKey;
  if (openaiKey)    process.env['OPENAI_API_KEY']    = openaiKey;
  if (llmUrl)       process.env['LLM_API_URL']       = llmUrl;

  // Check the agent exists and is available
  const agentEntry = agentRegistry.get(agentId);
  if (!agentEntry) {
    return NextResponse.json(
      { error: `Agent '${agentId}' not found.` },
      { status: 404 }
    );
  }

  if (agentEntry.status !== 'active') {
    return NextResponse.json(
      {
        error: `Agent '${agentId}' is not yet available (status: ${agentEntry.status}).`,
        plannedCapabilities: agentEntry.plannedCapabilities,
      },
      { status: 503 }
    );
  }

  // ── Parse body (JSON or multipart) ──────────────────────────────────────────
  const contentType = request.headers.get('content-type') ?? '';
  let launchParams: Record<string, unknown> = {};
  let pluginExport: Record<string, unknown> | undefined;

  if (contentType.startsWith('multipart/form-data')) {
    const formData = await request.formData();
    launchParams = {
      figmaUrl:         formData.get('figmaUrl') as string ?? '',
      targetFramework:  formData.get('targetFramework') as string ?? 'react-native',
      generationMode:   formData.get('generationMode') as string ?? 'project',
      stateManagement:  formData.get('stateManagement') as string ?? 'none',
    };

    const pluginZip = formData.get('pluginZip') as File | null;
    if (pluginZip) {
      pluginExport = await extractPluginZip(pluginZip);
      // Auto-construct figmaUrl from plugin ZIP's embedded fileKey when user left URL blank
      if (!launchParams['figmaUrl'] && pluginExport.fileKey) {
        launchParams['figmaUrl'] = `https://www.figma.com/file/${pluginExport.fileKey}/`;
      }
    }
  } else {
    const body = await request.json().catch(() => null);
    const parsed = LaunchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    launchParams = parsed.data.params as Record<string, unknown>;
  }

  // Create a job and start execution asynchronously
  const jobId     = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  jobStore.create(jobId, agentId);

  const agentParams = pluginExport
    ? { ...launchParams, pluginExport }
    : launchParams;

  // Fire-and-forget: execution tracked via job store
  agentEntry.instance!
    .execute({
      action: 'generate',
      params: agentParams,
      context: {
        sessionId,
        projectId: request.headers.get('x-project-id') ?? undefined,
        onStep: (step: string) => jobStore.pushStep(jobId, step),
      },
    })
    .then((result) => {
      jobStore.complete(jobId, result);
      void saveProject(jobId, result as unknown as Record<string, unknown>, agentParams['figmaUrl'] as string | undefined)
        .catch((e: unknown) => console.warn('[project-store] save failed:', e));
    })
    .catch((err: Error) => jobStore.fail(jobId, err.message));

  return NextResponse.json(
    {
      jobId,
      agentId,
      status: 'running',
      streamUrl: `/api/agents/stream/${jobId}`,
      statusUrl: `/api/agents/status/${jobId}`,
    },
    { status: 202 }
  );
}

// ─── Plugin ZIP extraction ────────────────────────────────────────────────────

interface PluginJsonExport {
  fileKey?: string;
  renderedBounds?: Record<string, { x: number; y: number; width: number; height: number }>;
  variantProperties?: Record<string, Record<string, string>>;
  assetFileNames?: string[];
}

async function extractPluginZip(
  file: File
): Promise<Record<string, unknown> & { fileKey?: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const zip = new AdmZip(buffer);

  // Extract figma-export.json
  const jsonEntry = zip.getEntry('figma-export.json');
  if (!jsonEntry) {
    throw new Error('Plugin ZIP missing figma-export.json');
  }
  const exportJson = JSON.parse(jsonEntry.getData().toString('utf8')) as PluginJsonExport;

  // Write asset files (PNG + SVG) to a temp directory
  const tempDir = join(tmpdir(), `appv-plugin-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const assetPaths: Record<string, string> = {};
  const assetEntries = zip.getEntries().filter((e) => e.entryName.startsWith('assets/') && !e.isDirectory);

  for (const entry of assetEntries) {
    const fileName = entry.entryName.replace('assets/', '');
    const localPath = join(tempDir, fileName);
    writeFileSync(localPath, entry.getData());
    // Strip .png or .svg extension, then convert _ back to : for nodeId
    const nodeId = fileName.replace(/\.(png|svg)$/, '').replace(/_/g, ':');
    assetPaths[nodeId] = localPath;
  }

  return {
    fileKey:           exportJson.fileKey,
    renderedBounds:    exportJson.renderedBounds    ?? {},
    variantProperties: exportJson.variantProperties ?? {},
    assetPaths,
  };
}

/**
 * GET /api/agents/[agentId]
 * Returns agent metadata and capabilities.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const agentEntry = agentRegistry.get(params.agentId);
  if (!agentEntry) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: params.agentId,
    name: agentEntry.name,
    version: agentEntry.version,
    status: agentEntry.status,
    description: agentEntry.description,
    capabilities: agentEntry.capabilities,
  });
}
