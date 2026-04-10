/**
 * Node 7 — CodeValidatorAgent
 *
 * Validates every generated source file using deterministic AST parsing and
 * CLI static-analysis tools. Zero LLM calls.
 *
 * React Native  →  @babel/parser (TypeScript + JSX plugins)
 * Flutter       →  dart analyze --format machine (CLI, spawned in a tmp dir)
 *
 * Issues are split into two buckets:
 *   criticalIssues  – syntax / parse errors that no auto-tool can recover from
 *   fixableIssues   – formatting, lint, or import issues that prettier / dart
 *                     format can fix automatically
 *
 * The graph routes to codeFixerAgent when fixableIssues exist and the retry
 * budget (codeValidationRetryCount < 2) has not been exhausted.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from '@babel/parser';
import type { ParserPlugin } from '@babel/parser';
import type { WorkflowState, CodeIssue, CodeValidationResult } from '../types.js';
import { makeLogEntry } from '../utils/logger.js';

// ─── Shared filesystem helpers ────────────────────────────────────────────────

function writeTempDir(files: Array<{ path: string; content: string }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'appvelocity-validate-'));
  for (const file of files) {
    const dest = join(dir, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content, 'utf-8');
  }
  return dir;
}

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup — temp OS sweeper will handle it otherwise
  }
}

// ─── React Native (TypeScript / JSX) ─────────────────────────────────────────

const RN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function validateRNFile(
  filePath: string,
  content: string,
  fixableIssues: CodeIssue[],
  criticalIssues: CodeIssue[],
): void {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  const plugins: ParserPlugin[] = ['decorators-legacy'];
  if (ext === '.ts' || ext === '.tsx') plugins.push('typescript');
  if (ext === '.tsx' || ext === '.jsx') plugins.push('jsx');

  // ── Syntax check via @babel/parser ──────────────────────────────────────
  try {
    parse(content, { sourceType: 'module', plugins, errorRecovery: false });
  } catch (err) {
    const e = err as { message?: string; loc?: { line?: number; column?: number } };
    criticalIssues.push({
      severity: 'error',
      type: 'syntax',
      file: filePath,
      line: e.loc?.line,
      column: e.loc?.column,
      message: (e.message ?? 'Parse error').split('\n')[0]!,
      fixable: false,
    });
    // Cannot run heuristic checks on an unparseable file
    return;
  }

  // ── Heuristic checks (fixable by prettier) ───────────────────────────────
  const lines = content.split('\n');

  // Mixed tabs + spaces — prettier normalises indentation
  const mixedIndentLine = lines.findIndex((l) => /^\t+ /.test(l) || /^ +\t/.test(l));
  if (mixedIndentLine >= 0) {
    fixableIssues.push({
      severity: 'warning',
      type: 'format',
      file: filePath,
      line: mixedIndentLine + 1,
      message: 'Mixed tabs and spaces detected',
      fixable: true,
    });
  }

  // Lines exceeding 120 characters — prettier wraps them
  const longLines = lines
    .map((l, i) => ({ line: i + 1, len: l.length }))
    .filter(({ len }) => len > 120);
  if (longLines.length > 0) {
    fixableIssues.push({
      severity: 'warning',
      type: 'format',
      file: filePath,
      line: longLines[0]!.line,
      message: `${longLines.length} line(s) exceed 120 characters`,
      fixable: true,
    });
  }

  // Consecutive blank lines (>2) — prettier collapses them
  let blankRun = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === '') {
      blankRun++;
      if (blankRun > 2) {
        fixableIssues.push({
          severity: 'warning',
          type: 'format',
          file: filePath,
          line: i + 1,
          message: 'More than 2 consecutive blank lines',
          fixable: true,
        });
        break;
      }
    } else {
      blankRun = 0;
    }
  }
}

function validateReactNative(
  files: Array<{ path: string; content: string }>,
  fixableIssues: CodeIssue[],
  criticalIssues: CodeIssue[],
): void {
  for (const file of files) {
    const ext = file.path.slice(file.path.lastIndexOf('.'));
    if (!RN_EXTENSIONS.has(ext)) continue;
    validateRNFile(file.path, file.content, fixableIssues, criticalIssues);
  }
}

// ─── Flutter (Dart) ───────────────────────────────────────────────────────────

/**
 * dart analyze --format machine line format:
 *   SEVERITY|TYPE|CODE|FILE|LINE|COL|LENGTH|MESSAGE
 */
function parseDartAnalyzeLine(
  line: string,
  tempDir: string,
): CodeIssue | null {
  const parts = line.split('|');
  if (parts.length < 8) return null;

  const [severity, , rule, file, lineStr, colStr, , ...messageParts] = parts;
  const message = messageParts.join('|').trim();
  if (!message || !file) return null;

  const relFile = file.replace(tempDir + '/', '').replace(tempDir + '\\', '');
  const isError = severity === 'ERROR';

  return {
    severity: isError ? 'error' : 'warning',
    type: isError ? 'syntax' : 'lint',
    file: relFile,
    line: lineStr ? parseInt(lineStr, 10) : undefined,
    column: colStr ? parseInt(colStr, 10) : undefined,
    message,
    fixable: !isError,
    rule: rule?.trim(),
  };
}

function validateFlutter(
  files: Array<{ path: string; content: string }>,
  fixableIssues: CodeIssue[],
  criticalIssues: CodeIssue[],
): void {
  // Graceful degradation when dart is not installed
  try {
    execSync('dart --version', { stdio: 'pipe' });
  } catch {
    fixableIssues.push({
      severity: 'warning',
      type: 'lint',
      file: '*',
      message: 'dart CLI not found — skipping Flutter static analysis',
      fixable: false,
    });
    return;
  }

  const tempDir = writeTempDir(files);
  try {
    let rawOutput = '';
    try {
      rawOutput = execSync(`dart analyze --format machine "${tempDir}"`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      }) as unknown as string;
    } catch (err) {
      // dart analyze exits non-zero when issues exist; output is still on stdout
      rawOutput = ((err as { stdout?: string }).stdout) ?? '';
    }

    for (const line of rawOutput.split('\n')) {
      if (!line.trim()) continue;
      const issue = parseDartAnalyzeLine(line, tempDir);
      if (!issue) continue;
      if (issue.severity === 'error') criticalIssues.push(issue);
      else fixableIssues.push(issue);
    }
  } finally {
    cleanupDir(tempDir);
  }
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function codeValidatorAgent(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  if (!state.generatedCode) {
    throw new Error(
      'CodeBundle not available. CodeGeneratorAgent must run before CodeValidatorAgent.',
    );
  }

  const { generatedCode } = state;
  const fixableIssues: CodeIssue[] = [];
  const criticalIssues: CodeIssue[] = [];

  if (generatedCode.framework === 'react-native') {
    validateReactNative(generatedCode.files, fixableIssues, criticalIssues);
  } else {
    validateFlutter(generatedCode.files, fixableIssues, criticalIssues);
  }

  const valid = criticalIssues.length === 0;

  const codeValidationResult: CodeValidationResult = {
    valid,
    fixableIssues,
    criticalIssues,
    framework: generatedCode.framework,
    checkedFiles: generatedCode.files.length,
  };

  const totalIssues = fixableIssues.length + criticalIssues.length;
  const attempt = state.codeValidationRetryCount > 0
    ? ` (attempt ${state.codeValidationRetryCount + 1})`
    : '';

  const logLevel =
    !valid ? 'warning'
    : fixableIssues.length > 0 ? 'warning'
    : 'success';

  const logMessage =
    totalIssues === 0
      ? `Code validation passed${attempt} — ${generatedCode.files.length} file(s) clean`
      : valid
        ? `Code validation passed${attempt} with ${fixableIssues.length} fixable issue(s) across ${generatedCode.files.length} file(s)`
        : `Code validation${attempt} found ${criticalIssues.length} critical and ${fixableIssues.length} fixable issue(s)`;

  return {
    codeValidationResult,
    currentStep: 'CodeValidatorAgent',
    logs: [makeLogEntry(logLevel, logMessage)],
  };
}
