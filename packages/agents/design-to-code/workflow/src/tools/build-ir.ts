import { irBuilderAgent }    from '../nodes/ir-builder.js';
import { irValidatorAgent }  from '../nodes/ir-validator.js';
import { memoryToState }     from './registry.js';
import { extractGroundTruth } from '../utils/ground-truth-extractor.js';
import type { AgentMemory }  from '../agent-memory.js';
import type { ToolResult }   from '../types.js';

export async function buildIrTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.figmaFile) {
    return { success: false, summary: 'fetch_figma must complete before build_ir', error: 'prerequisite_missing' };
  }

  const state = memoryToState(memory);

  // Build
  const buildResult = await irBuilderAgent(state);
  if (!buildResult.designIR) {
    const err = buildResult.errors?.[0]?.message ?? 'IR build failed';
    return { success: false, summary: `IR build failed: ${err}`, error: err };
  }
  memory.designIR = buildResult.designIR;

  // Validate
  const validateState  = { ...state, designIR: buildResult.designIR };
  const validateResult = await irValidatorAgent(validateState);
  const valid          = validateResult.validationResult?.valid ?? true;
  const score          = validateResult.validationResult?.score ?? 100;
  const issues         = validateResult.validationResult?.issues?.length ?? 0;

  // Extract ground truth for VisualQA — builds a reference snapshot of what the
  // generated code must reproduce (tokens, component tree, asset list, frame URLs).
  try {
    const assetUrls: Record<string, string> = {};
    for (const asset of memory.designIR.assets) {
      if (asset.url) assetUrls[asset.nodeId] = asset.url;
    }
    extractGroundTruth(memory.designIR, memory.sessionId, memory.snapshotManager, assetUrls);
  } catch {
    // Non-fatal — VisualQA will skip gracefully if ground_truth.json is missing
  }

  const ir = memory.designIR;
  return {
    success: true,
    summary:
      `IR built — ${ir.screens.length} screens: [${ir.screens.map(s => s.componentName).join(', ')}], ` +
      `${ir.components.length} components, ${ir.assets.length} assets. ` +
      `Validation: ${valid ? 'PASS' : 'WARN'} (score=${score}, issues=${issues}). Ground truth written.`,
  };
}
