/**
 * Generate (or re-generate) a single screen or component.
 * Used when the agent needs to regenerate one specific file.
 */

import { codeGeneratorAgent } from '../nodes/code-generator.js';
import { memoryToState }      from './registry.js';
import type { AgentMemory }   from '../agent-memory.js';
import type { ToolResult }    from '../types.js';

export async function generateComponentTool(
  args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  const name = args['name'] as string | undefined;
  const type = (args['type'] as string | undefined) ?? 'screen';

  if (!name) return { success: false, summary: 'Missing required arg: name', error: 'missing_arg' };
  if (!memory.executionPlan) {
    return { success: false, summary: 'plan_generation must complete first', error: 'prerequisite_missing' };
  }

  // Temporarily narrow the execution plan to just this one item so codeGeneratorAgent
  // generates only the requested screen/component.
  const narrowedPlan = {
    ...memory.executionPlan,
    screens:    type === 'screen'    ? [name] : [],
    components: type === 'component' ? [name] : [],
  };

  const state = { ...memoryToState(memory), executionPlan: narrowedPlan };
  const result = await codeGeneratorAgent(state);

  if (!result.generatedCode || result.generatedCode.files.length === 0) {
    const err = result.errors?.[0]?.message ?? 'No output produced';
    return { success: false, summary: `Failed to generate ${name}: ${err}`, error: err };
  }

  const file = result.generatedCode.files[0]!;
  memory.generatedFiles.set(file.path, file.content);

  const lines     = file.content.split('\n').length;
  const escalated = file.content.includes('AUTO-REPAIR FAILED');

  return {
    success: true,
    summary:
      `Generated ${file.path} (${lines} lines)` +
      (escalated ? ' ⚠️ — auto-repair failed, manual review needed' : ' — Gate 1 passed'),
  };
}
