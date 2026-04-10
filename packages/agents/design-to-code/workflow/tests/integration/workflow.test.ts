/**
 * Integration test — exercises the full LangGraph workflow with mocked
 * external dependencies (FigmaClient + LLM).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setLLMClient } from '../../src/utils/llm-client.js';
import {
  mockFigmaFile,
  mockDesignIR,
  mockExecutionPlan,
  mockValidationResult,
  mockFailedValidationResult,
  VALID_FIGMA_URL,
} from '../fixtures/mock-workflow-state.js';
import type { LLMClient, WorkflowState } from '../../src/types.js';

// Mock FigmaClient so no real HTTP calls are made
vi.mock('@appvelocity/agent-design-to-code-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@appvelocity/agent-design-to-code-core')>();
  return {
    ...actual,
    FigmaClient: vi.fn(() => ({
      getFile: vi.fn().mockResolvedValue(mockFigmaFile),
      getLocalVariables: vi.fn().mockResolvedValue({
        status: 200,
        error: false,
        meta: { variables: {}, variableCollections: {} },
      }),
    })),
    IRBuilder: vi.fn(() => ({
      build: vi.fn().mockReturnValue(mockDesignIR),
    })),
  };
});

function makeLLMForSequence(responses: string[]): LLMClient {
  let callCount = 0;
  return {
    chat: async () => ({
      content: responses[callCount++ % responses.length]!,
      model: 'mock',
      inputTokens: 10,
      outputTokens: 20,
    }),
  };
}

describe('compiledWorkflow (integration)', () => {
  beforeEach(() => {
    process.env.FIGMA_ACCESS_TOKEN = 'test-token';
  });

  it('runs the happy path: valid input → DesignIR → validation passes', async () => {
    setLLMClient(
      makeLLMForSequence([
        JSON.stringify(mockExecutionPlan),  // generationPlanner
        JSON.stringify(mockValidationResult), // irValidator
      ])
    );

    const { compiledWorkflow } = await import('../../src/graph.js');

    const initialState: Partial<WorkflowState> = {
      figmaUrl: VALID_FIGMA_URL,
      targetFramework: 'react-native',
      options: { verbose: true },
    };

    const result = await compiledWorkflow.invoke(initialState);

    expect(result.errors).toHaveLength(0);
    expect(result.designIR).toBeDefined();
    expect(result.validationResult?.valid).toBe(true);
    // Pipeline now ends at codeValidator (after codeGenerator)
    expect(result.currentStep).toBe('CodeValidatorAgent');
  });

  it('exits early on invalid input (missing token)', async () => {
    delete process.env.FIGMA_ACCESS_TOKEN;
    setLLMClient(makeLLMForSequence([JSON.stringify(mockExecutionPlan)]));

    const { compiledWorkflow } = await import('../../src/graph.js');

    const result = await compiledWorkflow.invoke({
      figmaUrl: VALID_FIGMA_URL,
      targetFramework: 'react-native' as const,
      options: {},
    });

    // Should stop at inputValidator — no figmaFile, no designIR
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.figmaFile).toBeUndefined();
    expect(result.currentStep).toBe('InputValidator');
  });

  it('retries irBuilder when critic fails (once)', async () => {
    setLLMClient(
      makeLLMForSequence([
        JSON.stringify(mockExecutionPlan),       // generationPlanner
        JSON.stringify(mockFailedValidationResult), // irValidator call 1 → retry
        JSON.stringify(mockValidationResult),    // irValidator call 2 → pass
      ])
    );

    const { compiledWorkflow } = await import('../../src/graph.js');

    const result = await compiledWorkflow.invoke({
      figmaUrl: VALID_FIGMA_URL,
      targetFramework: 'react-native' as const,
      options: {},
    });

    // retryCount is 1 (incremented once by critic on first failure)
    expect(result.retryCount).toBe(1);
    expect(result.validationResult?.valid).toBe(true);
  });

  it('exits after max 2 retries when critic keeps failing', async () => {
    setLLMClient(
      makeLLMForSequence([
        JSON.stringify(mockExecutionPlan),          // generationPlanner
        JSON.stringify(mockFailedValidationResult), // irValidator 1
        JSON.stringify(mockFailedValidationResult), // irValidator 2
        JSON.stringify(mockFailedValidationResult), // irValidator 3 (after retry 2)
      ])
    );

    const { compiledWorkflow } = await import('../../src/graph.js');

    const result = await compiledWorkflow.invoke({
      figmaUrl: VALID_FIGMA_URL,
      targetFramework: 'react-native' as const,
      options: {},
    });

    expect(result.retryCount).toBeGreaterThanOrEqual(2);
    expect(result.validationResult?.valid).toBe(false);
    expect(result.generatedCode).toBeUndefined();
  });

  it('accumulates logs from all nodes', async () => {
    setLLMClient(
      makeLLMForSequence([
        JSON.stringify(mockExecutionPlan),
        JSON.stringify(mockValidationResult),
      ])
    );

    const { compiledWorkflow } = await import('../../src/graph.js');

    const result = await compiledWorkflow.invoke({
      figmaUrl: VALID_FIGMA_URL,
      targetFramework: 'react-native' as const,
      options: {},
    });

    // Should have logs from: inputValidator, figmaFetcher, generationPlanner, irBuilder, irValidator, codeGenerator, codeValidator
    expect(result.logs.length).toBeGreaterThanOrEqual(6);
  });
});
