/**
 * Node 5 — CriticAgent
 * Uses an LLM to validate the DesignIR quality and accessibility.
 * Returns a validation result; increments retryCount on failure.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState, IRValidationResult } from '../types.js';

async function loadPrompt(): Promise<string> {
  return readFile(join(__dirname, '..', 'prompts', 'critic.txt'), 'utf-8');
}

export async function criticAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  if (!state.designIR) {
    throw new Error(
      'DesignIR not available in state. IRBuilderAgent must run before CriticAgent.'
    );
  }

  const llm = createLLMClient();
  const prompt = await loadPrompt();

  const irSummary = JSON.stringify(
    {
      screens: state.designIR.screens.map((s) => ({
        id: s.id,
        name: s.name,
        elementCount: Object.keys(s.elementIndex).length,
      })),
      componentCount: state.designIR.components.length,
      tokenCount: state.designIR.tokens.raw.length,
      assetCount: state.designIR.assets.length,
    },
    null,
    2
  );

  const systemPrompt = prompt.replace('{{IR_SUMMARY}}', irSummary);

  const response = await llm.chat({
    model: 'claude-sonnet-4-6',
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Validate the IR structure and identify any issues.',
      },
    ],
    response_format: { type: 'json_object' },
  });

  const validationResult: IRValidationResult = JSON.parse(
    response.content
  ) as IRValidationResult;

  const failed = !validationResult.valid;

  return {
    validationResult,
    retryCount: failed ? state.retryCount + 1 : state.retryCount,
    currentStep: 'CriticAgent',
    logs: [
      makeLogEntry(
        validationResult.valid ? 'success' : 'warning',
        validationResult.valid
          ? `Validation passed (score: ${validationResult.score}/100)`
          : `Validation failed (score: ${validationResult.score}/100) — ${validationResult.issues.filter((i) => i.severity === 'error').length} error(s)`
      ),
    ],
  };
}
