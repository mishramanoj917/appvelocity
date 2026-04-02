import { describe, it, expect, vi } from 'vitest';
import { irBuilderAgent } from '../../src/nodes/ir-builder.js';
import {
  makeBaseState,
  mockFigmaFile,
  mockDesignIR,
} from '../fixtures/mock-workflow-state.js';

vi.mock('@appvelocity/agent-design-to-code-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@appvelocity/agent-design-to-code-core')>();
  return {
    ...actual,
    IRBuilder: vi.fn(() => ({
      build: vi.fn().mockReturnValue(mockDesignIR),
    })),
  };
});

describe('irBuilderAgent', () => {
  it('produces a DesignIR in state', async () => {
    const state = makeBaseState({ figmaFile: mockFigmaFile });
    const result = await irBuilderAgent(state);

    expect(result.designIR).toBeDefined();
    expect(result.designIR!.fileKey).toBe('abc1234567890');
  });

  it('sets currentStep to IRBuilderAgent', async () => {
    const state = makeBaseState({ figmaFile: mockFigmaFile });
    const result = await irBuilderAgent(state);

    expect(result.currentStep).toBe('IRBuilderAgent');
  });

  it('emits a success log with counts', async () => {
    const state = makeBaseState({ figmaFile: mockFigmaFile });
    const result = await irBuilderAgent(state);

    expect(result.logs).toHaveLength(1);
    expect(result.logs![0].level).toBe('success');
    expect(result.logs![0].message).toContain('screens');
  });

  it('throws when figmaFile is missing from state', async () => {
    const state = makeBaseState({ figmaFile: undefined });

    await expect(irBuilderAgent(state)).rejects.toThrow('FigmaFile not available');
  });

  it('passes variablesResponse to IRBuilder.build when present', async () => {
    const { IRBuilder } = await import('@appvelocity/agent-design-to-code-core');
    const mockBuild = vi.fn().mockReturnValue(mockDesignIR);
    vi.mocked(IRBuilder).mockImplementationOnce(
      () => ({ build: mockBuild }) as unknown as InstanceType<typeof IRBuilder>
    );

    const fakeVars = { meta: { variables: {}, variableCollections: {} } } as never;
    const state = makeBaseState({ figmaFile: mockFigmaFile, variablesResponse: fakeVars });
    await irBuilderAgent(state);

    expect(mockBuild).toHaveBeenCalledWith(mockFigmaFile, 'abc1234567890', fakeVars);
  });
});
