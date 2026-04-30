import { projectZipperAgent } from '../nodes/project-zipper.js';
import { memoryToState }      from './registry.js';
import type { AgentMemory }   from '../agent-memory.js';
import type { ToolResult }    from '../types.js';

export async function createZipTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.projectBundle && memory.generatedFiles.size === 0) {
    return { success: false, summary: 'Nothing to zip — generate or assemble project first', error: 'no_project' };
  }

  const state  = memoryToState(memory);
  const result = await projectZipperAgent(state);

  if (!result.zipBuffer) {
    const err = result.errors?.[0]?.message ?? 'ZIP creation failed';
    return { success: false, summary: `ZIP creation failed: ${err}`, error: err };
  }

  memory.zipBuffer = result.zipBuffer as Buffer;

  const sizeMB = (result.zipBuffer.length / (1024 * 1024)).toFixed(2);
  const fileCount = memory.projectBundle?.files.length ?? memory.generatedFiles.size;

  return {
    success: true,
    summary: `ZIP created — ${fileCount} files, ${sizeMB} MB. Project is ready for download.`,
  };
}
