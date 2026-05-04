/**
 * Node 12 — CompilationFixerAgent
 *
 * When compilationValidator finds errors, this node applies two passes:
 *
 *   Pass 1 — Deterministic pattern fixes (no LLM, free):
 *     - Remove imports for modules that don't exist in the project
 *     - Fix component references that aren't imported
 *
 *   Pass 2 — LLM-assisted fix per file, with full project manifest as context
 *     so the model knows which screens/components exist and can be imported.
 *     Capped at 10 files per retry to stay within token and latency budgets.
 *
 * Routes back to compilationValidator (max 3 retries).
 *
 * Input state:  projectBundle, compilationResult
 * Output state: projectBundle (updated files), compilationResult (incremented retryCount)
 */

import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState, ProjectFile, CompileError } from '../types.js';

// ─── Project manifest ─────────────────────────────────────────────────────────

/** Build a short manifest of available files so LLM knows what can be imported. */
function buildProjectManifest(files: ProjectFile[]): string {
  const ts = files
    .filter((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
    .map((f) => f.path)
    .slice(0, 40);
  return ts.join('\n');
}

// ─── Deterministic patterns ───────────────────────────────────────────────────

/**
 * Remove import lines for identifiers that cause "Cannot find name" or
 * "Cannot find module" errors, so subsequent LLM passes have fewer distractions.
 */
function applyPatternFixes(content: string, errors: CompileError[]): string {
  let fixed = content;

  // Collect all unresolvable imported names from TS2304/TS2305 errors
  const unresolvedNames = new Set<string>();
  for (const e of errors) {
    const m = e.message.match(/Cannot find name '(.+?)'/);
    if (m?.[1]) unresolvedNames.add(m[1]);
  }

  if (unresolvedNames.size > 0) {
    // Remove import lines that only import unresolvable names
    fixed = fixed.replace(
      /^import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];?\s*$/gm,
      (line, names: string) => {
        const imported = names.split(',').map((n) => n.trim().replace(/\s+as\s+\w+/, ''));
        const allUnresolved = imported.every((n) => unresolvedNames.has(n));
        return allUnresolved ? `// REMOVED: ${line.trim()}` : line;
      }
    );
  }

  return fixed;
}

// ─── LLM fix prompt ───────────────────────────────────────────────────────────

function buildFixPrompt(
  framework: string,
  filePath: string,
  content: string,
  errors: CompileError[],
  projectManifest: string
): string {
  const errList = errors
    .slice(0, 30) // cap to avoid prompt overflow
    .map((e) => `  Line ${e.line}, Col ${e.col}: [${e.code ?? 'error'}] ${e.message}`)
    .join('\n');

  return `You are a ${framework === 'flutter' ? 'Flutter/Dart' : 'React Native/TypeScript'} expert fixing compiler errors.

Fix ONLY the listed errors. Do not change unaffected logic.
Return ONLY the corrected file content — no explanation, no markdown fences.

## Available project files (for import references)
${projectManifest || '(no manifest available)'}

## File to fix: ${filePath}

## Compiler errors:
${errList}

## Current file content:
\`\`\`
${content.slice(0, 8000)}${content.length > 8000 ? '\n... (truncated)' : ''}
\`\`\``;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function compilationFixerAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const compilationResult = state.compilationResult;
  const projectBundle = state.projectBundle;

  if (!compilationResult || compilationResult.errors.length === 0 || !projectBundle) {
    return {
      currentStep: 'CompilationFixerAgent',
      logs: [makeLogEntry('info', '[CompileFixer] No errors to fix')],
    };
  }

  const llm = createLLMClient();
  const model = process.env['OPENAI_MODEL'] ?? 'gpt-4o';
  const projectManifest = buildProjectManifest(projectBundle.files);

  // Group errors by file
  const errorsByFile = new Map<string, CompileError[]>();
  for (const err of compilationResult.errors) {
    if (!err.file) continue;
    const list = errorsByFile.get(err.file) ?? [];
    list.push(err);
    errorsByFile.set(err.file, list);
  }

  // Sort files by error count descending — fix the most-broken files first
  const sortedFiles = [...errorsByFile.entries()].sort((a, b) => b[1].length - a[1].length);

  // Cap: fix at most 10 files per retry to stay within latency budget
  const filesToFix = sortedFiles.slice(0, 10);

  const updatedFiles: ProjectFile[] = [...projectBundle.files];
  let fixedCount = 0;

  await Promise.allSettled(
    filesToFix.map(async ([filePath, errors]) => {
      const fileIdx = updatedFiles.findIndex((f) => f.path === filePath);
      if (fileIdx === -1) return;

      const original = updatedFiles[fileIdx]!;

      // Pass 1: deterministic pattern fixes
      const patternFixed = applyPatternFixes(original.content, errors);

      // Pass 2: LLM fix
      const prompt = buildFixPrompt(
        state.targetFramework,
        filePath,
        patternFixed,
        errors,
        projectManifest
      );

      try {
        const response = await llm.chat({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 8192,
        });

        let fixed = response.content.trim();
        // Strip accidental markdown fences
        if (fixed.startsWith('```')) {
          fixed = fixed.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
        }

        updatedFiles[fileIdx] = { ...original, content: fixed };
        fixedCount++;
      } catch {
        // Keep pattern-fixed version even if LLM fails
        updatedFiles[fileIdx] = { ...original, content: patternFixed };
      }
    })
  );

  const newRetryCount = (compilationResult.retryCount ?? 0) + 1;
  const remaining = errorsByFile.size - filesToFix.length;
  const msg = remaining > 0
    ? `[CompileFixer] Fixed ${fixedCount}/${filesToFix.length} file(s), ${remaining} file(s) deferred — retry ${newRetryCount}/3`
    : `[CompileFixer] Fixed ${fixedCount}/${filesToFix.length} file(s) — retry ${newRetryCount}/3`;

  return {
    projectBundle: { ...projectBundle, files: updatedFiles },
    compilationResult: { ...compilationResult, retryCount: newRetryCount },
    currentStep: 'CompilationFixerAgent',
    logs: [makeLogEntry('info', msg)],
  };
}
