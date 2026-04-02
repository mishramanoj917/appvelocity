import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inputValidator } from '../../src/nodes/input-validator.js';
import { makeBaseState } from '../fixtures/mock-workflow-state.js';

describe('inputValidator', () => {
  const originalToken = process.env.FIGMA_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.FIGMA_ACCESS_TOKEN = 'test-token';
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.FIGMA_ACCESS_TOKEN;
    } else {
      process.env.FIGMA_ACCESS_TOKEN = originalToken;
    }
  });

  it('passes with a valid Figma URL, token, and framework', async () => {
    const state = makeBaseState();
    const result = await inputValidator(state);

    expect(result.errors).toHaveLength(0);
    expect(result.currentStep).toBe('InputValidator');
    expect(result.logs).toHaveLength(1);
    expect(result.logs![0].level).toBe('success');
  });

  it('returns error for a URL without figma.com domain', async () => {
    const state = makeBaseState({ figmaUrl: 'https://example.com/design/abc' });
    const result = await inputValidator(state);

    const codes = result.errors!.map((e) => e.code);
    expect(codes).toContain('INVALID_FIGMA_URL');
  });

  it('returns error for a completely malformed URL', async () => {
    const state = makeBaseState({ figmaUrl: 'not-a-url' });
    const result = await inputValidator(state);

    expect(result.errors!.some((e) => e.code === 'INVALID_FIGMA_URL')).toBe(true);
  });

  it('returns error when FIGMA_ACCESS_TOKEN is not set', async () => {
    delete process.env.FIGMA_ACCESS_TOKEN;
    const state = makeBaseState();
    const result = await inputValidator(state);

    expect(result.errors!.some((e) => e.code === 'MISSING_FIGMA_TOKEN')).toBe(true);
  });

  it('returns error for an unsupported framework', async () => {
    const state = makeBaseState({
      targetFramework: 'angular' as 'react-native',
    });
    const result = await inputValidator(state);

    expect(result.errors!.some((e) => e.code === 'INVALID_FRAMEWORK')).toBe(true);
  });

  it('accumulates multiple errors at once', async () => {
    delete process.env.FIGMA_ACCESS_TOKEN;
    const state = makeBaseState({
      figmaUrl: 'bad-url',
      targetFramework: 'angular' as 'react-native',
    });
    const result = await inputValidator(state);

    expect(result.errors!.length).toBeGreaterThanOrEqual(2);
    expect(result.logs![0].level).toBe('error');
  });

  it('all returned errors are non-recoverable', async () => {
    const state = makeBaseState({ figmaUrl: 'bad-url' });
    const result = await inputValidator(state);

    result.errors!.forEach((e) => {
      expect(e.recoverable).toBe(false);
    });
  });

  it('accepts a bare Figma file key as figmaUrl', async () => {
    const state = makeBaseState({ figmaUrl: 'abc1234567890XYZ' });
    const result = await inputValidator(state);

    expect(result.errors!.some((e) => e.code === 'INVALID_FIGMA_URL')).toBe(false);
  });

  it('accepts flutter as a valid target framework', async () => {
    const state = makeBaseState({ targetFramework: 'flutter' });
    const result = await inputValidator(state);

    expect(result.errors!.some((e) => e.code === 'INVALID_FRAMEWORK')).toBe(false);
  });
});
