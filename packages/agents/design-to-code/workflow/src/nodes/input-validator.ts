/**
 * Node 1 — InputValidator
 * Validates Figma URL, API token, target framework, generation mode, and state management.
 */

import { parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import type { AgentError, WorkflowState, LogEntry } from '../types.js';
import { makeLogEntry } from '../utils/logger.js';

const FLUTTER_STATE_MANAGEMENT = ['riverpod', 'bloc', 'provider', 'none'] as const;
const RN_STATE_MANAGEMENT = ['zustand', 'redux', 'jotai', 'none'] as const;

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
  if (!process.env['FIGMA_ACCESS_TOKEN']) {
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

  // Validate generation mode
  if (!['project', 'screens'].includes(state.generationMode ?? '')) {
    errors.push({
      code: 'INVALID_GENERATION_MODE',
      message: `Invalid generationMode: "${state.generationMode}". Must be "project" or "screens".`,
      recoverable: false,
    });
  }

  // Validate state management choice against framework
  const sm = state.stateManagement ?? 'none';
  if (state.targetFramework === 'flutter' && !FLUTTER_STATE_MANAGEMENT.includes(sm as typeof FLUTTER_STATE_MANAGEMENT[number])) {
    errors.push({
      code: 'INVALID_STATE_MANAGEMENT',
      message: `Invalid stateManagement "${sm}" for Flutter. Allowed: ${FLUTTER_STATE_MANAGEMENT.join(', ')}.`,
      recoverable: false,
    });
  }
  if (state.targetFramework === 'react-native' && !RN_STATE_MANAGEMENT.includes(sm as typeof RN_STATE_MANAGEMENT[number])) {
    errors.push({
      code: 'INVALID_STATE_MANAGEMENT',
      message: `Invalid stateManagement "${sm}" for React Native. Allowed: ${RN_STATE_MANAGEMENT.join(', ')}.`,
      recoverable: false,
    });
  }

  const log: LogEntry =
    errors.length > 0
      ? makeLogEntry('error', `Validation failed: ${errors.length} error(s)`)
      : makeLogEntry('success',
          `Input validation passed — ${state.targetFramework}, ${state.generationMode} mode, state: ${sm}`
        );

  return {
    errors,
    currentStep: 'InputValidator',
    logs: [log],
  };
}
