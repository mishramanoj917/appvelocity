/**
 * Node 4 — GenerationPlannerAgent
 *
 * Analyses the Figma file structure (enriched by visualAnalysis from designAnalyzer)
 * and produces an ExecutionPlan that tells downstream nodes:
 *   - which screens and components to generate
 *   - the navigation flow between screens
 *   - which screen is the entry point
 *   - the inferred project name
 *
 * Input state:  figmaUrl, targetFramework, figmaFile, visualAnalysis (optional)
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
  visualSummary: string;
}

function buildFileContext(figmaUrl: string, figmaFile?: FigmaFile, visualAnalysis?: WorkflowState['visualAnalysis']): FileContext {
  const { fileKey } = parseFigmaUrl(figmaUrl);

  if (!figmaFile) {
    return { fileKey, fileName: 'Unknown', pages: [], componentIds: [], componentNames: [], visualSummary: '' };
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

  const visualSummary = visualAnalysis
    ? `Visual analysis found: spacingUnit=${visualAnalysis.spacingUnit}pt, ` +
      `${visualAnalysis.iconNodeIds.length} icons, ${visualAnalysis.imageNodeIds.length} images, ` +
      `fonts: [${visualAnalysis.fontFamilies.join(', ')}]`
    : '';

  return { fileKey, fileName: figmaFile.name, pages, componentIds, componentNames, visualSummary };
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: FileContext, targetFramework: string, stateManagement: string): string {
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

Analyse the Figma file structure and output a JSON ExecutionPlan for generating ${targetFramework} code.
State management library to use: ${stateManagement}.

## Figma File Details
- File key: ${ctx.fileKey}
- File name: ${ctx.fileName}
- Target framework: ${targetFramework}
${ctx.visualSummary ? `\n## Visual Analysis\n${ctx.visualSummary}\n` : ''}
## Pages and Screens (top-level FRAME nodes)
${pagesSummary}

## Reusable Components
${componentsSummary}

## Output Format
Respond with ONLY a valid JSON object matching this exact schema:

{
  "screens": ["<figma-node-id>", ...],
  "components": ["<figma-component-id>", ...],
  "priority": "screens-first" | "components-first",
  "estimatedDuration": <number>,
  "projectName": "<PascalCase project name>",
  "entryScreen": "<name of the first screen the app opens to>",
  "navigationFlow": [
    { "from": "<screen-name>", "to": "<screen-name>", "trigger": "<what causes navigation>" }
  ]
}

## Rules
- Include ALL visible top-level FRAME nodes as screens (exclude utility frames named "_", "Symbols", "Assets").
- Include ALL reusable components.
- priority: "screens-first" when more screens than components, else "components-first".
- estimatedDuration: (screenCount × 15) + (componentCount × 8), minimum 30.
- projectName: Derive from the file name in PascalCase, e.g. "My App Design" → "MyApp".
- entryScreen: The screen name (not id) that appears to be the root/splash/login — pick based on screen names (Splash, Login, Home, Onboarding take priority).
- navigationFlow: Infer from screen names. Common patterns:
    Splash → Login/Onboarding on load,
    Login → Home on success,
    Home → Detail on tap,
    Detail → Home on back.
  Use trigger values like: "onLoad", "onLogin", "onBack", "onItemTap", "onNext", "onSkip".
- Do NOT include any explanation, markdown, or keys outside the schema.`;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function generationPlannerAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const llm = createLLMClient();
  const ctx = buildFileContext(state.figmaUrl, state.figmaFile, state.visualAnalysis);
  const systemPrompt = buildSystemPrompt(ctx, state.targetFramework, state.stateManagement ?? 'none');

  const model =
    state.targetFramework === 'flutter'
      ? (process.env['GEMINI_MODEL'] ?? 'gemini-2-0-flash')
      : (process.env['OPENAI_MODEL'] ?? 'gpt-4o');

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
    max_tokens: 4096,
  });

  const executionPlan = parseJsonResponse<ExecutionPlan>(response.content);

  // Ensure required fields have defaults if LLM omitted them
  executionPlan.projectName ??= 'MyApp';
  executionPlan.entryScreen ??= executionPlan.screens[0] ?? '';
  executionPlan.navigationFlow ??= [];

  return {
    executionPlan,
    currentStep: 'GenerationPlannerAgent',
    logs: [
      makeLogEntry(
        'success',
        `Plan: "${executionPlan.projectName}" — ${executionPlan.screens.length} screens, ` +
        `${executionPlan.components.length} components, ` +
        `${executionPlan.navigationFlow.length} navigation edges`
      ),
    ],
  };
}
