import { describe, it, expect, beforeEach } from 'vitest';
import { irValidatorAgent } from '../../src/nodes/ir-validator.js';
import { setLLMClient } from '../../src/utils/llm-client.js';
import {
  makeBaseState,
  mockDesignIR,
  mockValidationResult,
  mockFailedValidationResult,
} from '../fixtures/mock-workflow-state.js';
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

describe('irValidatorAgent', () => {
  beforeEach(() => {
    setLLMClient(makeMockLLM(JSON.stringify(mockValidationResult)));
  });

  it('parses a valid LLM response into an IRValidationResult', async () => {
    const state = makeBaseState({ designIR: mockDesignIR });
    const result = await irValidatorAgent(state);

    expect(result.validationResult).toBeDefined();
    expect(result.validationResult!.valid).toBe(true);
    expect(result.validationResult!.score).toBe(90);
  });

  it('sets currentStep to IRValidatorAgent', async () => {
    const state = makeBaseState({ designIR: mockDesignIR });
    const result = await irValidatorAgent(state);

    expect(result.currentStep).toBe('IRValidatorAgent');
  });

  it('emits a success log when validation passes', async () => {
    const state = makeBaseState({ designIR: mockDesignIR });
    const result = await irValidatorAgent(state);

    expect(result.logs![0].level).toBe('success');
    expect(result.logs![0].message).toContain('90/100');
  });

  it('emits a warning log when validation fails', async () => {
    setLLMClient(makeMockLLM(JSON.stringify(mockFailedValidationResult)));
    const state = makeBaseState({ designIR: mockDesignIR, retryCount: 0 });
    const result = await irValidatorAgent(state);

    expect(result.logs![0].level).toBe('warning');
  });

  it('increments retryCount when validation fails', async () => {
    setLLMClient(makeMockLLM(JSON.stringify(mockFailedValidationResult)));
    const state = makeBaseState({ designIR: mockDesignIR, retryCount: 0 });
    const result = await irValidatorAgent(state);

    expect(result.retryCount).toBe(1);
  });

  it('does not increment retryCount when validation passes', async () => {
    const state = makeBaseState({ designIR: mockDesignIR, retryCount: 0 });
    const result = await irValidatorAgent(state);

    expect(result.retryCount).toBe(0);
  });

  it('throws when designIR is missing from state', async () => {
    const state = makeBaseState({ designIR: undefined });

    await expect(irValidatorAgent(state)).rejects.toThrow('DesignIR not available');
  });

  it('throws if the LLM returns invalid JSON', async () => {
    setLLMClient(makeMockLLM('not valid json'));
    const state = makeBaseState({ designIR: mockDesignIR });

    await expect(irValidatorAgent(state)).rejects.toThrow();
  });
});
