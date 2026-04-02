/**
 * Node 2 — PlannerAgent
 * Uses an LLM to analyse the Figma file structure and produce an ExecutionPlan.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState, ExecutionPlan } from '../types.js';

async function loadPrompt(): Promise<string> {
  return readFile(join(__dirname, '..', 'prompts', 'planner.txt'), 'utf-8');
}

export async function plannerAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const llm = createLLMClient();
  const prompt = await loadPrompt();
  const { fileKey } = parseFigmaUrl(state.figmaUrl);

  const systemPrompt = prompt
    .replace('{{FIGMA_URL}}', state.figmaUrl)
    .replace('{{FILE_KEY}}', fileKey)
    .replace('{{TARGET_FRAMEWORK}}', state.targetFramework);

  const response = await llm.chat({
    model: 'claude-sonnet-4-6',
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Analyse the Figma file and create an execution plan.',
      },
    ],
    response_format: { type: 'json_object' },
  });

  const executionPlan: ExecutionPlan = JSON.parse(response.content) as ExecutionPlan;

  return {
    executionPlan,
    currentStep: 'PlannerAgent',
    logs: [
      makeLogEntry(
        'success',
        `Plan created: ${executionPlan.screens.length} screens, ${executionPlan.components.length} components`
      ),
    ],
  };
}
