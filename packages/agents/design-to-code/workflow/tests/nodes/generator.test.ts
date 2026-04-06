import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatorAgent } from '../../src/nodes/generator.js';
import {
  makeBaseState,
  mockDesignIR,
  mockExecutionPlan,
  mockCodeBundle,
} from '../fixtures/mock-workflow-state.js';

// ─── Mock the generators package ─────────────────────────────────────────────

const mockGenerate = vi.fn().mockReturnValue({
  bundle:   mockCodeBundle,
  warnings: [],
  stats: { screenCount: 1, componentCount: 0, assetCount: 0, fileCount: 2 },
});

vi.mock('@appvelocity/agent-design-to-code-generators', () => ({
  ReactNativeGenerator: vi.fn(() => ({ generate: mockGenerate })),
  FlutterGenerator:     vi.fn(() => ({ generate: mockGenerate })),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('generatorAgent', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it('throws when designIR is missing', async () => {
    const state = makeBaseState({ executionPlan: mockExecutionPlan });
    await expect(generatorAgent(state)).rejects.toThrow('DesignIR');
  });

  it('throws when executionPlan is missing', async () => {
    const state = makeBaseState({ designIR: mockDesignIR });
    await expect(generatorAgent(state)).rejects.toThrow('ExecutionPlan');
  });

  it('calls ReactNativeGenerator when targetFramework is react-native', async () => {
    const { ReactNativeGenerator } = await import('@appvelocity/agent-design-to-code-generators');
    const state = makeBaseState({ designIR: mockDesignIR, executionPlan: mockExecutionPlan });
    await generatorAgent(state);
    expect(vi.mocked(ReactNativeGenerator)).toHaveBeenCalled();
  });

  it('calls FlutterGenerator when targetFramework is flutter', async () => {
    const { FlutterGenerator } = await import('@appvelocity/agent-design-to-code-generators');
    const state = makeBaseState({
      targetFramework: 'flutter',
      designIR: mockDesignIR,
      executionPlan: mockExecutionPlan,
    });
    await generatorAgent(state);
    expect(vi.mocked(FlutterGenerator)).toHaveBeenCalled();
  });

  it('sets generatedCode in returned state', async () => {
    const state = makeBaseState({ designIR: mockDesignIR, executionPlan: mockExecutionPlan });
    const result = await generatorAgent(state);
    expect(result.generatedCode).toMatchObject({
      framework: 'react-native',
      files: expect.any(Array),
      assets: expect.any(Array),
      dependencies: expect.any(Object),
    });
  });

  it('sets currentStep to GeneratorAgent', async () => {
    const state = makeBaseState({ designIR: mockDesignIR, executionPlan: mockExecutionPlan });
    const result = await generatorAgent(state);
    expect(result.currentStep).toBe('GeneratorAgent');
  });

  it('emits a success log with file count', async () => {
    const state = makeBaseState({ designIR: mockDesignIR, executionPlan: mockExecutionPlan });
    const result = await generatorAgent(state);
    const levels = result.logs!.map((l) => l.level);
    expect(levels).toContain('success');
    expect(result.logs![0]!.message).toMatch(/2 files/);
  });

  it('emits one warning log per GeneratorResult.warnings entry', async () => {
    mockGenerate.mockReturnValueOnce({
      bundle:   mockCodeBundle,
      warnings: ['unsupported element type', 'missing alt text'],
      stats: { screenCount: 1, componentCount: 0, assetCount: 0, fileCount: 2 },
    });
    const state = makeBaseState({ designIR: mockDesignIR, executionPlan: mockExecutionPlan });
    const result = await generatorAgent(state);
    const warnings = result.logs!.filter((l) => l.level === 'warning');
    expect(warnings).toHaveLength(2);
  });

  it('passes GenerationScope derived from executionPlan', async () => {
    const state = makeBaseState({ designIR: mockDesignIR, executionPlan: mockExecutionPlan });
    await generatorAgent(state);
    const [_ir, scope] = mockGenerate.mock.calls[0] as [unknown, { screens: string[]; priority: string }];
    expect(scope.screens).toEqual(mockExecutionPlan.screens);
    expect(scope.priority).toBe(mockExecutionPlan.priority);
  });

  it('passes options.includeTests through to generator', async () => {
    const state = makeBaseState({
      designIR: mockDesignIR,
      executionPlan: mockExecutionPlan,
      options: { includeTests: true },
    });
    await generatorAgent(state);
    const [_ir, _scope, opts] = mockGenerate.mock.calls[0] as [unknown, unknown, { includeTests?: boolean }];
    expect(opts?.includeTests).toBe(true);
  });
});
