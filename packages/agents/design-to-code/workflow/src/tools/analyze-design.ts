import { designAnalyzerAgent } from '../nodes/design-analyzer.js';
import { memoryToState }       from './registry.js';
import type { AgentMemory }    from '../agent-memory.js';
import type { ToolResult }     from '../types.js';

export async function analyzeDesignTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.figmaFile) {
    return { success: false, summary: 'fetch_figma must complete before analyze_design', error: 'prerequisite_missing' };
  }

  const state  = memoryToState(memory);
  const result = await designAnalyzerAgent(state);

  if (result.visualAnalysis) {
    memory.visualAnalysis = result.visualAnalysis;
    const va = result.visualAnalysis;
    return {
      success: true,
      summary:
        `Visual analysis complete — spacing=${va.spacingUnit}pt, ` +
        `${va.iconNodeIds.length} icons, ${va.imageNodeIds.length} images, ` +
        `fonts: [${va.fontFamilies.slice(0, 3).join(', ')}]`,
    };
  }

  // Non-fatal: vision LLM may be unavailable
  return {
    success: true,
    summary: 'Visual analysis skipped (vision LLM unavailable) — continuing without layout hints',
  };
}
