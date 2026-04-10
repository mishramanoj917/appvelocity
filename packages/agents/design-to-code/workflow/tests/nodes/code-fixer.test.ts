import { describe, it, expect, vi, beforeEach } from 'vitest';
import { codeFixerAgent } from '../../src/nodes/code-fixer.js';
import {
  makeBaseState,
  mockCodeBundle,
} from '../fixtures/mock-workflow-state.js';
import type { CodeBundle } from '../../src/types.js';

// ─── Mock node:child_process ──────────────────────────────────────────────────

const mockExecSync = vi.fn(() => '');

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// ─── Mock node:fs ─────────────────────────────────────────────────────────────
// writeFileSync / mkdirSync / mkdtempSync are no-ops.
// readFileSync returns a sentinel string so we can detect "file was read back".

const FIXED_CONTENT = '// fixed content';
const mockReadFileSync = vi.fn(() => FIXED_CONTENT);

vi.mock('node:fs', () => ({
  mkdtempSync:   vi.fn(() => '/tmp/appvelocity-fix-test'),
  writeFileSync: vi.fn(),
  mkdirSync:     vi.fn(),
  readFileSync:  (...args: unknown[]) => mockReadFileSync(...args),
  rmSync:        vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────

function flutterBundle(): CodeBundle {
  return {
    framework: 'flutter',
    files: [{ path: 'lib/main.dart', content: 'void main() {}', language: 'dart' }],
    assets: [],
    dependencies: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('codeFixerAgent', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
    mockExecSync.mockReturnValue(''); // tools succeed by default
    mockReadFileSync.mockReturnValue(FIXED_CONTENT);
  });

  it('throws when generatedCode is missing', async () => {
    const state = makeBaseState();
    await expect(codeFixerAgent(state)).rejects.toThrow('CodeBundle');
  });

  it('sets currentStep to CodeFixerAgent', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeFixerAgent(state);
    expect(result.currentStep).toBe('CodeFixerAgent');
  });

  it('increments codeValidationRetryCount', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle, codeValidationRetryCount: 0 });
    const result = await codeFixerAgent(state);
    expect(result.codeValidationRetryCount).toBe(1);
  });

  it('increments codeValidationRetryCount from existing value', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle, codeValidationRetryCount: 1 });
    const result = await codeFixerAgent(state);
    expect(result.codeValidationRetryCount).toBe(2);
  });

  it('returns an updated CodeBundle with fixed file contents', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeFixerAgent(state);
    // readFileSync mock returns FIXED_CONTENT for every file
    expect(result.generatedCode?.files.every((f) => f.content === FIXED_CONTENT)).toBe(true);
  });

  it('preserves framework and dependencies in the returned bundle', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeFixerAgent(state);
    expect(result.generatedCode?.framework).toBe(mockCodeBundle.framework);
    expect(result.generatedCode?.dependencies).toEqual(mockCodeBundle.dependencies);
  });

  it('calls prettier for react-native bundles', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    await codeFixerAgent(state);
    const cmds = mockExecSync.mock.calls.map(([cmd]) => String(cmd));
    expect(cmds.some((c) => c.includes('prettier'))).toBe(true);
  });

  it('calls dart format for flutter bundles', async () => {
    const state = makeBaseState({ generatedCode: flutterBundle() });
    await codeFixerAgent(state);
    const cmds = mockExecSync.mock.calls.map(([cmd]) => String(cmd));
    expect(cmds.some((c) => c.includes('dart format'))).toBe(true);
  });

  it('calls dart fix --apply for flutter bundles', async () => {
    const state = makeBaseState({ generatedCode: flutterBundle() });
    await codeFixerAgent(state);
    const cmds = mockExecSync.mock.calls.map(([cmd]) => String(cmd));
    expect(cmds.some((c) => c.includes('dart fix'))).toBe(true);
  });

  it('logs a warning when dart CLI is not found', async () => {
    // First execSync call is `dart --version` — make it fail
    mockExecSync.mockImplementationOnce(() => { throw new Error('not found'); });
    const state = makeBaseState({ generatedCode: flutterBundle() });
    const result = await codeFixerAgent(state);
    const warnings = result.logs!.filter((l) => l.level === 'warning');
    expect(warnings.some((w) => w.message.includes('dart CLI not found'))).toBe(true);
  });

  it('logs a warning when prettier is unavailable (npx fails)', async () => {
    // dart --version is not called for RN; prettier call fails
    mockExecSync.mockImplementationOnce(() => { throw new Error('prettier: command not found'); });
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeFixerAgent(state);
    const warnings = result.logs!.filter((l) => l.level === 'warning');
    expect(warnings.some((w) => w.message.includes('prettier unavailable'))).toBe(true);
  });

  it('emits a success log when files are modified', async () => {
    // mockReadFileSync returns FIXED_CONTENT which differs from original '// HomeScreen'
    const state = makeBaseState({ generatedCode: mockCodeBundle });
    const result = await codeFixerAgent(state);
    const successLogs = result.logs!.filter((l) => l.level === 'success');
    expect(successLogs.length).toBeGreaterThan(0);
  });

  it('emits info log with attempt number', async () => {
    const state = makeBaseState({ generatedCode: mockCodeBundle, codeValidationRetryCount: 0 });
    const result = await codeFixerAgent(state);
    expect(result.logs![0]!.message).toContain('attempt 1');
  });

  it('falls back gracefully when dart format fails', async () => {
    // dart --version succeeds, dart format fails, dart fix fails
    mockExecSync
      .mockReturnValueOnce('') // dart --version
      .mockImplementationOnce(() => { throw new Error('format error'); }) // dart format
      .mockImplementationOnce(() => { throw new Error('fix error'); });   // dart fix
    const state = makeBaseState({ generatedCode: flutterBundle() });
    // Should not throw even when tools fail
    const result = await codeFixerAgent(state);
    expect(result.codeValidationRetryCount).toBe(1);
  });
});
