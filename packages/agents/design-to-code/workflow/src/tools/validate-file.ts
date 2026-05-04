import { runGate1 }         from '../utils/gate1-validator.js';
import type { AgentMemory } from '../agent-memory.js';
import type { ToolResult }  from '../types.js';

export async function validateFileTool(
  args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  const path = args['path'] as string | undefined;
  if (!path) return { success: false, summary: 'Missing required arg: path', error: 'missing_arg' };

  const content = memory.generatedFiles.get(path);
  if (!content) {
    return { success: false, summary: `File not found in memory: ${path}`, error: 'file_not_found' };
  }

  const result = runGate1(content, memory.input.targetFramework);

  if (result.valid && !result.structureIssue) {
    return { success: true, summary: `${path}: Gate 1 PASSED` };
  }

  const details = result.structureIssue
    ? `Structure issue: ${result.structureIssue}`
    : result.errors.map(e => `Line ${e.line}:${e.col} — ${e.message.slice(0, 80)}`).join('; ');

  return {
    success: false,
    summary: `${path}: Gate 1 FAILED — ${details}`,
    error: details,
  };
}
