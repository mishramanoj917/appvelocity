/**
 * Node 4 — IRBuilderAgent
 * Transforms the fetched FigmaFile into a DesignIR using the core IRBuilder.
 *
 * For mobile frameworks (react-native, flutter) it applies a screen filter
 * that excludes clearly-desktop and design-system frames (width > MAX_MOBILE_WIDTH).
 * This prevents the CriticAgent from being blocked by desktop frames
 * that happen to sit alongside mobile screens in the same Figma file.
 */

import { IRBuilder, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';
import type { IRScreen } from '@appvelocity/agent-design-to-code-core';

/** Mobile screens are ≤ this width (px). Wider frames are desktop/design-system. */
const MAX_MOBILE_WIDTH = 600;
/** Minimum meaningful screen height — filters stub/banner frames. */
const MIN_SCREEN_HEIGHT = 300;

const MOBILE_FRAMEWORKS = new Set(['react-native', 'flutter']);

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

  // Filter to mobile-sized screens for react-native / flutter targets
  const logs = [];
  if (MOBILE_FRAMEWORKS.has(state.targetFramework)) {
    const all = designIR.screens.length;
    designIR.screens = (designIR.screens as IRScreen[]).filter(
      (s) => s.width <= MAX_MOBILE_WIDTH && s.height >= MIN_SCREEN_HEIGHT
    );
    const excluded = all - designIR.screens.length;
    if (excluded > 0) {
      logs.push(
        makeLogEntry(
          'info',
          `Filtered ${excluded} non-mobile frame(s) (width > ${MAX_MOBILE_WIDTH}px or height < ${MIN_SCREEN_HEIGHT}px) — kept ${designIR.screens.length} mobile screens`
        )
      );
    }
  }

  logs.push(
    makeLogEntry(
      'success',
      `IR built: ${designIR.screens.length} screens, ${designIR.components.length} components, ${designIR.tokens.raw.length} tokens`
    )
  );

  return {
    designIR,
    currentStep: 'IRBuilderAgent',
    logs,
  };
}
