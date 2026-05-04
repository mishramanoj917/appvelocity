import { projectAssemblerAgent } from '../nodes/project-assembler.js';
import { memoryToState }         from './registry.js';
import type { AgentMemory }      from '../agent-memory.js';
import type { ToolResult }       from '../types.js';

export async function assembleProjectTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.executionPlan) {
    return { success: false, summary: 'plan_generation must complete before assemble_project', error: 'prerequisite_missing' };
  }

  const state  = memoryToState(memory);
  const result = await projectAssemblerAgent(state);

  if (!result.projectBundle) {
    const err = result.errors?.[0]?.message ?? 'Assembly failed';
    return { success: false, summary: `Project assembly failed: ${err}`, error: err };
  }

  memory.projectBundle = result.projectBundle;

  return {
    success: true,
    summary:
      `Project assembled — ${result.projectBundle.files.length} total files ` +
      `(screens + components + scaffold), framework: ${result.projectBundle.framework}`,
  };
}
