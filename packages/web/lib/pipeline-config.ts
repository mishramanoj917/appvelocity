/**
 * Shared pipeline constants for the DesignToCode agent.
 * Imported by the live page and the AgentHierarchyView component.
 */

export interface PipelineAgent {
  id: string;
  icon: string;
  label: string;
  detail: string;
  tools: string[];
}

export const PIPELINE: PipelineAgent[] = [
  {
    id: 'orchestrator',
    icon: '🎯',
    label: 'Orchestrator',
    detail: 'Session lifecycle · retry policy',
    tools: [],
  },
  {
    id: 'figma-ingestion',
    icon: '📥',
    label: 'Figma Ingestion',
    detail: 'Snapshot-first · 1 API call',
    tools: ['fetch_figma'],
  },
  {
    id: 'ground-truth',
    icon: '🗺️',
    label: 'Ground Truth',
    detail: 'IR build · status bar filter',
    tools: ['analyze_design', 'build_ir'],
  },
  {
    id: 'coding',
    icon: '⚡',
    label: 'Coding',
    detail: 'ReAct loop · code generation',
    tools: [
      'plan_generation',
      'generate_all_components',
      'generate_component',
      'assemble_project',
      'create_zip',
    ],
  },
  {
    id: 'validation',
    icon: '🛡️',
    label: 'Validation',
    detail: 'Gate 1/2/3 · pre-write checks',
    tools: ['validate_file', 'repair_file', 'run_workspace_check', 'run_compilation_check'],
  },
  {
    id: 'visual-qa',
    icon: '👁️',
    label: 'Visual QA',
    detail: 'Structural · token · pixel · LLM judge',
    tools: ['run_visual_qa'],
  },
];

export const TOOL_TO_AGENT: Record<string, string> = {
  fetch_figma:             'figma-ingestion',
  analyze_design:          'ground-truth',
  build_ir:                'ground-truth',
  plan_generation:         'coding',
  generate_all_components: 'coding',
  generate_component:      'coding',
  assemble_project:        'coding',
  create_zip:              'coding',
  validate_file:           'validation',
  repair_file:             'validation',
  run_workspace_check:     'validation',
  run_compilation_check:   'validation',
  run_visual_qa:           'visual-qa',
};

export const TOOL_LABEL: Record<string, string> = {
  fetch_figma:             'Fetch Figma',
  analyze_design:          'Vision Analysis',
  build_ir:                'Build IR',
  plan_generation:         'Plan',
  generate_all_components: 'Generate All',
  generate_component:      'Generate One',
  validate_file:           'Gate 1 Check',
  repair_file:             'Gate 5 Repair',
  run_workspace_check:     'Gate 3 Compile',
  assemble_project:        'Assemble',
  run_compilation_check:   'Compile Check',
  create_zip:              'Create ZIP',
  run_visual_qa:           'Visual QA',
};

export const TOOL_LOGS: Record<string, string> = {
  fetch_figma:             'Checking snapshot cache · fetching Figma design data…',
  analyze_design:          'Running vision analysis on exported screens…',
  build_ir:                'Building Design IR · filtering status bar nodes…',
  plan_generation:         'Planning screens and navigation flow…',
  generate_all_components: 'Generating all screens and components in parallel…',
  generate_component:      'Generating single screen or component…',
  validate_file:           'Gate 1 — pre-write static check (Babel / dart analyze)…',
  repair_file:             'Gate 5 — LLM repair loop…',
  run_workspace_check:     'Gate 3 — incremental workspace compile check…',
  assemble_project:        'Assembling project scaffold…',
  run_compilation_check:   'Full compilation check + auto-fix pass…',
  create_zip:              'Packaging project into ZIP archive…',
  run_visual_qa:           'Visual QA — comparing screens against Figma ground truth…',
};

/** Parses a step string like "fetch_figma [iter 3]" into { tool, iter }. */
export function parseStep(s: string): { tool: string; iter: number } {
  const match = s.match(/^(\S+)\s+\[iter\s+(\d+)\]/);
  return match
    ? { tool: match[1]!, iter: parseInt(match[2]!, 10) }
    : { tool: s, iter: 0 };
}
