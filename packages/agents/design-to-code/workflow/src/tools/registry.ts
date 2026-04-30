/**
 * Tool registry — the 12 tools the orchestrator LLM can call.
 *
 * Each tool is a thin wrapper around existing node/utility logic.
 * Tools return summary strings (≤200 tokens) to the orchestrator;
 * full content lives in AgentMemory and never flows through the LLM context.
 */

import type { ToolDefinition, ToolCall, ToolResult, WorkflowState } from '../types.js';
import type { AgentMemory } from '../agent-memory.js';
import type { CodeBundle, CodeFile } from '@appvelocity/agent-design-to-code-generators';

// ─── Tool implementations (imported lazily to avoid circular deps) ─────────────

import { fetchFigmaTool }       from './fetch-figma.js';
import { analyzeDesignTool }    from './analyze-design.js';
import { buildIrTool }          from './build-ir.js';
import { planGenerationTool }   from './plan-generation.js';
import { generateAllTool }      from './generate-all.js';
import { generateComponentTool }from './generate-component.js';
import { validateFileTool }     from './validate-file.js';
import { repairFileTool }       from './repair-file.js';
import { workspaceCheckTool }   from './workspace-check.js';
import { assembleProjectTool }  from './assemble-project.js';
import { compilationCheckTool } from './compilation-check.js';
import { createZipTool }        from './create-zip.js';

// ─── Tool registry (OpenAI function-calling format) ───────────────────────────

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_figma',
      description: 'Fetch the Figma file and design variables. Must be the first tool called.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The Figma file URL' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_design',
      description: 'Run vision analysis on screen images to detect layout hints, icons, images, and fonts. Requires fetch_figma to have completed. Non-fatal — may be skipped.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'build_ir',
      description: 'Build the Design IR (Intermediate Representation) from the Figma file. Requires fetch_figma.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_generation',
      description: 'Analyse the IR and produce an execution plan: projectName, entryScreen, screens list, navigation flow. Requires build_ir.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_all_components',
      description: 'Generate all screens and components in parallel using the LLM. Runs Gate 1 (syntax check) and Gate 3 (workspace tsc) automatically. Requires plan_generation.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_component',
      description: 'Generate a single screen or component. Use when you need to regenerate or add one specific file.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Screen or component name (e.g. "HomeScreen" or "Button")' },
          type: { type: 'string', enum: ['screen', 'component'], description: 'Whether this is a screen or a component' },
        },
        required: ['name', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'validate_file',
      description: 'Run Gate 1 (Babel AST parse + structure check) on a specific generated file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path in the project (e.g. "src/screens/HomeScreen.tsx")' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repair_file',
      description: 'Run Gate 5 repair loop on a failing file: sends file + errors to LLM for targeted fix.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path to repair',
          },
          errors: {
            type: 'array',
            description: 'List of errors to fix',
            items: {
              type: 'object',
              properties: {
                line: { type: 'number' },
                col: { type: 'number' },
                message: { type: 'string' },
              },
              required: ['line', 'col', 'message'],
            },
          },
        },
        required: ['path', 'errors'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_workspace_check',
      description: 'Run Gate 3: tsc --noResolve or dart analyze on all generated files in a temp workspace. Returns errors grouped by file.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assemble_project',
      description: 'Generate project scaffold files (main.dart/App.tsx, router, state management, package.json/pubspec.yaml, etc.) and merge with generated screens. Only relevant in "project" mode.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_compilation_check',
      description: 'Run the full compiler (flutter analyze or npx tsc --noEmit) on the assembled project in a temp directory. Provides definitive compilation status.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_zip',
      description: 'Package the complete project into a downloadable ZIP archive. Should be called after run_compilation_check passes (or after max retries).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>, memory: AgentMemory) => Promise<ToolResult>;

const HANDLERS: Record<string, ToolHandler> = {
  fetch_figma:             fetchFigmaTool,
  analyze_design:          analyzeDesignTool,
  build_ir:                buildIrTool,
  plan_generation:         planGenerationTool,
  generate_all_components: generateAllTool,
  generate_component:      generateComponentTool,
  validate_file:           validateFileTool,
  repair_file:             repairFileTool,
  run_workspace_check:     workspaceCheckTool,
  assemble_project:        assembleProjectTool,
  run_compilation_check:   compilationCheckTool,
  create_zip:              createZipTool,
};

export async function dispatchTool(call: ToolCall, memory: AgentMemory): Promise<ToolResult> {
  const name = call.function.name;

  // Guard: unknown tool
  const handler = HANDLERS[name];
  if (!handler) {
    return { success: false, summary: `Unknown tool: ${name}`, error: `No handler for tool "${name}"` };
  }

  // Guard: over-call limit
  if (memory.isOverLimit(name, 6)) {
    return {
      success: false,
      summary: `Tool "${name}" has been called too many times (>${6}). Choose a different action.`,
      error: 'over_call_limit',
    };
  }

  // Parse args
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.function.arguments) as Record<string, unknown>;
  } catch {
    return { success: false, summary: 'Invalid JSON in tool arguments', error: call.function.arguments };
  }

  // Execute
  try {
    return await handler(args, memory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, summary: `Tool "${name}" threw: ${msg.slice(0, 200)}`, error: msg };
  }
}

// ─── Helper: build a minimal WorkflowState from AgentMemory ──────────────────

export function memoryToState(memory: AgentMemory): WorkflowState {
  // Reconstruct CodeBundle from generatedFiles map
  const files: CodeFile[] = [];
  for (const [p, content] of memory.generatedFiles.entries()) {
    const language: CodeFile['language'] = p.endsWith('.dart') ? 'dart' : 'typescript';
    files.push({ path: p, content, language });
  }
  const generatedCode: CodeBundle = {
    framework:    memory.input.targetFramework,
    files,
    assets:       [],
    dependencies: {},
  };

  return {
    figmaUrl:                memory.input.figmaUrl,
    targetFramework:         memory.input.targetFramework,
    generationMode:          memory.input.generationMode,
    stateManagement:         memory.input.stateManagement,
    options:                 memory.input.options ?? {},
    figmaFile:               memory.figmaFile,
    variablesResponse:       memory.variablesResponse,
    visualAnalysis:          memory.visualAnalysis,
    designIR:                memory.designIR,
    executionPlan:           memory.executionPlan,
    generatedCode,
    projectBundle:           memory.projectBundle,
    compilationResult:       memory.compilationResult,
    errors:                  [...memory.errors],
    retryCount:              0,
    codeValidationRetryCount: 0,
    compilationRetryCount:   0,
    currentStep:             '',
    logs:                    [],
  };
}
