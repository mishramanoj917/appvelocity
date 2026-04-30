import { figmaFetcherAgent } from '../nodes/figma-fetcher.js';
import { memoryToState }    from './registry.js';
import type { AgentMemory } from '../agent-memory.js';
import type { ToolResult }  from '../types.js';

export async function fetchFigmaTool(
  args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  const url = (args['url'] as string | undefined) ?? memory.input.figmaUrl;
  const state = { ...memoryToState(memory), figmaUrl: url };

  const result = await figmaFetcherAgent(state);

  if (!result.figmaFile) {
    const err = result.errors?.[0]?.message ?? 'Unknown error';
    return { success: false, summary: `Failed to fetch Figma file: ${err}`, error: err };
  }

  memory.figmaFile         = result.figmaFile;
  memory.variablesResponse = result.variablesResponse;

  const pageCount    = result.figmaFile.document.children?.length ?? 0;
  const tokenCount   = result.variablesResponse
    ? Object.keys(result.variablesResponse.meta.variables).length
    : 0;

  return {
    success: true,
    summary: `Fetched "${result.figmaFile.name}" — ${pageCount} page(s), ${tokenCount} design tokens`,
  };
}
