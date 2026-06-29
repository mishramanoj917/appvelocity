/**
 * av generate — generate Flutter code from Figma URL, screenshot, or prompt.
 * Writes files directly into the existing Flutter project.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Command } from 'commander';
import { findProjectRoot, readConfig, applyConfigToEnv } from '../lib/config.js';
import { analyzeProject } from '../lib/project-context.js';
import type { ProjectContext } from '../lib/project-context.js';
import { llmChat } from '../lib/llm-client.js';

export function registerGenerate(program: Command): void {
  program
    .command('generate')
    .description('Generate Flutter screen/widget code from Figma, screenshot, or prompt')
    .option('--figma <url>',       'Figma file URL to generate from')
    .option('--token <token>',     'Figma access token (overrides config)')
    .option('--screen <node-id>',  'Specific Figma frame node ID to target')
    .option('--screenshot <path>', 'Path to a screenshot image (PNG/JPG)')
    .option('--prompt <text>',     'Natural language description of the screen')
    .option('--out <dir>',         'Output directory relative to lib/', 'screens')
    .option('--no-analyze',        'Skip project context detection')
    .action(async (opts: {
      figma?: string;
      token?: string;
      screen?: string;
      screenshot?: string;
      prompt?: string;
      out: string;
      analyze: boolean;
    }) => {
      const { default: chalk } = await import('chalk');
      const { default: ora }   = await import('ora');

      const root   = await findProjectRoot();
      const config = await readConfig(root);
      applyConfigToEnv(config);

      const apiUrl = config.llmApiUrl ?? process.env['LLM_API_URL'] ?? '';
      const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '';

      if (!apiKey) {
        console.log(chalk.red('No API key configured. Run: av config set apiKey <key>'));
        process.exit(1);
      }

      // Load project context
      let context: ProjectContext | undefined;
      if (opts.analyze) {
        const ctxSpinner = ora('Detecting project architecture…').start();
        try {
          const existing = await readExistingContext(root);
          context = existing ?? await analyzeProject(root, config);
          ctxSpinner.succeed(`Detected: ${context.stateManagement} / ${context.navigationLib}`);
        } catch {
          ctxSpinner.warn('Could not detect project context — using defaults');
        }
      }

      if (!opts.figma && !opts.screenshot && !opts.prompt) {
        console.log(chalk.red('Provide one of: --figma <url>, --screenshot <path>, or --prompt <text>'));
        process.exit(1);
      }

      const genSpinner = ora('Generating Flutter code…').start();

      let designSpec = '';
      let screenName = 'GeneratedScreen';

      if (opts.figma) {
        genSpinner.text = 'Fetching Figma design…';
        const figmaToken = opts.token ?? config.figmaToken ?? process.env['FIGMA_ACCESS_TOKEN'] ?? '';
        if (!figmaToken) {
          genSpinner.fail('No Figma access token. Use --token or: av config set figmaToken <token>');
          process.exit(1);
        }
        designSpec = await fetchFigmaSpec(opts.figma, figmaToken, opts.screen);
        screenName = extractScreenName(opts.figma);
        genSpinner.text = 'Generating Flutter code from Figma…';
      } else if (opts.screenshot) {
        genSpinner.text = 'Analyzing screenshot…';
        designSpec = await analyzeScreenshot(opts.screenshot, apiUrl, apiKey, config.model);
        screenName = 'ScreenFromScreenshot';
        genSpinner.text = 'Generating Flutter code from screenshot…';
      } else if (opts.prompt) {
        designSpec = `Screen description: ${opts.prompt}`;
        screenName = opts.prompt.split(' ').slice(0, 3).map(capitalize).join('');
      }

      const contextPrompt = buildContextPrompt(context);
      const dartCode = await generateDartCode(
        screenName,
        designSpec,
        contextPrompt,
        apiUrl,
        apiKey,
        config.model,
      );

      // Determine output path following project's folder structure
      const outDir = path.join(root, 'lib', opts.out);
      await fs.mkdir(outDir, { recursive: true });

      const fileName = toSnakeCase(screenName) + '_screen.dart';
      const outPath  = path.join(outDir, fileName);
      await fs.writeFile(outPath, dartCode, 'utf8');

      genSpinner.succeed(`Generated: lib/${opts.out}/${fileName}`);
      console.log('');
      console.log(chalk.green(`✓ ${path.relative(root, outPath)}`));
      console.log(chalk.dim('Run av build to compile and auto-fix errors'));
    });
}

// ─── Figma spec fetcher ───────────────────────────────────────────────────────

async function fetchFigmaSpec(figmaUrl: string, token: string, nodeId?: string): Promise<string> {
  // Extract file key from URL
  const match = figmaUrl.match(/figma\.com\/(?:file|design)\/([^/?]+)/);
  if (!match) throw new Error(`Invalid Figma URL: ${figmaUrl}`);
  const fileKey = match[1]!;

  const url = `https://api.figma.com/v1/files/${fileKey}${nodeId ? `/nodes?ids=${nodeId}` : ''}`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { name?: string; document?: unknown; nodes?: unknown };

  // Compact representation for LLM prompt
  return JSON.stringify(nodeId ? data.nodes : data.document, null, 2).slice(0, 8000);
}

// ─── Screenshot analyzer ──────────────────────────────────────────────────────

async function analyzeScreenshot(
  imagePath: string,
  apiUrl: string,
  apiKey: string,
  model?: string,
): Promise<string> {
  const imageBuffer = await fs.readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const response = await llmChat({
    model: model ?? 'gemini-1.5-pro',
    system: 'You are a UI analyst. Describe the screen structure for Flutter code generation.',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
        {
          type: 'text',
          text: `Describe this mobile screen for Flutter code generation. Include:
1. Overall layout (Column/Row/Stack hierarchy)
2. Each UI element (type, position, size estimate)
3. Colors (hex or color names)
4. Typography (font sizes, weights)
5. Spacing and padding
Be precise and structured.`,
        },
      ],
    }],
    max_tokens: 1024,
  }, { apiUrl, apiKey });

  return response.content;
}

// ─── Code generator ───────────────────────────────────────────────────────────

async function generateDartCode(
  screenName: string,
  designSpec: string,
  contextPrompt: string,
  apiUrl: string,
  apiKey: string,
  model?: string,
): Promise<string> {
  const response = await llmChat({
    model: model ?? 'gemini-1.5-pro',
    system: `You are a Flutter/Dart expert. Generate production-quality, compilable Dart code.
Return ONLY raw Dart source code. No markdown fences, no explanations.
Always import package:flutter/material.dart.
Extend StatelessWidget (StatefulWidget only if local state needed).
Use const constructors. Handle null safety. No dynamic types.
Wrap screen body in SafeArea. Use const spacing values.`,
    messages: [{
      role: 'user',
      content: `Generate a Flutter screen widget named ${screenName}.

${contextPrompt}

Design specification:
${designSpec}

Requirements:
- class ${screenName} extends StatelessWidget
- const ${screenName}({super.key});
- Scaffold with SafeArea body
- Match the design as closely as possible
- Use placeholder Image.network() for any images`,
    }],
    max_tokens: 4096,
  }, { apiUrl, apiKey });

  let code = response.content.trim();
  // Strip markdown fences if present
  code = code.replace(/^```dart\n?/m, '').replace(/```\s*$/m, '').trim();
  return code;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readExistingContext(root: string): Promise<ProjectContext | undefined> {
  try {
    const raw = await fs.readFile(path.join(root, '.av', 'context.json'), 'utf8');
    return JSON.parse(raw) as ProjectContext;
  } catch {
    return undefined;
  }
}

function buildContextPrompt(context?: ProjectContext): string {
  if (!context) return '';
  return `Project context (follow these patterns exactly):
- State management: ${context.stateManagement}
- Navigation: ${context.navigationLib}
- Networking: ${context.networkingLib}
- Architecture: ${context.architecturePattern}
- Package name: ${context.packageName}`;
}

function extractScreenName(figmaUrl: string): string {
  const match = figmaUrl.match(/[?&]t=([^&]+)/);
  if (match) return match[1]!.split('-').map(capitalize).join('');
  return 'FigmaScreen';
}

function toSnakeCase(name: string): string {
  return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
