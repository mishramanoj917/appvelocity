/**
 * Gate 1 — Pre-write static validation.
 *
 * Runs BEFORE a generated file is accepted:
 *   1. Babel AST parse — catches all syntax errors instantly (in-process, ~1 ms).
 *   2. Mandatory structure check — ensures the file has the required shape
 *      (exports, return statement, StyleSheet / Widget class) so it can integrate
 *      into the project without extra scaffolding.
 *
 * Uses @babel/parser (already a workspace dependency) rather than tsc so no
 * child process is spawned and the check is essentially free.
 */

import { parse } from '@babel/parser';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Gate1Error {
  line: number;
  col: number;
  message: string;
}

export interface Gate1Result {
  valid: boolean;
  errors: Gate1Error[];
  structureIssue?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full Gate 1 check: parse + structure validation.
 * Returns a result object indicating whether the file can be accepted.
 */
export function runGate1(content: string, framework: 'react-native' | 'flutter'): Gate1Result {
  // Step 1 — strip accidental markdown fences the LLM may have emitted
  const cleaned = stripMarkdownFences(content);

  // Step 2 — structure sanity (cheap string checks before parsing)
  const structureCheck = checkMandatoryStructure(cleaned, framework);
  if (!structureCheck.valid) {
    return { valid: false, errors: [], structureIssue: structureCheck.issue };
  }

  // Step 3 — AST parse
  if (framework === 'react-native') {
    return checkTSXSyntax(cleaned);
  }
  // Flutter: Babel can't parse Dart; rely on downstream compilation validator
  return { valid: true, errors: [] };
}

/** Strips leading/trailing markdown fences from LLM output. */
export function stripMarkdownFences(content: string): string {
  return content
    .trim()
    .replace(/^```[a-zA-Z]*\r?\n?/, '')
    .replace(/\r?\n?```$/, '')
    .trim();
}

// ─── TSX / TypeScript parse ───────────────────────────────────────────────────

function checkTSXSyntax(content: string): Gate1Result {
  try {
    parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: false,
    });
    return { valid: true, errors: [] };
  } catch (err: unknown) {
    const e   = err as { loc?: { line: number; column: number }; message?: string };
    const loc = e.loc ?? { line: 0, column: 0 };
    const msg = (e.message ?? 'Parse error')
      .replace(/\s*\([\d:]+\)\s*$/, '') // strip "(line:col)" suffix Babel appends
      .slice(0, 200);
    return {
      valid: false,
      errors: [{ line: loc.line, col: loc.column, message: msg }],
    };
  }
}

// ─── Structure checks ─────────────────────────────────────────────────────────

function checkMandatoryStructure(
  content: string,
  framework: 'react-native' | 'flutter'
): { valid: boolean; issue?: string } {
  const t = content.trim();

  // Reject if still wrapped in markdown
  if (t.startsWith('```')) {
    return { valid: false, issue: 'Response still contains markdown fences — need raw code' };
  }

  // Reject clearly empty or error-only responses
  if (t.length < 80) {
    return { valid: false, issue: `Response too short (${t.length} chars) — likely an LLM refusal or truncation` };
  }

  if (framework === 'react-native') {
    if (!t.includes('export')) {
      return { valid: false, issue: 'No export statement — component must be exported' };
    }
    if (!t.includes('return')) {
      return { valid: false, issue: 'No return statement — JSX must be returned' };
    }
    if (!t.includes('StyleSheet')) {
      return { valid: false, issue: 'No StyleSheet.create — all styles must use StyleSheet' };
    }
    if (!t.includes('import React') && !t.includes("from 'react'") && !t.includes('from "react"')) {
      return { valid: false, issue: 'Missing React import' };
    }
  } else {
    // Flutter / Dart
    if (!t.includes('class') || !t.includes('Widget')) {
      return { valid: false, issue: 'No Flutter Widget class found' };
    }
    if (!t.includes('build(')) {
      return { valid: false, issue: 'No build() method found' };
    }
    if (!t.includes("import 'package:flutter/material.dart'")) {
      return { valid: false, issue: "Missing flutter/material.dart import" };
    }
  }

  return { valid: true };
}
