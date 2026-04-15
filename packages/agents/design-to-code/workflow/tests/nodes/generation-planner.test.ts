import { describe, it, expect, beforeEach } from 'vitest';
import { generationPlannerAgent } from '../../src/nodes/generation-planner.js';
import { setLLMClient } from '../../src/utils/llm-client.js';
import { makeBaseState, mockExecutionPlan } from '../fixtures/mock-workflow-state.js';
import type { LLMClient } from '../../src/types.js';

function makeMockLLM(content: string): LLMClient {
  return {
    chat: async () => ({
      content,
      model: 'mock',
      inputTokens: 0,
      outputTokens: 0,
    }),
  };
}

describe('generationPlannerAgent', () => {
  beforeEach(() => {
    process.env.FIGMA_ACCESS_TOKEN = 'test-token';
  });

  it('parses a valid LLM response into an ExecutionPlan', async () => {
    setLLMClient(makeMockLLM(JSON.stringify(mockExecutionPlan)));
    const state = makeBaseState();
    const result = await generationPlannerAgent(state);

    expect(result.executionPlan).toBeDefined();
    expect(result.executionPlan!.screens).toEqual(mockExecutionPlan.screens);
    expect(result.executionPlan!.components).toEqual(mockExecutionPlan.components);
    expect(result.executionPlan!.priority).toBe('screens-first');
    expect(result.executionPlan!.estimatedDuration).toBe(180);
  });

  it('sets currentStep to GenerationPlannerAgent', async () => {
    setLLMClient(makeMockLLM(JSON.stringify(mockExecutionPlan)));
    const result = await generationPlannerAgent(makeBaseState());

    expect(result.currentStep).toBe('GenerationPlannerAgent');
  });

  it('emits a success log entry', async () => {
    setLLMClient(makeMockLLM(JSON.stringify(mockExecutionPlan)));
    const result = await generationPlannerAgent(makeBaseState());

    expect(result.logs).toHaveLength(1);
    expect(result.logs![0].level).toBe('success');
  });

  it('throws if the LLM returns invalid JSON', async () => {
    setLLMClient(makeMockLLM('not valid json'));
    await expect(generationPlannerAgent(makeBaseState())).rejects.toThrow();
  });

  it('includes screen and component counts in the log message', async () => {
    const plan = { screens: ['s1', 's2'], components: ['c1'], priority: 'screens-first' as const, estimatedDuration: 360 };
    setLLMClient(makeMockLLM(JSON.stringify(plan)));
    const result = await generationPlannerAgent(makeBaseState());

    expect(result.logs![0].message).toContain('2 screens');
    expect(result.logs![0].message).toContain('1 components');
  });
});
