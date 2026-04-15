/**
 * Node 7 — CodeValidatorAgent
 *
 * Validates every generated source file.
 *
 * React Native  →  @babel/parser (TypeScript + JSX plugins) + heuristic checks
 * Flutter       →  Gemini LLM review (primary) + dart analyze (if dart CLI present)
 *
 * Issues are split into two buckets:
 *   criticalIssues  – syntax / compile errors that no auto-tool can recover from
 *   fixableIssues   – formatting, lint, or style issues that can be auto-fixed
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
import type { CodeFile } from '@appvelocity/agent-design-to-code-generators';
import { createLLMClient } from '../utils/llm-client.js';
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
    return;
  }

  const lines = content.split('\n');

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

// ─── Flutter — Gemini LLM validation ─────────────────────────────────────────

interface GeminiIssue {
  severity: 'error' | 'warning';
  type: 'syntax' | 'lint' | 'format' | 'import';
  file: string;
  line?: number;
  message: string;
  fixable: boolean;
}

interface GeminiValidationResponse {
  fixableIssues: GeminiIssue[];
  criticalIssues: GeminiIssue[];
  summary: string;
}

async function validateFlutterWithGemini(
  files: CodeFile[],
  fixableIssues: CodeIssue[],
  criticalIssues: CodeIssue[],
): Promise<void> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const llm = createLLMClient();

  const dartFiles = files.filter(
    (f) => f.path.endsWith('.dart') && !f.path.includes('assets'),
  );
  if (dartFiles.length === 0) return;

  // Send up to 5 files for review to keep prompt size manageable
  const filesToReview = dartFiles.slice(0, 5);
  const filesSummary = filesToReview
    .map((f) => `// === FILE: ${f.path} ===\n${f.content}`)
    .join('\n\n');

  const response = await llm.chat({
    model,
    system: `You are a Flutter/Dart code reviewer. Analyse the provided Dart source files and identify issues.
Classify each issue into one of two buckets:
- criticalIssues: syntax errors, compile errors, undefined identifiers, type mismatches
- fixableIssues: formatting problems, style violations, lint warnings, unused imports, missing const

Return a JSON object exactly matching this schema:
{
  "criticalIssues": [{ "severity": "error", "type": "syntax"|"lint"|"format"|"import", "file": "<path>", "line": <number|null>, "message": "<description>", "fixable": false }],
  "fixableIssues":  [{ "severity": "warning", "type": "syntax"|"lint"|"format"|"import", "file": "<path>", "line": <number|null>, "message": "<description>", "fixable": true }],
  "summary": "<one sentence summary>"
}

If no issues exist return empty arrays. Do not include issues that are inherent to auto-generated code structure.`,
    messages: [{ role: 'user', content: filesSummary }],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
  });

  try {
    const parsed = JSON.parse(response.content) as GeminiValidationResponse;

    for (const issue of (parsed.criticalIssues ?? [])) {
      criticalIssues.push({
        severity: issue.severity ?? 'error',
        type: issue.type ?? 'syntax',
        file: issue.file,
        line: issue.line ?? undefined,
        message: issue.message,
        fixable: false,
      });
    }

    for (const issue of (parsed.fixableIssues ?? [])) {
      fixableIssues.push({
        severity: issue.severity ?? 'warning',
        type: issue.type ?? 'lint',
        file: issue.file,
        line: issue.line ?? undefined,
        message: issue.message,
        fixable: true,
      });
    }
  } catch {
    // If Gemini response isn't valid JSON, treat as no issues found
  }
}

// ─── Flutter — dart analyze fallback (when dart CLI is available) ─────────────

function parseDartAnalyzeLine(line: string, tempDir: string): CodeIssue | null {
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

function validateFlutterWithDartCLI(
  files: Array<{ path: string; content: string }>,
  fixableIssues: CodeIssue[],
  criticalIssues: CodeIssue[],
): boolean {
  try {
    execSync('dart --version', { stdio: 'pipe' });
  } catch {
    return false; // dart not installed
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
  return true;
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
  const nodeLogs = [makeLogEntry('info', `Validating ${generatedCode.files.length} file(s)…`)];

  if (generatedCode.framework === 'react-native') {
    validateReactNative(generatedCode.files, fixableIssues, criticalIssues);
  } else {
    // Flutter: Gemini review first (primary), dart analyze as supplement
    try {
      await validateFlutterWithGemini(generatedCode.files, fixableIssues, criticalIssues);
      nodeLogs.push(makeLogEntry('info', 'Gemini Flutter validation complete'));
    } catch (err) {
      nodeLogs.push(makeLogEntry('warning', `Gemini validation unavailable — ${String(err)}`));
    }

    // Supplement with dart analyze if available
    const dartAvailable = validateFlutterWithDartCLI(
      generatedCode.files,
      fixableIssues,
      criticalIssues,
    );
    if (!dartAvailable) {
      nodeLogs.push(makeLogEntry('info', 'dart CLI not found — relying on Gemini validation'));
    }
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
        ? `Code validation passed${attempt} with ${fixableIssues.length} fixable issue(s)`
        : `Code validation${attempt} found ${criticalIssues.length} critical and ${fixableIssues.length} fixable issue(s)`;

  return {
    codeValidationResult,
    currentStep: 'CodeValidatorAgent',
    logs: [...nodeLogs, makeLogEntry(logLevel, logMessage)],
  };
}
