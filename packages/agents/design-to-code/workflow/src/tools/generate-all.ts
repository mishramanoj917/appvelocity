import { codeGeneratorAgent } from '../nodes/code-generator.js';
import { memoryToState }      from './registry.js';
import type { AgentMemory }   from '../agent-memory.js';
import type { ToolResult }    from '../types.js';

export async function generateAllTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.executionPlan) {
    return { success: false, summary: 'plan_generation must complete before generate_all_components', error: 'prerequisite_missing' };
  }
  if (!memory.designIR) {
    return { success: false, summary: 'build_ir must complete before generate_all_components', error: 'prerequisite_missing' };
  }

  const state  = memoryToState(memory);
  const result = await codeGeneratorAgent(state);

  if (!result.generatedCode || result.generatedCode.files.length === 0) {
    const err = result.errors?.[0]?.message ?? 'Code generation produced no files';
    return { success: false, summary: `Code generation failed: ${err}`, error: err };
  }

  // Merge generated files into memory
  for (const file of result.generatedCode.files) {
    memory.generatedFiles.set(file.path, file.content);
  }

  const total    = result.generatedCode.files.length;
  const escalated = result.generatedCode.files.filter(f => f.content.includes('AUTO-REPAIR FAILED')).length;
  const names    = result.generatedCode.files.slice(0, 5).map(f => f.path.split('/').pop()).join(', ');
  const more     = total > 5 ? ` +${total - 5} more` : '';

  return {
    success: true,
    summary:
      `Generated ${total} files (${names}${more})` +
      (escalated > 0 ? `. ⚠️ ${escalated} file(s) need manual review.` : '. All passed Gate 1.'),
  };
}
