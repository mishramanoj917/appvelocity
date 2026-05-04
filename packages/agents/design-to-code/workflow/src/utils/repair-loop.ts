/**
 * Gate 5 — Focused single-file repair loop.
 *
 * When Gate 1 (syntax) or Gate 3 (workspace tsc) flags a file, this module
 * enters a narrow repair loop:
 *
 *   1. Send ONLY the failing file + exact error messages to the LLM.
 *      (NOT the full 40k-token generation history — avoids attention drift.)
 *   2. Regression guard: after each attempt, re-parse the response with Babel.
 *      If the new version has MORE syntax errors than the current best, discard
 *      the response and try again.
 *   3. Escalation: after maxAttempts failures, prepend a human_review_needed
 *      comment and return the best version seen so far.
 */

import { runGate1, stripMarkdownFences } from './gate1-validator.js';
import type { LLMClient }                from '../types.js';
import type { CompileError }             from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RepairError = Pick<CompileError, 'line' | 'col' | 'message'> & {
  code?: string;
};

export interface RepairResult {
  /** Final file content (repaired or best-seen + escalation comment). */
  content:   string;
  /** True if the file passed Gate 1 after repair. */
  repaired:  boolean;
  attempts:  number;
  /** True if all attempts failed and a human review comment was prepended. */
  escalated: boolean;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Attempt to repair a file that failed a validation gate.
 *
 * @param llm       LLM client
 * @param model     Model identifier
 * @param filePath  Relative file path (used in the prompt, not for I/O)
 * @param content   Current file content
 * @param errors    Errors to fix (Gate 1 syntax errors OR Gate 3 tsc errors)
 * @param framework Target framework (used to choose the Gate 1 check dialect)
 * @param maxAttempts  How many LLM attempts before escalation (default: 3)
 */
export async function repairFile(
  llm:          LLMClient,
  model:        string,
  filePath:     string,
  content:      string,
  errors:       RepairError[],
  framework:    'react-native' | 'flutter',
  maxAttempts = 3
): Promise<RepairResult> {
  const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

  // Track the best (lowest error-count) version we've seen
  let best         = content;
  let bestErrCount = isTS ? runGate1(content, framework).errors.length : 0;
  let errorList    = [...errors];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const errStr = formatErrors(errorList);
    const lang   = framework === 'flutter' ? 'Flutter/Dart' : 'React Native/TypeScript';

    const prompt =
      `Fix ONLY the listed errors in this ${lang} file.\n` +
      `Do NOT change any logic that is working correctly.\n` +
      `Return ONLY the corrected raw file content — no markdown, no explanation.\n\n` +
      `## File: ${filePath}\n` +
      `## Errors to fix:\n${errStr}\n\n` +
      `## Current file content:\n` +
      content.slice(0, 10_000) +
      (content.length > 10_000 ? '\n// ... (file truncated for prompt)' : '');

    let fixed: string;
    try {
      const response = await llm.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192,
      });
      fixed = stripMarkdownFences(response.content);
    } catch {
      continue; // LLM call failed — retry
    }

    if (fixed.length < 80) continue; // suspiciously short — LLM likely errored

    // ── Regression guard ─────────────────────────────────────────────────────
    if (isTS) {
      const gate1 = runGate1(fixed, framework);
      const newErrCount = gate1.errors.length;

      if (newErrCount === 0 && !gate1.structureIssue) {
        // Fully repaired
        return { content: fixed, repaired: true, attempts: attempt, escalated: false };
      }

      if (newErrCount <= bestErrCount) {
        // Improvement — keep it as the new best
        best         = fixed;
        bestErrCount = newErrCount;
        errorList    = gate1.errors.map((e) => ({ line: e.line, col: e.col, message: e.message }));
      }
      // If worse, discard and retry with original errorList unchanged
    } else {
      // Dart: we can't parse it with Babel, so always accept improvements
      return { content: fixed, repaired: true, attempts: attempt, escalated: false };
    }
  }

  // ── Escalation ────────────────────────────────────────────────────────────
  const summary = errors
    .slice(0, 3)
    .map((e) => `Line ${e.line}: ${e.message.slice(0, 80)}`)
    .join('; ');
  const comment = isTS
    ? `// ⚠️  AUTO-REPAIR FAILED after ${maxAttempts} attempts. Manual review needed.\n` +
      `//    Remaining errors: ${summary}\n\n`
    : `// ⚠️  AUTO-REPAIR FAILED after ${maxAttempts} attempts. Manual review needed.\n\n`;

  return {
    content:   comment + best,
    repaired:  false,
    attempts:  maxAttempts,
    escalated: true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatErrors(errors: RepairError[]): string {
  return errors
    .slice(0, 15)
    .map((e) => `  Line ${e.line}, Col ${e.col}: ${e.message}`)
    .join('\n');
}
