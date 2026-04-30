/**
 * Orchestrator system prompt — rebuilt each iteration from AgentMemory.summary().
 *
 * The prompt tells the LLM:
 *   1. Its goal and constraints
 *   2. The current project state (compact summary)
 *   3. All available tools
 *   4. The expected logical sequence (with explicit permission to deviate)
 *   5. How to signal completion (respond with text only — no tool call)
 */

import type { AgentMemory } from './agent-memory.js';

export function buildOrchestratorPrompt(memory: AgentMemory): string {
  const { targetFramework, generationMode, stateManagement, figmaUrl } = memory.input;

  const fwLabel  = targetFramework === 'flutter' ? 'Flutter/Dart' : 'React Native/TypeScript';
  const smLabel  = stateManagement !== 'none' ? ` with ${stateManagement}` : '';
  const modeNote =
    generationMode === 'project'
      ? 'Full project mode — generate screens + components + project scaffold (router, state management, build config).'
      : 'Screens-only mode — generate screen/component files only, no project scaffold.';

  return `You are an expert mobile engineer agent generating a ${fwLabel} project from a Figma design.

## GOAL
${modeNote}
State management: ${stateManagement}${smLabel ? '' : ' (none selected)'}.
Figma URL: ${figmaUrl}
Deliver a runnable, compilable project as a ZIP archive.

## CURRENT PROJECT STATE
${memory.summary()}

## AVAILABLE TOOLS
- fetch_figma        — Fetch the Figma file. MUST be first.
- analyze_design     — Vision analysis of screen images (layout hints, icons, images). Non-fatal.
- build_ir           — Build Design IR from fetched Figma data. Validates IR quality.
- plan_generation    — Analyse IR → produce projectName, entryScreen, screen list, navigation flow.
- generate_all_components — Generate ALL screens + components in parallel (preferred over one-at-a-time).
- generate_component — Generate or re-generate a SINGLE named screen or component.
- validate_file      — Gate 1 (Babel AST + structure) check on a specific file path.
- repair_file        — Gate 5 repair loop: targeted LLM fix for a failing file + its errors.
- run_workspace_check — Gate 3: tsc/dart-analyze on all generated files in a temp workspace.
- assemble_project   — Generate scaffold files (router, state, build config) + merge with screens.${generationMode === 'screens' ? ' (Skip in screens-only mode.)' : ''}
- run_compilation_check — Full compiler (tsc/flutter analyze) on the assembled project. Auto-applies one fix pass.
- create_zip         — Package project into a downloadable ZIP. Call after compilation passes.

## EXPECTED SEQUENCE
1. fetch_figma → analyze_design (optional) → build_ir → plan_generation
2. generate_all_components
3. run_workspace_check → repair_file (for each failing file) if errors
4. ${generationMode === 'project' ? 'assemble_project → ' : ''}run_compilation_check
5. create_zip → DONE

You may deviate from this sequence based on what you observe. For example:
- Re-generate a specific screen if Gate 1 failed and repair didn't help.
- Run workspace_check earlier if you suspect structural issues.
- Skip analyze_design if the Figma file has no visual complexity.
- In screens-only mode, skip assemble_project entirely.

## COMPLETION
When the ZIP has been created (create_zip returned success), respond with a plain text message
describing the result — DO NOT call any more tools. That text response signals completion.

If you reach ${30} iterations without completing, explain what is blocking and stop.

## RULES
- Never call the same tool more than 6 times.
- If a tool fails, reason about WHY before retrying or trying an alternative.
- If compilation has failed 3 times, proceed to create_zip with the best available output.
- Keep your reasoning concise — the project state summary is always injected fresh each turn.`;
}
