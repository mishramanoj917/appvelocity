import { WorkspaceSession, groupErrorsByFile } from '../utils/workspace-validator.js';
import type { AgentMemory } from '../agent-memory.js';
import type { ToolResult }  from '../types.js';

export async function workspaceCheckTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (memory.generatedFiles.size === 0) {
    return { success: false, summary: 'No generated files to check — generate_all_components first', error: 'no_files' };
  }

  const session = await WorkspaceSession.create(memory.input.targetFramework);
  try {
    for (const [path, content] of memory.generatedFiles.entries()) {
      await session.writeFile(path, content);
    }

    const errors      = await session.runCheck();
    const byFile      = groupErrorsByFile(errors);
    const errorCount  = errors.length;
    const affectedFiles = [...byFile.keys()];

    if (errorCount === 0) {
      return { success: true, summary: `Workspace check PASSED — ${memory.generatedFiles.size} files, 0 errors` };
    }

    const summary = affectedFiles
      .slice(0, 5)
      .map(f => `${f.split('/').pop()}(${byFile.get(f)!.length} errors)`)
      .join(', ');
    const more = affectedFiles.length > 5 ? ` +${affectedFiles.length - 5} more` : '';

    return {
      success: false,
      summary:
        `Workspace check: ${errorCount} error(s) across ${affectedFiles.length} file(s): ${summary}${more}. ` +
        `Affected files: ${JSON.stringify(affectedFiles)}`,
      error: `${errorCount} compilation errors`,
    };
  } finally {
    await session.cleanup();
  }
}
