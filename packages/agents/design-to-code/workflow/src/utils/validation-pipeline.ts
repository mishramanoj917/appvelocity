/**
 * ValidationPipeline — unified Gate 1/2/3 file-write lifecycle.
 *
 * ALL generated file writes MUST go through this class. Direct writes to disk
 * bypass the validation contract and are forbidden.
 *
 * Gate 1 — Pre-write static check (Babel AST + mandatory structure).
 *           File is NOT persisted on failure. Errors returned to caller for
 *           LLM self-correction. Max 3 attempts before escalation.
 *
 * Gate 2 — Post-write incremental lint diff.
 *           Runs dart analyze / eslint after each successful Gate 1 write.
 *           Only new errors (not pre-existing baseline) are surfaced.
 *
 * Gate 3 — Incremental compile (every 5 files).
 *           Runs tsc or dart analyze on the full workspace.
 *           On failure the caller should suspend generation and repair.
 */

import { WorkspaceSession, groupErrorsByFile } from './workspace-validator.js';
import { runGate1, stripMarkdownFences }        from './gate1-validator.js';
import type { CompileError }                    from '../types.js';
import type { Gate1Result }                     from './gate1-validator.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Gate2Result {
  passed:      boolean;
  newErrors:   CompileError[];
  totalErrors: number;
}

export interface Gate3Result {
  passed:         boolean;
  compilerOutput: CompileError[];
  errorCount:     number;
}

export interface WriteResult {
  /** False only if Gate 1 failed on all retry attempts AND escalation not forced */
  success:    boolean;
  gate1:      Gate1Result;
  gate2?:     Gate2Result;
  gate3?:     Gate3Result;
  /** Combined error messages for returning to the LLM */
  errors:     string[];
  /** True if Gate 1 failed after maxGate1Retries and file was persisted with ESCALATED prefix */
  escalated?: boolean;
}

export interface GateStats {
  gate1: { pass: number; fail: number; escalated: number };
  gate2: { pass: number; fail: number };
  gate3: { pass: number; fail: number };
}

export interface ErrorSummary {
  totalFiles:       number;
  gate1Failures:    number;
  gate2NewErrors:   number;
  gate3Errors:      number;
  escalatedFiles:   string[];
  worstFiles:       Array<{ file: string; errorCount: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GATE3_INTERVAL    = 5;   // run Gate 3 after every N successful writes
const MAX_GATE1_RETRIES = 3;   // max Gate 1 attempts before escalating

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export class ValidationPipeline {
  readonly framework: 'react-native' | 'flutter';

  private session?: WorkspaceSession;
  private fileCounter  = 0;
  private errorBaseline: CompileError[] = [];
  private escalatedFiles: string[]      = [];
  private readonly stats: GateStats = {
    gate1: { pass: 0, fail: 0, escalated: 0 },
    gate2: { pass: 0, fail: 0 },
    gate3: { pass: 0, fail: 0 },
  };

  constructor(framework: 'react-native' | 'flutter') {
    this.framework = framework;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Write a generated file through all gates.
   *
   * @param filePath  Relative path (e.g. "src/screens/HomeScreen.tsx")
   * @param content   Raw content from the LLM (may contain markdown fences)
   * @param attempt   Which gate-1 attempt this is (1-indexed). Callers should
   *                  retry with corrected content on failure, incrementing this.
   */
  async writeFile(
    filePath: string,
    content:  string,
    attempt = 1
  ): Promise<WriteResult> {
    const cleaned = stripMarkdownFences(content);

    // ── Gate 1 — pre-write static check ──────────────────────────────────────
    const gate1 = runGate1(cleaned, this.framework);

    if (!gate1.valid) {
      this.stats.gate1.fail++;

      if (attempt >= MAX_GATE1_RETRIES) {
        // Escalate: persist with a warning prefix so human reviewers can find it
        const escalated = `// ⚠️ GATE1_FAILED (${attempt} attempts)\n${cleaned}`;
        await this._ensureSession();
        await this.session!.writeFile(filePath, escalated);
        this.fileCounter++;
        this.escalatedFiles.push(filePath);
        this.stats.gate1.escalated++;

        return {
          success:   false,
          gate1,
          errors:    _gate1Errors(gate1),
          escalated: true,
        };
      }

      // Return errors for LLM self-correction — do NOT persist
      return {
        success: false,
        gate1,
        errors:  _gate1Errors(gate1),
      };
    }

    this.stats.gate1.pass++;

    // ── Persist to workspace ──────────────────────────────────────────────────
    await this._ensureSession();
    await this.session!.writeFile(filePath, cleaned);
    this.fileCounter++;

    // ── Gate 2 — incremental lint diff ────────────────────────────────────────
    const gate2 = await this._runGate2();

    // ── Gate 3 — compile check (every GATE3_INTERVAL files) ──────────────────
    let gate3: Gate3Result | undefined;
    if (this.fileCounter % GATE3_INTERVAL === 0) {
      gate3 = await this._runGate3();
    }

    const allErrors: string[] = [
      ...(gate2.newErrors.map((e) => `Gate2 ${e.file}:${e.line}: ${e.message}`)),
      ...(gate3?.compilerOutput.map((e) => `Gate3 ${e.file}:${e.line}: ${e.message}`) ?? []),
    ];

    return {
      success: gate3 ? gate3.passed : true,
      gate1,
      gate2,
      gate3,
      errors: allErrors,
    };
  }

  getErrorSummary(): ErrorSummary {
    const allErrors = this.errorBaseline;
    const byFile    = groupErrorsByFile(allErrors);

    const worst = [...byFile.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([file, errs]) => ({ file, errorCount: errs.length }));

    return {
      totalFiles:       this.fileCounter,
      gate1Failures:    this.stats.gate1.fail,
      gate2NewErrors:   0, // cumulative tracked per-call; summary is approximate
      gate3Errors:      this.errorBaseline.length,
      escalatedFiles:   [...this.escalatedFiles],
      worstFiles:       worst,
    };
  }

  getGateStats(): GateStats {
    return { ...this.stats };
  }

  /** Returns all files written to the temp workspace directory path. */
  get workspaceDir(): string {
    return this.session?.dir ?? '';
  }

  /** Force-run Gate 3 regardless of the interval counter (e.g. before final ZIP). */
  async forceGate3(): Promise<Gate3Result> {
    return this._runGate3();
  }

  async cleanup(): Promise<void> {
    await this.session?.cleanup();
  }

  reset(): void {
    this.fileCounter    = 0;
    this.errorBaseline  = [];
    this.escalatedFiles = [];
    this.stats.gate1    = { pass: 0, fail: 0, escalated: 0 };
    this.stats.gate2    = { pass: 0, fail: 0 };
    this.stats.gate3    = { pass: 0, fail: 0 };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async _ensureSession(): Promise<void> {
    if (!this.session) {
      this.session = await WorkspaceSession.create(this.framework);
    }
  }

  private async _runGate2(): Promise<Gate2Result> {
    if (!this.session) return { passed: true, newErrors: [], totalErrors: 0 };

    const current  = await this.session.runCheck();
    const baseline = new Set(this.errorBaseline.map(_errorKey));
    const newErrors = current.filter((e) => !baseline.has(_errorKey(e)));

    // Update baseline for next diff
    this.errorBaseline = current;

    const passed = newErrors.length === 0;
    if (passed) this.stats.gate2.pass++;
    else        this.stats.gate2.fail++;

    return { passed, newErrors, totalErrors: current.length };
  }

  private async _runGate3(): Promise<Gate3Result> {
    if (!this.session) return { passed: true, compilerOutput: [], errorCount: 0 };

    const errors  = await this.session.runCheck();
    const passed  = errors.length === 0;

    if (passed) this.stats.gate3.pass++;
    else        this.stats.gate3.fail++;

    return { passed, compilerOutput: errors, errorCount: errors.length };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _gate1Errors(r: Gate1Result): string[] {
  const errs: string[] = [];
  if (r.structureIssue) errs.push(`Structure: ${r.structureIssue}`);
  for (const e of r.errors) errs.push(`${e.line}:${e.col}: ${e.message}`);
  return errs;
}

function _errorKey(e: CompileError): string {
  return `${e.file}:${e.line}:${e.col}:${e.message}`;
}
