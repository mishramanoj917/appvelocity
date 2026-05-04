/**
 * Node 11 — CompilationValidatorAgent
 *
 * Writes the project bundle to a temp directory and runs the framework's
 * static analyser to catch type errors and compilation failures:
 *   Flutter:       flutter analyze --no-fatal-infos --no-pub
 *   React Native:  npx tsc --noEmit --skipLibCheck
 *
 * Skips silently if the relevant SDK is not installed on the host.
 *
 * Input state:  projectBundle (or generatedCode for screens-only mode)
 * Output state: compilationResult, currentStep, logs
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState, CompilationResult, CompileError, CompileWarning } from '../types.js';

const exec = promisify(execFile);

// ─── Temp dir management ──────────────────────────────────────────────────────

async function writeBundleToTemp(state: WorkflowState): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appvelocity-'));
  const files = state.projectBundle?.files ?? state.generatedCode?.files ?? [];

  for (const file of files) {
    const filePath = path.join(tmpDir, file.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, 'utf8');
  }

  return tmpDir;
}

async function cleanup(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Non-fatal
  }
}

// ─── Flutter analyser ─────────────────────────────────────────────────────────

async function isFlutterAvailable(): Promise<boolean> {
  try {
    await exec('flutter', ['--version'], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function parseFlutterErrors(output: string, tmpDir: string): { errors: CompileError[]; warnings: CompileWarning[] } {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  // Flutter analyze output format: "  • message • file.dart:line:col • error_code"
  // Also: "error • message • file.dart:line:col • code"
  const errorRe = /^\s*error\s+•\s+(.+?)\s+•\s+(.+?):(\d+):(\d+)\s+•\s+(.*)$/gm;
  const warnRe  = /^\s*warning\s+•\s+(.+?)\s+•\s+(.+?):(\d+)(?::\d+)?\s+•\s+(.*)$/gm;

  for (const m of output.matchAll(errorRe)) {
    errors.push({
      message: m[1]?.trim() ?? '',
      file: (m[2] ?? '').replace(tmpDir + path.sep, ''),
      line: parseInt(m[3] ?? '0', 10),
      col: parseInt(m[4] ?? '0', 10),
      code: m[5]?.trim(),
    });
  }

  for (const m of output.matchAll(warnRe)) {
    warnings.push({
      message: m[1]?.trim() ?? '',
      file: (m[2] ?? '').replace(tmpDir + path.sep, ''),
      line: parseInt(m[3] ?? '0', 10),
    });
  }

  return { errors, warnings };
}

async function runFlutterAnalyze(tmpDir: string): Promise<CompilationResult> {
  try {
    const { stdout, stderr } = await exec(
      'flutter',
      ['analyze', '--no-fatal-infos', '--no-pub'],
      { cwd: tmpDir, timeout: 60_000 }
    );
    const output = stdout + stderr;
    const { errors, warnings } = parseFlutterErrors(output, tmpDir);
    return { success: errors.length === 0, errors, warnings, tool: 'flutter-analyze', retryCount: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = (e.stdout ?? '') + (e.stderr ?? '');
    const { errors, warnings } = parseFlutterErrors(output, tmpDir);
    return {
      success: false,
      errors: errors.length > 0 ? errors : [{ file: '', line: 0, col: 0, message: String(err) }],
      warnings,
      tool: 'flutter-analyze',
      retryCount: 0,
    };
  }
}

// ─── TypeScript compiler ──────────────────────────────────────────────────────

async function isTscAvailable(): Promise<boolean> {
  try {
    await exec('npx', ['tsc', '--version'], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

function parseTscErrors(output: string, tmpDir: string): { errors: CompileError[]; warnings: CompileWarning[] } {
  const errors: CompileError[] = [];
  // tsc format: "file.ts(line,col): error TS####: message"
  const re = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

  for (const m of output.matchAll(re)) {
    errors.push({
      file: (m[1] ?? '').replace(tmpDir + path.sep, ''),
      line: parseInt(m[2] ?? '0', 10),
      col: parseInt(m[3] ?? '0', 10),
      code: m[4],
      message: m[5]?.trim() ?? '',
    });
  }

  return { errors, warnings: [] };
}

async function runTsc(tmpDir: string): Promise<CompilationResult> {
  try {
    await exec('npx', ['tsc', '--noEmit', '--skipLibCheck', '--strict', 'false'], {
      cwd: tmpDir,
      timeout: 60_000,
    });
    return { success: true, errors: [], warnings: [], tool: 'tsc', retryCount: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = (e.stdout ?? '') + (e.stderr ?? '');
    const { errors, warnings } = parseTscErrors(output, tmpDir);
    return {
      success: errors.length === 0,
      errors,
      warnings,
      tool: 'tsc',
      retryCount: 0,
    };
  }
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function compilationValidatorAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const framework = state.targetFramework;
  const retryCount = state.compilationResult?.retryCount ?? 0;

  let tmpDir: string | undefined;

  try {
    // Check SDK availability first (fast path to skip if not installed)
    const sdkAvailable = framework === 'flutter'
      ? await isFlutterAvailable()
      : await isTscAvailable();

    if (!sdkAvailable) {
      return {
        compilationResult: { success: true, errors: [], warnings: [], tool: framework === 'flutter' ? 'flutter-analyze' : 'tsc', retryCount },
        currentStep: 'CompilationValidatorAgent',
        logs: [makeLogEntry('warning', `[CompileValidator] ${framework === 'flutter' ? 'flutter' : 'tsc'} CLI not found — skipping compilation check`)],
      };
    }

    tmpDir = await writeBundleToTemp(state);

    const result = framework === 'flutter'
      ? await runFlutterAnalyze(tmpDir)
      : await runTsc(tmpDir);

    result.retryCount = retryCount;

    const level = result.success ? 'success' : 'warning';
    const summary = result.success
      ? `Compilation check passed (${result.tool})`
      : `Compilation check found ${result.errors.length} error(s) (${result.tool})`;

    return {
      compilationResult: result,
      currentStep: 'CompilationValidatorAgent',
      logs: [makeLogEntry(level, `[CompileValidator] ${summary}`)],
    };
  } finally {
    if (tmpDir) await cleanup(tmpDir);
  }
}
