/**
 * Gate 2 / Gate 3 — Post-write workspace validation.
 *
 * Manages a temporary on-disk workspace that mirrors the files generated so far.
 * After every N files (configurable, default 5) the full workspace is checked
 * with `npx tsc --noEmit --noResolve --skipLibCheck`.
 *
 * Using --noResolve means the compiler doesn't try to find node_modules, so
 * the check runs in ~2 s even without npm install. It catches:
 *   - Syntax errors that Babel missed (rare but possible with complex generics)
 *   - Use of undeclared variables or types within a single file
 *   - Obvious type mismatches
 *
 * Cross-file import errors (e.g. "cannot find module './Foo'") are intentionally
 * suppressed at this stage; the full compilationValidator node handles them.
 *
 * For Flutter the workspace check runs `dart analyze --no-fatal-infos` if the
 * dart binary is available; otherwise it skips silently.
 */

import { exec }                from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname }       from 'node:path';
import { tmpdir }              from 'node:os';
import { promisify }           from 'node:util';
import type { CompileError }   from '../types.js';

const execAsync = promisify(exec);

// ─── tsconfig used inside the temp workspace ──────────────────────────────────

const TS_CONFIG = JSON.stringify(
  {
    compilerOptions: {
      target:        'ES2020',
      lib:           ['ES2020'],
      jsx:           'react-native',
      module:        'CommonJS',
      strict:        false,
      skipLibCheck:  true,
      noEmit:        true,
      noResolve:     true, // don't resolve node_modules — we only have generated files
      allowJs:       true,
      esModuleInterop: true,
    },
    include: ['src/**/*', 'lib/**/*', '*.tsx', '*.ts'],
  },
  null,
  2
);

// ─── WorkspaceSession ─────────────────────────────────────────────────────────

export class WorkspaceSession {
  readonly dir:   string;
  readonly framework: 'react-native' | 'flutter';
  private readonly files = new Map<string, string>();
  lastErrorCount = 0;

  private constructor(dir: string, framework: 'react-native' | 'flutter') {
    this.dir       = dir;
    this.framework = framework;
  }

  static async create(framework: 'react-native' | 'flutter'): Promise<WorkspaceSession> {
    const dir     = await mkdtemp(join(tmpdir(), 'appv-gen-'));
    const session = new WorkspaceSession(dir, framework);
    if (framework === 'react-native') {
      await writeFile(join(dir, 'tsconfig.json'), TS_CONFIG, 'utf8');
    }
    return session;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = join(this.dir, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
    this.files.set(path, content);
  }

  get fileCount(): number {
    return this.files.size;
  }

  /** Returns true if the relative path has been written to this workspace. */
  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  /**
   * Run the appropriate compiler check on all files written so far.
   * Returns an array of CompileError (empty = clean).
   */
  async runCheck(): Promise<CompileError[]> {
    if (this.framework === 'react-native') {
      return this.runTsc();
    }
    return this.runDartAnalyze();
  }

  async cleanup(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }

  // ─── React Native / TypeScript ─────────────────────────────────────────────

  private async runTsc(): Promise<CompileError[]> {
    try {
      // Combine stdout+stderr; tsc errors go to stdout
      const { stdout } = await execAsync(
        'npx tsc --noEmit --noResolve --skipLibCheck 2>&1 || true',
        { cwd: this.dir, timeout: 30_000 }
      );
      const errors = parseTscOutput(stdout, this.dir);
      this.lastErrorCount = errors.length;
      return errors;
    } catch (err: unknown) {
      const e = err as { stdout?: string; message?: string };
      const errors = parseTscOutput(e.stdout ?? e.message ?? '', this.dir);
      this.lastErrorCount = errors.length;
      return errors;
    }
  }

  // ─── Flutter / Dart ────────────────────────────────────────────────────────

  private async runDartAnalyze(): Promise<CompileError[]> {
    // Check whether dart is available
    try {
      await execAsync('dart --version', { timeout: 5_000 });
    } catch {
      return []; // dart not installed — skip silently
    }

    try {
      const { stdout } = await execAsync(
        'dart analyze --no-fatal-infos 2>&1 || true',
        { cwd: this.dir, timeout: 60_000 }
      );
      const errors = parseDartOutput(stdout, this.dir);
      this.lastErrorCount = errors.length;
      return errors;
    } catch (err: unknown) {
      const e = err as { stdout?: string };
      const errors = parseDartOutput(e.stdout ?? '', this.dir);
      this.lastErrorCount = errors.length;
      return errors;
    }
  }
}

// ─── Output parsers ───────────────────────────────────────────────────────────

function parseTscOutput(output: string, baseDir: string): CompileError[] {
  const errors: CompileError[] = [];
  // tsc format: path/to/file.ts(line,col): error TSxxxx: message
  const re = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    let file = m[1]!.trim();
    if (file.startsWith(baseDir)) file = file.slice(baseDir.length).replace(/^[/\\]/, '');
    errors.push({
      file,
      line: parseInt(m[2]!, 10),
      col:  parseInt(m[3]!, 10),
      code: m[4]!,
      message: m[5]!.trim(),
    });
  }
  return errors;
}

function parseDartOutput(output: string, baseDir: string): CompileError[] {
  const errors: CompileError[] = [];
  // dart analyze format: error • message • file.dart:line:col • code
  const re = /^error\s+•\s+(.+?)\s+•\s+(.+?):(\d+):(\d+)\s+•\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    let file = m[2]!.trim();
    if (file.startsWith(baseDir)) file = file.slice(baseDir.length).replace(/^[/\\]/, '');
    errors.push({
      file,
      line: parseInt(m[3]!, 10),
      col:  parseInt(m[4]!, 10),
      code: m[5]!.trim(),
      message: m[1]!.trim(),
    });
  }
  return errors;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Group an error array by the file field. */
export function groupErrorsByFile(errors: CompileError[]): Map<string, CompileError[]> {
  const map = new Map<string, CompileError[]>();
  for (const e of errors) {
    const list = map.get(e.file) ?? [];
    list.push(e);
    map.set(e.file, list);
  }
  return map;
}
