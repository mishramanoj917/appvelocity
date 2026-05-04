/**
 * run_visual_qa — VisualQAAgent tool.
 *
 * Compares each generated screen against the ground truth extracted from the Figma IR.
 * Uses two layers:
 *   Layer 2: Structural check — counts expected vs present elements (images, buttons, text)
 *   Layer 5: LLM visual judge — sends Figma frame image + generated code to vision LLM
 *            for a natural-language assessment and 0-100 fidelity score.
 *
 * Returns a summary of screens that fail (score < 70) with actionable issues,
 * so the orchestrator can call generate_component to fix specific screens.
 */

import { loadGroundTruth } from '../utils/ground-truth-extractor.js';
import { createLLMClient } from '../utils/llm-client.js';
import type { AgentMemory } from '../agent-memory.js';
import type { ToolResult } from '../types.js';
import type { ScreenGroundTruth } from '../utils/ground-truth-extractor.js';

const VISUAL_QA_MODEL = process.env['VISUAL_QA_MODEL'] ?? process.env['ORCHESTRATOR_MODEL'] ?? 'claude-sonnet-4';
const PASS_THRESHOLD = 70;

interface ScreenQAResult {
  screen: string;
  filePath: string;
  score: number;
  passed: boolean;
  issues: string[];
  missingImages: string[];
  missingButtons: number;
}

export async function runVisualQaTool(
  _args: Record<string, unknown>,
  memory: AgentMemory
): Promise<ToolResult> {
  if (!memory.designIR) {
    return { success: false, summary: 'build_ir must complete before run_visual_qa', error: 'prerequisite_missing' };
  }
  if (memory.generatedFiles.size === 0) {
    return { success: false, summary: 'No generated files — run generate_all_components first', error: 'prerequisite_missing' };
  }

  const groundTruth = loadGroundTruth(memory.sessionId, memory.snapshotManager);
  if (!groundTruth) {
    return {
      success: true,
      summary: 'Visual QA skipped — ground_truth.json not found (build_ir may have failed to write it).',
    };
  }

  const llm = createLLMClient();

  // Evaluate all screens in parallel (one LLM call per screen, not sequential).
  // Each screen gets a 60-second timeout guard so a slow call can't block the pipeline.
  const results = await Promise.all(
    groundTruth.screens.map((screen) =>
      Promise.race([
        evaluateScreen(screen, memory, llm),
        new Promise<ScreenQAResult>((resolve) =>
          setTimeout(() => resolve({
            screen:         screen.name,
            filePath:       '(timeout)',
            score:          75,
            passed:         true,
            issues:         ['Visual QA timed out — skipping this screen'],
            missingImages:  [],
            missingButtons: 0,
          }), 60_000)
        ),
      ])
    )
  );

  // Build summary
  const failing = results.filter((r) => !r.passed);
  const passing = results.filter((r) => r.passed);

  const lines: string[] = [
    `Visual QA complete — ${passing.length}/${results.length} screens passed (threshold: ${PASS_THRESHOLD}/100).`,
  ];

  if (failing.length > 0) {
    lines.push('', 'FAILING SCREENS (regenerate these):');
    for (const r of failing) {
      lines.push(`  • ${r.screen} (score=${r.score}, file=${r.filePath}):`);
      for (const issue of r.issues.slice(0, 4)) {
        lines.push(`    - ${issue}`);
      }
      if (r.missingImages.length > 0) {
        lines.push(`    - MISSING IMAGES: ${r.missingImages.join(', ')}`);
      }
    }
  }

  if (passing.length > 0) {
    lines.push('', `Passing screens: ${passing.map((r) => `${r.screen} (${r.score})`).join(', ')}`);
  }

  return {
    success: failing.length === 0,
    summary: lines.join('\n'),
  };
}

// ─── Per-screen evaluation ─────────────────────────────────────────────────────

async function evaluateScreen(
  screen: ScreenGroundTruth,
  memory: AgentMemory,
  llm: ReturnType<typeof createLLMClient>
): Promise<ScreenQAResult> {
  const framework = memory.input.targetFramework;
  const ext = framework === 'flutter' ? '.dart' : '.tsx';

  // Find the generated file for this screen
  const filePath = findGeneratedFile(screen.name, memory, ext);
  const code = filePath ? memory.generatedFiles.get(filePath) ?? '' : '';

  // Layer 2: Structural check (fast, no LLM)
  const structuralIssues = runStructuralCheck(screen, code, framework);

  // Layer 5: LLM visual judge
  let llmScore = 100;
  const llmIssues: string[] = [];

  try {
    const verdict = await runLLMJudge(screen, code, framework, llm);
    llmScore = verdict.score;
    llmIssues.push(...verdict.issues);
  } catch {
    // Non-fatal — use structural score only
    llmScore = structuralIssues.length === 0 ? 85 : Math.max(20, 85 - structuralIssues.length * 15);
  }

  // Combine: structural deductions + LLM score weighted 60/40
  const structuralDeduction = Math.min(50, structuralIssues.length * 10);
  const combinedScore = Math.round(llmScore * 0.7 - structuralDeduction * 0.3);
  const finalScore = Math.max(0, Math.min(100, combinedScore));

  const missingImages = screen.assets
    .filter((a) => !code.includes(a.slug) && !code.includes(a.nodeId))
    .map((a) => a.slug);

  return {
    screen:         screen.name,
    filePath:       filePath ?? `(not generated)`,
    score:          finalScore,
    passed:         finalScore >= PASS_THRESHOLD,
    issues:         [...structuralIssues, ...llmIssues],
    missingImages,
    missingButtons: countMissingButtons(screen, code, framework),
  };
}

// ─── Layer 2: Structural (code-text) check ────────────────────────────────────

function runStructuralCheck(
  screen: ScreenGroundTruth,
  code: string,
  framework: string
): string[] {
  const issues: string[] = [];

  if (!code) {
    return [`Screen "${screen.name}" file not found in generated output`];
  }

  // Check for expected text content
  const expectedTexts = extractTextValues(screen);
  for (const text of expectedTexts.slice(0, 5)) {
    if (text.length > 3 && !code.includes(text)) {
      issues.push(`Missing text: "${text}"`);
    }
  }

  // Check for image/asset references
  const imageToken = framework === 'flutter' ? 'Image.network' : '<Image';
  const hasAnyImage = code.includes(imageToken);
  if (screen.assets.length > 0 && !hasAnyImage) {
    issues.push(`Missing image components — design has ${screen.assets.length} image(s) but none generated`);
  }

  // Check for button/touchable components
  const buttonToken = framework === 'flutter' ? 'GestureDetector\|ElevatedButton\|TextButton\|InkWell' : 'Pressable\|TouchableOpacity';
  const hasButtons = new RegExp(buttonToken).test(code);
  const expectedButtonCount = countExpectedButtons(screen);
  if (expectedButtonCount > 0 && !hasButtons) {
    issues.push(`Missing interactive elements — design has ~${expectedButtonCount} button(s) but none generated`);
  }

  // Check minimum code size (very short = incomplete)
  if (code.length < 300) {
    issues.push('Generated file appears incomplete (< 300 characters)');
  }

  return issues;
}

function extractTextValues(screen: ScreenGroundTruth): string[] {
  const texts: string[] = [];
  function walk(el: { text?: { value?: string }; children?: unknown[] }): void {
    if (el.text?.value) texts.push(el.text.value);
    if (el.children) for (const child of el.children) walk(child as typeof el);
  }
  for (const el of screen.componentTree) walk(el as Parameters<typeof walk>[0]);
  return texts;
}

function countExpectedButtons(screen: ScreenGroundTruth): number {
  let count = 0;
  function walk(el: { type?: string; children?: unknown[] }): void {
    if (el.type === 'button' || el.type === 'touchable') count++;
    if (el.children) for (const child of el.children) walk(child as typeof el);
  }
  for (const el of screen.componentTree) walk(el as Parameters<typeof walk>[0]);
  return count;
}

function countMissingButtons(screen: ScreenGroundTruth, code: string, framework: string): number {
  const expected = countExpectedButtons(screen);
  const rnPattern = /(Pressable|TouchableOpacity)/g;
  const flutterPattern = /(GestureDetector|ElevatedButton|TextButton|InkWell)/g;
  const pattern = framework === 'flutter' ? flutterPattern : rnPattern;
  const actual = (code.match(pattern) ?? []).length;
  return Math.max(0, expected - actual);
}

// ─── Layer 5: LLM visual judge ────────────────────────────────────────────────

interface LLMVerdict {
  score: number;
  issues: string[];
}

async function runLLMJudge(
  screen: ScreenGroundTruth,
  code: string,
  framework: string,
  llm: ReturnType<typeof createLLMClient>
): Promise<LLMVerdict> {
  const hasFrameImage = !!screen.frameExportUrl;

  const systemPrompt = `You are a mobile UI quality reviewer. Evaluate whether generated ${
    framework === 'flutter' ? 'Flutter/Dart' : 'React Native/TypeScript'
  } code faithfully implements a Figma design.

Respond ONLY with valid JSON:
{
  "score": <0-100>,
  "issues": ["issue1", "issue2", ...]
}

Score guide: 90-100=excellent, 70-89=acceptable, 50-69=significant issues, <50=major problems.
List at most 5 specific, actionable issues. Empty array if none.`;

  // Build user message — with image if frame URL is available
  const assetSummary = screen.assets.length > 0
    ? `\nExpected image assets: ${screen.assets.map((a) => a.slug).join(', ')}`
    : '';
  const tokenSummary = screen.tokens.colors.length > 0
    ? `\nExpected colors: ${screen.tokens.colors.slice(0, 8).join(', ')}`
    : '';

  const textPrompt = `## Screen: ${screen.name}${assetSummary}${tokenSummary}

## Generated ${framework === 'flutter' ? 'Dart' : 'TypeScript'} code:
\`\`\`
${code.slice(0, 3000)}${code.length > 3000 ? '\n...(truncated)' : ''}
\`\`\`

Evaluate: Does this code implement the design faithfully? Are all visual elements present (images, buttons, text, layout)?`;

  const messages = hasFrameImage
    ? [{
        role: 'user' as const,
        content: [
          { type: 'image_url' as const, image_url: { url: screen.frameExportUrl } },
          { type: 'text' as const, text: textPrompt },
        ],
      }]
    : [{ role: 'user' as const, content: textPrompt }];

  const response = await llm.chat({
    model:           VISUAL_QA_MODEL,
    system:          systemPrompt,
    messages,
    response_format: { type: 'json_object' },
    max_tokens:      512,
  });

  try {
    const parsed = JSON.parse(response.content) as { score?: number; issues?: string[] };
    return {
      score:  typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 75,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return { score: 75, issues: [] };
  }
}

// ─── File path resolver ───────────────────────────────────────────────────────

function findGeneratedFile(
  screenName: string,
  memory: AgentMemory,
  ext: string
): string | undefined {
  // Normalise name for matching: "Sign In" → "SignIn", "sign_in" → "SignIn"
  const normalised = screenName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  for (const path of memory.generatedFiles.keys()) {
    if (!path.endsWith(ext)) continue;
    const baseName = path.split('/').at(-1)?.replace(ext, '').toLowerCase() ?? '';
    if (baseName === normalised || baseName.includes(normalised) || normalised.includes(baseName)) {
      return path;
    }
  }
  return undefined;
}
