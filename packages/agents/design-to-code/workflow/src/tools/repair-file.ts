import { repairFile }       from '../utils/repair-loop.js';
import { createLLMClient }  from '../utils/llm-client.js';
import type { AgentMemory } from '../agent-memory.js';
import type { ToolResult }  from '../types.js';
import type { RepairError } from '../utils/repair-loop.js';

const DEFAULT_MODEL = process.env['OPENAI_MODEL'] ?? 'gpt-4o';

export async function repairFileTool(
  args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  const path   = args['path'] as string | undefined;
  const errors = args['errors'] as RepairError[] | undefined;

  if (!path)   return { success: false, summary: 'Missing required arg: path',   error: 'missing_arg' };
  if (!errors) return { success: false, summary: 'Missing required arg: errors', error: 'missing_arg' };

  const content = memory.generatedFiles.get(path);
  if (!content) {
    return { success: false, summary: `File not found in memory: ${path}`, error: 'file_not_found' };
  }

  const llm    = createLLMClient();
  const result = await repairFile(llm, DEFAULT_MODEL, path, content, errors, memory.input.targetFramework);

  // Always save the best version back to memory (even if not fully repaired)
  memory.generatedFiles.set(path, result.content);

  if (result.repaired) {
    return { success: true, summary: `${path}: repaired in ${result.attempts} attempt(s) — Gate 1 now passes` };
  }

  return {
    success: false,
    summary:
      `${path}: repair exhausted ${result.attempts} attempts` +
      (result.escalated ? ' — escalation comment prepended, manual review needed' : ''),
    error: 'repair_failed',
  };
}
