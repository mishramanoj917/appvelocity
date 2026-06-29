/**
 * Vision Validator — visual accuracy loop.
 *
 * After Flutter code is generated, renders each screen using a golden test,
 * compares the rendered PNG against the original Figma screenshot via a
 * vision LLM, and applies targeted patches in a loop.
 *
 * Pipeline (per screen):
 *   1. Write generated code to temp project
 *   2. Run `flutter test --update-goldens` → produces rendered PNG
 *   3. Fetch Figma screenshot via asset pipeline
 *   4. Send both images to vision LLM → structured diff
 *   5. Apply patches to dart file
 *   6. Repeat up to MAX_VISION_RETRIES
 *   7. Remaining diffs → // TODO: Visual mismatch — {description} comments
 *
 * Graceful degradation: if flutter binary unavailable, skips rendering and
 * returns original files unchanged. The vision diff still runs if Figma
 * screenshots are available (catches color/font issues without rendering).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CodeFile } from '@appvelocity/agent-design-to-code-generators';
import type { LLMClient, LLMChatOptions } from '../types.js';
import { makeLogEntry } from '../utils/logger.js';
import { stripMarkdownFences } from '../utils/gate1-validator.js';

const execFileAsync = promisify(execFile);

const MAX_VISION_RETRIES = 2;

export interface VisionValidationResult {
  files: CodeFile[];
  logs: ReturnType<typeof makeLogEntry>[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs the vision validation loop on a set of generated Flutter files.
 * Returns patched files and logs. Never throws — degrades gracefully.
 */
export async function runVisionValidator(
  files: CodeFile[],
  figmaScreenshots: Map<string, string>, // componentName → PNG base64
  llm: LLMClient,
  model: string,
): Promise<VisionValidationResult> {
  const logs: ReturnType<typeof makeLogEntry>[] = [];

  const flutterAvailable = await checkFlutterAvailable();
  if (!flutterAvailable) {
    logs.push(makeLogEntry('warning',
      '[VisionValidator] Flutter SDK not found — skipping render step. Set FLUTTER_PATH env var or install Flutter.'
    ));
  }

  if (figmaScreenshots.size === 0) {
    logs.push(makeLogEntry('info', '[VisionValidator] No Figma screenshots available — skipping visual validation'));
    return { files, logs };
  }

  const patchedFiles = [...files];
  const screenFiles  = files.filter((f) => f.path.includes('/screens/') && f.path.endsWith('.dart'));

  for (const screenFile of screenFiles) {
    const componentName = extractComponentName(screenFile.path);
    const figmaScreenshot = figmaScreenshots.get(componentName);
    if (!figmaScreenshot) continue;

    let renderedScreenshot: string | undefined;
    if (flutterAvailable) {
      try {
        renderedScreenshot = await renderWidget(screenFile, patchedFiles);
        logs.push(makeLogEntry('info', `[VisionValidator] Rendered ${componentName}`));
      } catch (err) {
        logs.push(makeLogEntry('warning',
          `[VisionValidator] Render failed for ${componentName}: ${err instanceof Error ? err.message : String(err)}`
        ));
      }
    }

    // Even without a render, run vision diff if we have the Figma screenshot
    let currentContent = screenFile.content;
    for (let attempt = 1; attempt <= MAX_VISION_RETRIES; attempt++) {
      const diff = await runVisionDiff(
        renderedScreenshot,
        figmaScreenshot,
        currentContent,
        componentName,
        llm,
        model,
      );

      if (!diff.hasDifferences) {
        logs.push(makeLogEntry('success',
          `[VisionValidator] ${componentName} passes visual check (attempt ${attempt})`
        ));
        break;
      }

      logs.push(makeLogEntry('info',
        `[VisionValidator] ${componentName} has ${diff.differences.length} visual difference(s) — patching…`
      ));

      const patched = await applyVisualPatch(
        currentContent,
        diff.differences,
        componentName,
        llm,
        model,
      );

      currentContent = patched;

      // Re-render if Flutter is available
      if (flutterAvailable && attempt < MAX_VISION_RETRIES) {
        try {
          const tempFile: CodeFile = { ...screenFile, content: currentContent };
          renderedScreenshot = await renderWidget(tempFile, patchedFiles);
        } catch {
          // Render failure in retry loop — continue with last screenshot
        }
      }
    }

    // Annotate remaining diffs as TODOs
    const finalDiff = await runVisionDiff(
      renderedScreenshot,
      figmaScreenshot,
      currentContent,
      componentName,
      llm,
      model,
    );

    if (finalDiff.hasDifferences) {
      const todoComment = finalDiff.differences
        .map((d) => `// TODO: Visual mismatch — ${d}`)
        .join('\n');
      currentContent = `${todoComment}\n\n${currentContent}`;
      logs.push(makeLogEntry('warning',
        `[VisionValidator] ${componentName}: ${finalDiff.differences.length} unresolved visual difference(s) flagged as TODOs`
      ));
    }

    // Apply final patched content back to files array
    const idx = patchedFiles.findIndex((f) => f.path === screenFile.path);
    if (idx >= 0) patchedFiles[idx] = { ...screenFile, content: currentContent };
  }

  return { files: patchedFiles, logs };
}

// ─── Flutter golden test rendering ───────────────────────────────────────────

async function checkFlutterAvailable(): Promise<boolean> {
  const flutterBin = process.env.FLUTTER_PATH ?? 'flutter';
  try {
    await execFileAsync(flutterBin, ['--version'], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function renderWidget(
  screenFile: CodeFile,
  allFiles: CodeFile[],
): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'av-vision-'));
  try {
    // Write all files to the temp project
    for (const f of allFiles) {
      const dest = path.join(tmpDir, f.path);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, f.content, 'utf8');
    }

    // Write the golden test
    const componentName = extractComponentName(screenFile.path);
    const importPath = `package:your_app/${screenFile.path.replace('lib/', '')}`;
    const testContent = buildGoldenTest(componentName, importPath);
    const testPath = path.join(tmpDir, `test/golden_${toSnake(componentName)}_test.dart`);
    await fs.mkdir(path.dirname(testPath), { recursive: true });
    await fs.writeFile(testPath, testContent, 'utf8');

    // Write minimal pubspec.yaml if missing
    await ensurePubspec(tmpDir);

    const flutterBin = process.env.FLUTTER_PATH ?? 'flutter';
    await execFileAsync(flutterBin, ['pub', 'get'], { cwd: tmpDir, timeout: 60_000 });
    await execFileAsync(
      flutterBin,
      ['test', '--update-goldens', `test/golden_${toSnake(componentName)}_test.dart`],
      { cwd: tmpDir, timeout: 120_000 }
    );

    const goldenPath = path.join(tmpDir, `test/goldens/${toSnake(componentName)}.png`);
    const pngBuffer = await fs.readFile(goldenPath);
    return pngBuffer.toString('base64');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function buildGoldenTest(componentName: string, importPath: string): string {
  return `import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import '${importPath}';

void main() {
  testWidgets('${componentName} golden', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ${componentName}(),
      ),
    );
    await expectLater(
      find.byType(${componentName}),
      matchesGoldenFile('goldens/${toSnake(componentName)}.png'),
    );
  });
}
`;
}

async function ensurePubspec(dir: string): Promise<void> {
  const pubspecPath = path.join(dir, 'pubspec.yaml');
  try {
    await fs.access(pubspecPath);
  } catch {
    await fs.writeFile(pubspecPath, `name: generated_app
description: Generated Flutter app
version: 1.0.0

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: '>=3.10.0'

dependencies:
  flutter:
    sdk: flutter

dev_dependencies:
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true
`);
  }
}

// ─── Vision diff ──────────────────────────────────────────────────────────────

interface VisionDiff {
  hasDifferences: boolean;
  differences: string[];
}

async function runVisionDiff(
  renderedBase64: string | undefined,
  figmaBase64: string,
  currentCode: string,
  componentName: string,
  llm: LLMClient,
  model: string,
): Promise<VisionDiff> {
  try {
    const messages: LLMChatOptions['messages'] = [];

    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];

    if (renderedBase64) {
      userContent.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${renderedBase64}` } });
      userContent.push({ type: 'text', text: 'Image 1: Flutter rendered output' });
    }

    userContent.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${figmaBase64}` } });
    userContent.push({
      type: 'text',
      text: renderedBase64
        ? 'Image 2: Original Figma design\n\nList specific visual differences between Image 1 (Flutter render) and Image 2 (Figma). Focus on: wrong colors, missing elements, layout misalignment, wrong font sizes, missing padding/spacing. Be concise — one line per difference. If no meaningful differences, respond with MATCH.'
        : `Figma design screenshot for ${componentName}.\n\nBased on this design, identify what visual issues the Flutter code below might have: wrong colors, missing elements, layout issues, font problems.\n\nCode:\n${currentCode.slice(0, 3000)}\n\nList issues concisely, one per line. If code looks correct, respond with MATCH.`,
    });

    messages.push({ role: 'user', content: userContent as LLMChatOptions['messages'][0]['content'] });

    const response = await llm.chat({ model, messages, max_tokens: 512 });
    const text = response.content.trim();

    if (text === 'MATCH' || text.includes('no meaningful') || text.toLowerCase().includes('no difference')) {
      return { hasDifferences: false, differences: [] };
    }

    const differences = text
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.]\s*/, '').trim())
      .filter((l) => l.length > 10);

    return { hasDifferences: differences.length > 0, differences };
  } catch {
    return { hasDifferences: false, differences: [] };
  }
}

// ─── Patch application ────────────────────────────────────────────────────────

async function applyVisualPatch(
  currentCode: string,
  differences: string[],
  componentName: string,
  llm: LLMClient,
  model: string,
): Promise<string> {
  const diffList = differences.map((d, i) => `${i + 1}. ${d}`).join('\n');

  try {
    const response = await llm.chat({
      model,
      system: `You are a Flutter/Dart expert fixing visual discrepancies.
Return ONLY the corrected Dart file content. No explanations, no markdown fences.
Fix ONLY the listed visual issues. Do NOT change widget structure or logic.`,
      messages: [{
        role: 'user',
        content: `Fix these visual issues in the Flutter widget ${componentName}:

${diffList}

Current code:
${currentCode}`,
      }],
      max_tokens: 4096,
    });

    const patched = stripMarkdownFences(response.content);
    return patched.length > 100 ? patched : currentCode;
  } catch {
    return currentCode;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractComponentName(filePath: string): string {
  return path.basename(filePath, '.dart')
    .replace(/_screen$/, '')
    .replace(/_widget$/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function toSnake(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
