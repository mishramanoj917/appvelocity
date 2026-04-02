/**
 * Node 4 — IRBuilderAgent
 * Transforms the fetched FigmaFile into a DesignIR using the core IRBuilder.
 */

import { IRBuilder, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';

export async function irBuilderAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  if (!state.figmaFile) {
    throw new Error(
      'FigmaFile not available in state. ResearcherAgent must run before IRBuilderAgent.'
    );
  }

  const { fileKey } = parseFigmaUrl(state.figmaUrl);
  const builder = new IRBuilder();

  const designIR = builder.build(state.figmaFile, fileKey, state.variablesResponse);

  return {
    designIR,
    currentStep: 'IRBuilderAgent',
    logs: [
      makeLogEntry(
        'success',
        `IR built: ${designIR.screens.length} screens, ${designIR.components.length} components, ${designIR.tokens.raw.length} tokens`
      ),
    ],
  };
}
