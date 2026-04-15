/**
 * Node 2 — GenerationPlannerAgent
 *
 * Analyses the Figma file structure and produces an ExecutionPlan that tells
 * downstream nodes which screens and components to generate, in what order.
 *
 * Input state:  figmaUrl, targetFramework, figmaFile (optional — enriches prompt)
 * Output state: executionPlan, currentStep, logs
 */

import { parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import { parseJsonResponse } from '../utils/parse-json.js';
import type { WorkflowState, ExecutionPlan } from '../types.js';
import type { FigmaFile, FigmaNode } from '@appvelocity/agent-design-to-code-core';

// ─── Context builder ─────────────────────────────────────────────────────────

interface FileContext {
  fileKey: string;
  fileName: string;
  pages: Array<{
    name: string;
    screens: Array<{ id: string; name: string; width: number; height: number }>;
  }>;
  componentIds: string[];
  componentNames: string[];
}

function buildFileContext(figmaUrl: string, figmaFile?: FigmaFile): FileContext {
  const { fileKey } = parseFigmaUrl(figmaUrl);

  if (!figmaFile) {
    return {
      fileKey,
      fileName: 'Unknown',
      pages: [],
      componentIds: [],
      componentNames: [],
    };
  }

  const pages = (figmaFile.document.children ?? []).map((page) => ({
    name: page.name,
    screens: (page.children ?? [])
      .filter((n: FigmaNode) => n.type === 'FRAME' && n.visible !== false)
      .map((n: FigmaNode) => ({
        id: n.id,
        name: n.name,
        width: n.absoluteBoundingBox?.width ?? 0,
        height: n.absoluteBoundingBox?.height ?? 0,
      })),
  }));

  const componentIds = Object.keys(figmaFile.components ?? {});
  const componentNames = Object.values(figmaFile.components ?? {}).map(
    (c: { name: string }) => c.name
  );

  return {
    fileKey,
    fileName: figmaFile.name,
    pages,
    componentIds,
    componentNames,
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: FileContext, targetFramework: string): string {
  const pagesSummary =
    ctx.pages.length > 0
      ? ctx.pages
          .map(
            (p) =>
              `  Page "${p.name}":\n` +
              (p.screens.length > 0
                ? p.screens
                    .map((s) => `    - id="${s.id}" name="${s.name}" (${s.width}×${s.height})`)
                    .join('\n')
                : '    (no top-level frames)')
          )
          .join('\n')
      : '  (No page structure available — use your best judgment)';

  const componentsSummary =
    ctx.componentIds.length > 0
      ? ctx.componentIds
          .map((id, i) => `  - id="${id}" name="${ctx.componentNames[i] ?? ''}"`)
          .join('\n')
      : '  (No reusable components found)';

  return `You are a mobile app code-generation planner.

Your job is to analyse a Figma file structure and output a JSON ExecutionPlan that tells the code generator which screens and components to generate, in what order.

## Figma File Details
- File key: ${ctx.fileKey}
- File name: ${ctx.fileName}
- Target framework: ${targetFramework}

## Pages and Screens (top-level FRAME nodes)
${pagesSummary}

## Reusable Components
${componentsSummary}

## Output Format
Respond with ONLY a valid JSON object matching this exact schema:

{
  "screens": ["<figma-node-id>", ...],       // IDs of top-level FRAME nodes to generate
  "components": ["<figma-component-id>", ...], // IDs of reusable components to generate
  "priority": "screens-first" | "components-first",
  "estimatedDuration": <number>               // estimated seconds for the full run
}

## Rules
- Include ALL visible top-level FRAME nodes as screens unless they are clearly utility frames (e.g. named "_", "Symbols", "Assets").
- Include ALL reusable components.
- Use "screens-first" priority when the file has more screens than components or when screens reference components heavily.
- Use "components-first" when there are many shared components that screens depend on.
- estimatedDuration = (screenCount × 15) + (componentCount × 8), minimum 30.
- Do NOT include any explanation, markdown, or keys outside the schema above.`;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function generationPlannerAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const llm = createLLMClient();
  const ctx = buildFileContext(state.figmaUrl, state.figmaFile);
  const systemPrompt = buildSystemPrompt(ctx, state.targetFramework);

  // Use Gemini for Flutter (better Dart/Flutter structural reasoning)
  const model =
    state.targetFramework === 'flutter'
      ? (process.env.GEMINI_MODEL ?? 'gemini-2-0-flash')
      : (process.env.OPENAI_MODEL ?? 'gpt-4o');

  const response = await llm.chat({
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyse the Figma file "${ctx.fileName}" (key: ${ctx.fileKey}) and produce an ExecutionPlan for generating ${state.targetFramework} code.`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 512,
  });

  // Strips markdown fences if proxy ignores response_format, then parses
  const executionPlan = parseJsonResponse<ExecutionPlan>(response.content);

  return {
    executionPlan,
    currentStep: 'GenerationPlannerAgent',
    logs: [
      makeLogEntry(
        'success',
        `Plan created: ${executionPlan.screens.length} screens, ${executionPlan.components.length} components`
      ),
    ],
  };
}
