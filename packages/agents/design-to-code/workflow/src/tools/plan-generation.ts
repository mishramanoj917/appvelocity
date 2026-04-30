import { generationPlannerAgent } from '../nodes/generation-planner.js';
import { memoryToState }          from './registry.js';
import type { AgentMemory }       from '../agent-memory.js';
import type { ToolResult }        from '../types.js';

export async function planGenerationTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.designIR) {
    return { success: false, summary: 'build_ir must complete before plan_generation', error: 'prerequisite_missing' };
  }

  const state  = memoryToState(memory);
  const result = await generationPlannerAgent(state);

  if (!result.executionPlan) {
    const err = result.errors?.[0]?.message ?? 'Planning failed';
    return { success: false, summary: `Generation planning failed: ${err}`, error: err };
  }

  memory.executionPlan = result.executionPlan;
  const plan = result.executionPlan;

  return {
    success: true,
    summary:
      `Plan: "${plan.projectName}", entry="${plan.entryScreen}", ` +
      `${plan.screens.length} screens, ${plan.components.length} components, ` +
      `${plan.navigationFlow.length} navigation edges`,
  };
}
