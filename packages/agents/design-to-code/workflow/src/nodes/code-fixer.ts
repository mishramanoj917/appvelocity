/**
 * Node 8 — CodeFixerAgent
 *
 * Applies auto-fixes to the CodeBundle and increments codeValidationRetryCount.
 *
 * React Native  →  prettier --write + eslint --fix  (via npx)
 * Flutter       →  Gemini LLM fix (primary) + dart format/fix (if dart CLI present)
 *
 * Strategy
 * ─────────
 * For Flutter, each Dart file that has reported issues is sent to Gemini with
 * the specific issue list so Gemini can apply targeted fixes. Gemini returns
 * the corrected Dart source which replaces the original file in the bundle.
 *
 * For React Native the existing deterministic tool chain is used unchanged.
 *
 * The retry counter is always incremented so the graph terminates even if
 * every fix attempt fails.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import type { WorkflowState, CodeBundle, LogEntry, CodeIssue } from '../types.js';
import type { CodeFile } from '@appvelocity/agent-design-to-code-generators';
import { createLLMClient } from '../utils/llm-client.js';
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
      return file;
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

function tryRun(cmd: string, cwd: string): { success: boolean; detail: string } {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    return { success: true, detail: cmd.split(' ')[0]! };
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0]! : String(err);
    return { success: false, detail: msg };
  }
}

// ─── React Native fixer ───────────────────────────────────────────────────────

function fixReactNative(bundle: CodeBundle, logs: LogEntry[]): CodeBundle['files'] {
  const tempDir = writeTempDir(bundle.files);
  try {
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

    return readBackFiles(tempDir, bundle.files);
  } finally {
    cleanupDir(tempDir);
  }
}

// ─── Flutter — Gemini LLM fixer ───────────────────────────────────────────────

/**
 * Groups reported issues by file path, then asks Gemini to fix each affected
 * Dart file. Files with no reported issues are returned unchanged.
 */
async function fixFlutterWithGemini(
  bundle: CodeBundle,
  allIssues: CodeIssue[],
  logs: LogEntry[],
): Promise<CodeBundle['files']> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const llm = createLLMClient();

  // Group issues by file path
  const issuesByFile = new Map<string, CodeIssue[]>();
  for (const issue of allIssues) {
    if (!issue.file) continue;
    const key = issue.file;
    if (!issuesByFile.has(key)) issuesByFile.set(key, []);
    issuesByFile.get(key)!.push(issue);
  }

  const result: CodeFile[] = [...bundle.files];

  // If no issues were reported, do a general quality pass on dart source files
  const filesToFix: Array<{ file: CodeFile; issues: CodeIssue[] }> = [];

  if (issuesByFile.size === 0) {
    // No specific issues — do a general formatting/quality pass
    const dartFiles = bundle.files.filter(
      (f) => f.path.endsWith('.dart') && !f.path.includes('assets'),
    );
    for (const f of dartFiles.slice(0, 5)) {
      filesToFix.push({ file: f, issues: [] });
    }
  } else {
    // Fix only files that have reported issues
    for (const [filePath, issues] of issuesByFile) {
      // Match by path suffix (validator may return relative paths)
      const file = bundle.files.find(
        (f) => f.path === filePath || f.path.endsWith(filePath),
      );
      if (file) filesToFix.push({ file, issues });
    }
  }

  let fixedCount = 0;

  for (const { file, issues } of filesToFix) {
    const issueList =
      issues.length > 0
        ? issues.map((i) => `  - Line ${i.line ?? '?'}: [${i.type}] ${i.message}`).join('\n')
        : '  - Apply general formatting, const usage, and style improvements';

    try {
      const response = await llm.chat({
        model,
        system: `You are a Flutter/Dart expert. Fix the following Dart source file according to the listed issues.
Return ONLY the corrected Dart source code. No markdown fences, no explanations, no comments about changes.`,
        messages: [
          {
            role: 'user',
            content: `Issues to fix in ${file.path}:\n${issueList}\n\nCurrent file content:\n\n${file.content}`,
          },
        ],
        max_tokens: 4096,
      });

      const fixed = response.content.trim();
      if (fixed.length > 50) {
        const idx = result.findIndex((f) => f.path === file.path);
        if (idx >= 0) {
          result[idx] = { ...file, content: fixed };
          fixedCount++;
        }
      }
    } catch (err) {
      logs.push(makeLogEntry('warning', `Gemini fix skipped for ${file.path}: ${String(err)}`));
    }
  }

  if (fixedCount > 0) {
    logs.push(makeLogEntry('success', `Gemini fixed ${fixedCount} Flutter file(s)`));
  }

  return result;
}

// ─── Flutter — dart CLI fixer (supplement when available) ────────────────────

function tryFixFlutterWithDartCLI(
  bundle: CodeBundle,
  logs: LogEntry[],
): CodeBundle['files'] | null {
  try {
    execSync('dart --version', { stdio: 'pipe' });
  } catch {
    return null; // dart not installed
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

  let fixedFiles: CodeBundle['files'];

  if (bundle.framework === 'react-native') {
    fixedFiles = fixReactNative(bundle, logs);
  } else {
    // Flutter: Gemini LLM fix is the primary path
    const allIssues = [
      ...(state.codeValidationResult?.fixableIssues ?? []),
      ...(state.codeValidationResult?.criticalIssues ?? []),
    ];

    try {
      fixedFiles = await fixFlutterWithGemini(bundle, allIssues, logs);
    } catch (err) {
      logs.push(makeLogEntry('warning', `Gemini fixer error — ${String(err)}`));
      fixedFiles = bundle.files;
    }

    // Also apply dart CLI formatting if available (idempotent, safe to run after Gemini)
    const dartFixed = tryFixFlutterWithDartCLI({ ...bundle, files: fixedFiles }, logs);
    if (dartFixed) {
      fixedFiles = dartFixed;
    } else {
      logs.push(makeLogEntry('info', 'dart CLI not found — Gemini-only fixes applied'));
    }
  }

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
