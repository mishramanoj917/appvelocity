/**
 * Phase 6 — E2E Integration Test
 *
 * Invokes the full 6-node DesignToCode pipeline against a real Figma file.
 * Prints a step-by-step trace with timing, LLM responses, and IR stats.
 *
 * Usage:
 *   node scripts/e2e-test.mjs [figma-url] [framework]
 *
 * Examples:
 *   node scripts/e2e-test.mjs "https://www.figma.com/file/ABC123/MyApp" react-native
 *   node scripts/e2e-test.mjs "https://www.figma.com/design/ABC123/MyApp" flutter
 *
 * Env vars loaded automatically from .env in the repo root.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────
function loadEnv(envPath) {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
    console.log('✓ Loaded .env');
  } catch {
    console.warn('⚠  No .env file found — using existing env vars only');
  }
}

loadEnv(resolve(ROOT, '.env'));

// ── Args ──────────────────────────────────────────────────────────────────────
const FIGMA_URL =
  process.argv[2] ??
  'https://www.figma.com/design/placeholder/TestFile'; // override via CLI arg

const FRAMEWORK = (process.argv[3] ?? 'react-native');

// ── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};
const ok  = (s) => `${c.green}✓${c.reset} ${s}`;
const err = (s) => `${c.red}✗${c.reset} ${s}`;
const inf = (s) => `${c.cyan}ℹ${c.reset} ${s}`;
const hd  = (s) => `\n${c.bold}${c.blue}━━ ${s} ━━${c.reset}`;
const dim = (s) => `${c.dim}${s}${c.reset}`;

// ── Preflight checks ──────────────────────────────────────────────────────────
console.log(hd('Phase 6 — E2E Integration Test'));
console.log(inf(`Figma URL : ${FIGMA_URL}`));
console.log(inf(`Framework : ${FRAMEWORK}`));
console.log('');

const missing = [];
if (!process.env.FIGMA_ACCESS_TOKEN) missing.push('FIGMA_ACCESS_TOKEN');
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) missing.push('ANTHROPIC_API_KEY or OPENAI_API_KEY');
if (missing.length) {
  console.error(err(`Missing required env vars: ${missing.join(', ')}`));
  process.exit(1);
}

console.log(ok(`FIGMA_ACCESS_TOKEN  : ${process.env.FIGMA_ACCESS_TOKEN.slice(0, 12)}…`));
console.log(ok(`LLM proxy key       : ${(process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY).slice(0, 8)}…`));
console.log(ok(`LLM API URL         : ${process.env.LLM_API_URL ?? '(default proxy)'}`));
console.log(ok(`OPENAI_MODEL        : ${process.env.OPENAI_MODEL ?? 'gpt-4o'}`));
console.log('');

// ── Import workflow (ESM dist) ────────────────────────────────────────────────
let compiledWorkflow;
try {
  const mod = await import(
    resolve(ROOT, 'packages/agents/design-to-code/workflow/dist/index.js')
  );
  compiledWorkflow = mod.compiledWorkflow;
  console.log(ok('Imported compiledWorkflow'));
} catch (e) {
  console.error(err(`Failed to import workflow: ${e.message}`));
  console.error(dim('  → Run: pnpm -F @appvelocity/agent-design-to-code-workflow build'));
  process.exit(1);
}

// ── Run the pipeline ──────────────────────────────────────────────────────────
console.log(hd('Running Pipeline'));
const start = Date.now();

let finalState;
try {
  finalState = await compiledWorkflow.invoke(
    {
      figmaUrl: FIGMA_URL,
      targetFramework: FRAMEWORK,
      options: { verbose: true },
    },
    {
      // LangGraph stream events for per-node tracing
      streamMode: 'values',
    }
  );
} catch (e) {
  console.error(err(`Pipeline threw an unhandled exception:`));
  console.error(e);
  process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

// ── Print log entries ─────────────────────────────────────────────────────────
console.log(hd('Step-by-Step Logs'));
if (finalState.logs?.length) {
  for (const entry of finalState.logs) {
    const icon =
      entry.level === 'success' ? c.green + '✓' + c.reset :
      entry.level === 'error'   ? c.red   + '✗' + c.reset :
      entry.level === 'warning' ? c.yellow + '⚠' + c.reset :
                                   c.cyan  + 'ℹ' + c.reset;
    const ts = new Date(entry.timestamp).toISOString().slice(11, 19);
    console.log(`  ${icon} [${dim(ts)}] ${entry.message}`);
  }
} else {
  console.log(dim('  (no log entries)'));
}

// ── Errors ────────────────────────────────────────────────────────────────────
if (finalState.errors?.length) {
  console.log(hd('Errors'));
  for (const e of finalState.errors) {
    console.error(`  ${err(`[${e.code}] ${e.message}`)}`);
    if (e.details) console.error(dim(`    ${JSON.stringify(e.details)}`));
  }
}

// ── Execution plan ────────────────────────────────────────────────────────────
if (finalState.executionPlan) {
  const p = finalState.executionPlan;
  console.log(hd('Execution Plan'));
  console.log(`  screens    : ${p.screens?.length ?? 0} IDs`);
  console.log(`  components : ${p.components?.length ?? 0} IDs`);
  console.log(`  priority   : ${p.priority}`);
  console.log(`  est.duration: ${p.estimatedDuration}s`);
}

// ── Validation result ─────────────────────────────────────────────────────────
if (finalState.validationResult) {
  const v = finalState.validationResult;
  const icon = v.valid ? ok('PASSED') : err('FAILED');
  console.log(hd('Critic Validation'));
  console.log(`  ${icon}  score=${v.score}/100`);
  if (v.issues?.length) {
    for (const issue of v.issues) {
      const sev =
        issue.severity === 'error'   ? c.red    + '  ERROR  ' + c.reset :
        issue.severity === 'warning' ? c.yellow + ' WARNING ' + c.reset :
                                        c.cyan  + '  INFO   ' + c.reset;
      console.log(`  ${sev} [${issue.category}] ${issue.message}`);
      if (issue.fixSuggestion) console.log(dim(`             Fix: ${issue.fixSuggestion}`));
    }
  } else {
    console.log(`  ${inf('No issues found')}`);
  }
}

// ── Design IR summary ─────────────────────────────────────────────────────────
if (finalState.designIR) {
  const ir = finalState.designIR;
  console.log(hd('Design IR Summary'));
  console.log(`  fileName   : ${ir.fileName}`);
  console.log(`  screens    : ${ir.screens.length}`);
  console.log(`  components : ${ir.components.length}`);
  console.log(`  assets     : ${ir.assets.length}`);
  console.log(`  tokens     :`);
  console.log(`    colors       : ${Object.keys(ir.tokens.colors).length}`);
  console.log(`    typography   : ${Object.keys(ir.tokens.typography).length}`);
  console.log(`    spacing      : ${Object.keys(ir.tokens.spacing).length}`);
  console.log(`    radii        : ${Object.keys(ir.tokens.radii).length}`);
  if (ir.screens.length > 0) {
    console.log(`  screens list:`);
    for (const s of ir.screens) {
      console.log(`    - ${s.name} (${s.width}×${s.height})  componentName="${s.componentName}"`);
    }
  }
}

// ── Generated code summary ────────────────────────────────────────────────────
if (finalState.generatedCode) {
  const g = finalState.generatedCode;
  console.log(hd('Generated Code'));
  console.log(`  framework  : ${g.framework}`);
  console.log(`  files      : ${g.files.length}`);
  console.log(`  assets     : ${g.assets.length}`);
  console.log(`  files list :`);
  for (const f of g.files) {
    const lines = f.content.split('\n').length;
    console.log(`    - ${f.path}  (${lines} lines, ${f.content.length} bytes)`);
  }

  // Print first generated file as a preview
  if (g.files.length > 0) {
    const preview = g.files[0];
    const maxLines = 60;
    const previewLines = preview.content.split('\n').slice(0, maxLines);
    console.log(`\n${hd(`Preview — ${preview.path}`)}`);
    console.log(dim(previewLines.join('\n')));
    if (preview.content.split('\n').length > maxLines) {
      console.log(dim(`  … (truncated to ${maxLines} lines)`));
    }
  }
}

// ── Final status ──────────────────────────────────────────────────────────────
console.log(hd('Result'));
const hasErrors = finalState.errors?.length > 0;
const hasCode   = !!finalState.generatedCode?.files?.length;

if (!hasErrors && hasCode) {
  console.log(ok(`Pipeline completed successfully in ${elapsed}s`));
} else if (!hasErrors && !hasCode) {
  console.log(`${c.yellow}⚠${c.reset}  Pipeline completed but no code was generated (${elapsed}s)`);
  console.log(dim('  → Check critic validation result and IR summary above'));
} else {
  console.log(err(`Pipeline completed with errors in ${elapsed}s`));
}
console.log('');
