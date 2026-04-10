/**
 * Node 8 — CodeFixerAgent
 *
 * Applies deterministic auto-fixes to the CodeBundle and increments
 * codeValidationRetryCount so the graph knows when to stop looping.
 *
 * React Native  →  prettier --write  (via npx; best-effort)
 * Flutter       →  dart format . && dart fix --apply  (via CLI)
 *
 * Strategy
 * ─────────
 * 1. Write the in-memory CodeBundle to a temporary directory.
 * 2. Run the framework's formatting / lint-fix tools against that directory.
 * 3. Read the (now-modified) files back from disk.
 * 4. Return an updated CodeBundle containing the fixed file contents.
 * 5. Increment codeValidationRetryCount so the graph routing knows how many
 *    auto-fix cycles have been attempted.
 *
 * If any tool is not installed the node logs a warning and returns the bundle
 * unchanged — the validation loop still terminates because the retry counter
 * is always incremented.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import type { WorkflowState, CodeBundle, LogEntry } from '../types.js';
import { makeLogEntry } from '../utils/logger.js';

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function writeTempDir(files: CodeBundle['files']): string {
  const dir = mkdtempSync(join(tmpdir(), 'appvelocity-fix-'));
  for (const file of files) {
    const dest = join(dir, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content, 'utf-8');
  }
  return dir;
}

function readBackFiles(dir: string, originals: CodeBundle['files']): CodeBundle['files'] {
  return originals.map((file) => {
    try {
      const content = readFileSync(join(dir, file.path), 'utf-8');
      return { ...file, content };
    } catch {
      return file; // tool may not have touched this file — keep original
    }
  });
}

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

/** Run a shell command in `cwd`. Returns success flag + human-readable detail. */
function tryRun(
  cmd: string,
  cwd: string,
): { success: boolean; detail: string } {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    return { success: true, detail: cmd.split(' ')[0]! };
  } catch (err) {
    const msg = err instanceof Error
      ? err.message.split('\n')[0]!
      : String(err);
    return { success: false, detail: msg };
  }
}

// ─── React Native fixer ───────────────────────────────────────────────────────

/**
 * prettier --write  fixes:
 *   - trailing commas, semicolons, quote style
 *   - indentation / mixed tabs+spaces
 *   - lines exceeding printWidth (120)
 *   - blank-line normalisation
 *
 * eslint --fix  fixes (best-effort with minimal inline config):
 *   - no-unused-vars, eqeqeq, prefer-const, no-extra-semi
 *
 * Both tools are invoked via npx so they work without global installs.
 */
function fixReactNative(bundle: CodeBundle, logs: LogEntry[]): CodeBundle['files'] {
  const tempDir = writeTempDir(bundle.files);
  try {
    // ── prettier ────────────────────────────────────────────────────────────
    const prettierGlob = '"src/**/*.{ts,tsx,js,jsx}"';
    const prettier = tryRun(
      `npx --yes prettier --write --print-width 120 --single-quote --trailing-comma all ${prettierGlob}`,
      tempDir,
    );
    if (prettier.success) {
      logs.push(makeLogEntry('info', 'prettier --write applied'));
    } else {
      logs.push(makeLogEntry('warning', `prettier unavailable — ${prettier.detail}`));
    }

    // ── eslint --fix (best-effort) ───────────────────────────────────────────
    // Write a minimal inline config so eslint does not search parent dirs
    const eslintConfig = JSON.stringify({
      env: { es2020: true },
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      rules: {
        'no-extra-semi': 'warn',
        'prefer-const': 'warn',
        eqeqeq: 'warn',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    });
    writeFileSync(join(tempDir, '.eslintrc.json'), eslintConfig, 'utf-8');
    const eslint = tryRun(
      `npx --yes eslint --fix --ext .ts,.tsx,.js,.jsx src/`,
      tempDir,
    );
    if (eslint.success) {
      logs.push(makeLogEntry('info', 'eslint --fix applied'));
    }
    // ESLint failure is silently ignored — prettier already covered the main issues

    return readBackFiles(tempDir, bundle.files);
  } finally {
    cleanupDir(tempDir);
  }
}

// ─── Flutter fixer ────────────────────────────────────────────────────────────

/**
 * dart format .  fixes:
 *   - indentation, trailing commas, line length
 *
 * dart fix --apply  fixes:
 *   - prefer_const_constructors, unnecessary_new, avoid_print, etc.
 */
function fixFlutter(bundle: CodeBundle, logs: LogEntry[]): CodeBundle['files'] {
  try {
    execSync('dart --version', { stdio: 'pipe' });
  } catch {
    logs.push(makeLogEntry('warning', 'dart CLI not found — skipping Flutter auto-fix'));
    return bundle.files;
  }

  const tempDir = writeTempDir(bundle.files);
  try {
    const format = tryRun('dart format .', tempDir);
    if (format.success) {
      logs.push(makeLogEntry('info', 'dart format applied'));
    } else {
      logs.push(makeLogEntry('warning', `dart format failed — ${format.detail}`));
    }

    const fix = tryRun('dart fix --apply', tempDir);
    if (fix.success) {
      logs.push(makeLogEntry('info', 'dart fix --apply applied'));
    } else {
      logs.push(makeLogEntry('warning', `dart fix --apply failed — ${fix.detail}`));
    }

    return readBackFiles(tempDir, bundle.files);
  } finally {
    cleanupDir(tempDir);
  }
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function codeFixerAgent(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  if (!state.generatedCode) {
    throw new Error(
      'CodeBundle not available. CodeGeneratorAgent must run before CodeFixerAgent.',
    );
  }

  const bundle = state.generatedCode;
  const newRetryCount = state.codeValidationRetryCount + 1;
  const logs: LogEntry[] = [
    makeLogEntry('info', `Auto-fix attempt ${newRetryCount} — ${bundle.framework} (${bundle.files.length} files)`),
  ];

  const fixedFiles =
    bundle.framework === 'react-native'
      ? fixReactNative(bundle, logs)
      : fixFlutter(bundle, logs);

  const changedCount = fixedFiles.filter(
    (f, i) => f.content !== bundle.files[i]?.content,
  ).length;

  logs.push(
    makeLogEntry(
      changedCount > 0 ? 'success' : 'info',
      `Auto-fix complete — ${changedCount} file(s) modified`,
    ),
  );

  return {
    generatedCode: { ...bundle, files: fixedFiles },
    codeValidationRetryCount: newRetryCount,
    currentStep: 'CodeFixerAgent',
    logs,
  };
}
