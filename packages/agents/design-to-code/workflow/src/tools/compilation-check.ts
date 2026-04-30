import { compilationValidatorAgent } from '../nodes/compilation-validator.js';
import { compilationFixerAgent }     from '../nodes/compilation-fixer.js';
import { memoryToState }             from './registry.js';
import type { AgentMemory }          from '../agent-memory.js';
import type { ToolResult }           from '../types.js';

export async function compilationCheckTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.projectBundle && memory.generatedFiles.size === 0) {
    return { success: false, summary: 'No project to compile — assemble_project or generate_all first', error: 'no_project' };
  }

  const state  = memoryToState(memory);
  const result = await compilationValidatorAgent(state);

  if (!result.compilationResult) {
    return { success: true, summary: 'Compilation check skipped (compiler not available on this host)' };
  }

  memory.compilationResult = result.compilationResult;

  if (result.compilationResult.success) {
    return { success: true, summary: `Compilation PASSED (${result.compilationResult.tool})` };
  }

  // Run one pass of the fixer automatically when errors exist
  const retryCount = memory.compilationResult.retryCount ?? 0;
  if (retryCount < 3 && result.compilationResult.errors.length > 0) {
    const fixState   = { ...memoryToState(memory), compilationResult: result.compilationResult };
    const fixResult  = await compilationFixerAgent(fixState);

    if (fixResult.projectBundle) {
      memory.projectBundle = fixResult.projectBundle;
      // Update generatedFiles from fixed bundle
      for (const file of fixResult.projectBundle.files) {
        memory.generatedFiles.set(file.path, file.content);
      }
      memory.compilationResult = {
        ...result.compilationResult,
        retryCount: retryCount + 1,
      };
    }
  }

  const errors  = result.compilationResult.errors;
  const topErrs = errors
    .slice(0, 3)
    .map(e => `${e.file.split('/').pop()}:${e.line}: ${e.message.slice(0, 60)}`)
    .join('; ');

  return {
    success: false,
    summary:
      `Compilation FAILED — ${errors.length} error(s). Auto-fix attempted (pass ${retryCount + 1}/3). ` +
      `Top errors: ${topErrs}. Call run_compilation_check again to re-check after fixes.`,
    error: `${errors.length} compilation errors`,
  };
}
