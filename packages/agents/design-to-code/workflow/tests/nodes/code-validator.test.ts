import { describe, it, expect, vi, beforeEach } from 'vitest';
import { codeValidatorAgent } from '../../src/nodes/code-validator.js';
import {
  makeBaseState,
  mockCodeBundle,
} from '../fixtures/mock-workflow-state.js';
import type { CodeBundle } from '../../src/types.js';

// ─── Mock @babel/parser ───────────────────────────────────────────────────────
// By default the mock parser succeeds. Individual tests override it to throw.

const mockParse = vi.fn();

vi.mock('@babel/parser', () => ({
  parse: (...args: unknown[]) => mockParse(...args),
}));

// ─── Mock node:child_process (used by Flutter path) ──────────────────────────

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''), // dart --version succeeds by default
}));

// ─── Mock node:fs (temp dir operations) ──────────────────────────────────────

vi.mock('node:fs', () => ({
  mkdtempSync:   vi.fn(() => '/tmp/appvelocity-validate-test'),
  writeFileSync: vi.fn(),
  mkdirSync:     vi.fn(),
  rmSync:        vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────

function makeBundleWithContent(
  content: string,
  framework: CodeBundle['framework'] = 'react-native',
): CodeBundle {
  return {
    framework,
    files: [{ path: 'src/screens/HomeScreen.tsx', content, language: 'typescript' }],
    assets: [],
    dependencies: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('codeValidatorAgent', () => {
  beforeEach(() => {
    mockParse.mockReset();
    mockParse.mockReturnValue({}); // default: parse succeeds
  });

  it('throws when generatedCode is missing', async () => {
    const state = makeBaseState();
    await expect(codeValidatorAgent(state)).rejects.toThrow('CodeBundle');
  });

  it('sets currentStep to CodeValidatorAgent', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeValidatorAgent(state);
    expect(result.currentStep).toBe('CodeValidatorAgent');
  });

  it('returns valid result when all files parse cleanly', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeValidatorAgent(state);
    expect(result.codeValidationResult?.valid).toBe(true);
    expect(result.codeValidationResult?.criticalIssues).toHaveLength(0);
  });

  it('reports a critical syntax issue when @babel/parser throws', async () => {
    const parseError = Object.assign(new SyntaxError('Unexpected token (5:1)'), {
      loc: { line: 5, column: 1 },
    });
    mockParse.mockImplementation(() => { throw parseError; });

    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeValidatorAgent(state);

    expect(result.codeValidationResult?.valid).toBe(false);
    expect(result.codeValidationResult?.criticalIssues).toHaveLength(
      mockCodeBundle.files.length, // one per .ts/.tsx file
    );
    expect(result.codeValidationResult?.criticalIssues[0]!.fixable).toBe(false);
    expect(result.codeValidationResult?.criticalIssues[0]!.type).toBe('syntax');
  });

  it('reports a fixable format issue for lines > 120 characters', async () => {
    const longLine = 'const x = ' + 'a'.repeat(120) + ';';
    const bundle = makeBundleWithContent(`import React from 'react';\n${longLine}\n`);
    const state = makeBaseState({ generatedCode: bundle });
    const result = await codeValidatorAgent(state);

    const fixable = result.codeValidationResult?.fixableIssues ?? [];
    expect(fixable.some((i) => i.type === 'format' && i.message.includes('120'))).toBe(true);
  });

  it('reports a fixable format issue for mixed tabs and spaces', async () => {
    const mixedIndent = 'function foo() {\n\t  return 1;\n}';
    const bundle = makeBundleWithContent(mixedIndent);
    const state = makeBaseState({ generatedCode: bundle });
    const result = await codeValidatorAgent(state);

    const fixable = result.codeValidationResult?.fixableIssues ?? [];
    expect(fixable.some((i) => i.message.toLowerCase().includes('mixed'))).toBe(true);
  });

  it('skips non-TS/JSX files (e.g. .json, .md)', async () => {
    const bundle: CodeBundle = {
      framework: 'react-native',
      files: [
        { path: 'package.json', content: '{"name":"app"}', language: 'json' },
        { path: 'README.md',    content: '# App',          language: 'markdown' },
      ],
      assets: [],
      dependencies: {},
    };
    const state = makeBaseState({ generatedCode: bundle });
    const result = await codeValidatorAgent(state);
    // parser should never have been called for non-JS/TS files
    expect(mockParse).not.toHaveBeenCalled();
    expect(result.codeValidationResult?.valid).toBe(true);
  });

  it('emits a success log when code is clean', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeValidatorAgent(state);
    expect(result.logs![0]!.level).toBe('success');
    expect(result.logs![0]!.message).toContain('clean');
  });

  it('emits a warning log when critical issues are found', async () => {
    mockParse.mockImplementation(() => { throw new SyntaxError('bad'); });
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeValidatorAgent(state);
    expect(result.logs![0]!.level).toBe('warning');
  });

  it('includes attempt number in log when retryCount > 0', async () => {
    const state = makeBaseState({
      generatedCode: mockCodeBundle,
      codeValidationRetryCount: 1,
    });
    const result = await codeValidatorAgent(state);
    expect(result.logs![0]!.message).toContain('attempt 2');
  });

  it('populates checkedFiles count in the result', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeValidatorAgent(state);
    expect(result.codeValidationResult?.checkedFiles).toBe(mockCodeBundle.files.length);
  });

  it('does not increment codeValidationRetryCount (that is the fixer\'s job)', async () => {
    const state = makeBaseState({
      generatedCode: mockCodeBundle,
      codeValidationRetryCount: 1,
    });
    const result = await codeValidatorAgent(state);
    // Validator does not touch the retry counter — it must be absent from the
    // partial update so the graph annotation keeps the existing value.
    expect(result.codeValidationRetryCount).toBeUndefined();
  });
});
