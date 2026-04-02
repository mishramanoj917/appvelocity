/**
 * Node 1 — InputValidator
 * Validates Figma URL, API token presence, and target framework.
 */

import { parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import type { AgentError, WorkflowState, LogEntry } from '../types.js';
import { makeLogEntry } from '../utils/logger.js';

export async function inputValidator(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const errors: AgentError[] = [];

  // Validate Figma URL
  try {
    const { fileKey } = parseFigmaUrl(state.figmaUrl);
    if (!fileKey) {
      errors.push({
        code: 'INVALID_FIGMA_URL',
        message: `Could not extract file key from URL: ${state.figmaUrl}`,
        recoverable: false,
      });
    }
  } catch (err) {
    errors.push({
      code: 'INVALID_FIGMA_URL',
      message: err instanceof Error ? err.message : String(err),
      recoverable: false,
    });
  }

  // Validate Figma API token
  if (!process.env.FIGMA_ACCESS_TOKEN) {
    errors.push({
      code: 'MISSING_FIGMA_TOKEN',
      message: 'FIGMA_ACCESS_TOKEN environment variable is not set',
      recoverable: false,
    });
  }

  // Validate target framework
  if (!['react-native', 'flutter'].includes(state.targetFramework)) {
    errors.push({
      code: 'INVALID_FRAMEWORK',
      message: `Unsupported framework: "${state.targetFramework}". Must be "react-native" or "flutter".`,
      recoverable: false,
    });
  }

  const log: LogEntry =
    errors.length > 0
      ? makeLogEntry('error', `Validation failed: ${errors.length} error(s)`)
      : makeLogEntry('success', 'Input validation passed');

  return {
    errors,
    currentStep: 'InputValidator',
    logs: [log],
  };
}
