/**
 * Screen generator for the VS Code extension.
 *
 * Self-contained (uses Node's built-in fetch) and mirrors the CLI's proven
 * Figma-fetch → LLM-generate → write-file flow so the extension has no runtime
 * dependency on the CLI being installed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export interface GenerateOptions {
  figmaUrl?:   string;
  figmaToken?: string;
  prompt?:     string;
  outDir?:     string; // relative to lib/, default 'screens'
}

export interface GenerateResult {
  relativePath: string;
  absolutePath: string;
  screenName:   string;
}

interface ExtConfig {
  apiUrl: string;
  apiKey: string;
  model:  string;
}

function readExtConfig(): ExtConfig {
  const cfg = vscode.workspace.getConfiguration('appvelocity');
  return {
    apiUrl: cfg.get<string>('llmApiUrl') || '',
    apiKey: cfg.get<string>('apiKey') || '',
    model:  cfg.get<string>('model') || 'gemini-1.5-pro',
  };
}

function workspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

/**
 * Generate a Flutter screen and write it into the project's lib/ folder.
 * `log` streams human-readable progress back to the panel.
 */
export async function generateScreen(
  opts: GenerateOptions,
  log: (line: string) => void,
): Promise<GenerateResult> {
  const root = workspaceRoot();
  if (!root) throw new Error('No workspace folder open');

  const { apiUrl, apiKey, model } = readExtConfig();
  if (!apiUrl || !apiKey) {
    throw new Error('LLM proxy URL and API key must be configured (Configure API Keys).');
  }

  let designSpec = '';
  let screenName = 'GeneratedScreen';

  if (opts.figmaUrl) {
    const token =
      opts.figmaToken ||
      vscode.workspace.getConfiguration('appvelocity').get<string>('figmaToken') ||
      process.env['FIGMA_ACCESS_TOKEN'] ||
      '';
    if (!token) throw new Error('A Figma access token is required to generate from a Figma URL.');

    log('Fetching Figma design…');
    const { spec, name } = await fetchFigmaSpec(opts.figmaUrl, token);
    designSpec = spec;
    screenName = name;
  } else if (opts.prompt) {
    designSpec = `Screen description: ${opts.prompt}`;
    screenName = opts.prompt.split(/\s+/).slice(0, 3).map(capitalize).join('') || 'PromptScreen';
  } else {
    throw new Error('Provide a Figma URL or a text prompt.');
  }

  const context = await readProjectContext(root);
  log('Generating Flutter code…');
  const dartCode = await generateDartCode({ screenName, designSpec, context, apiUrl, apiKey, model });

  const outRel  = path.join('lib', opts.outDir || 'screens');
  const outDir  = path.join(root, outRel);
  await fs.mkdir(outDir, { recursive: true });

  const fileName = `${toSnakeCase(screenName)}_screen.dart`;
  const absPath  = path.join(outDir, fileName);
  await fs.writeFile(absPath, dartCode, 'utf8');

  const relativePath = path.join(outRel, fileName);
  log(`Wrote ${relativePath}`);
  return { relativePath, absolutePath: absPath, screenName };
}

// ── Figma ─────────────────────────────────────────────────────────────────────

async function fetchFigmaSpec(figmaUrl: string, token: string): Promise<{ spec: string; name: string }> {
  const fileMatch = figmaUrl.match(/figma\.com\/(?:file|design)\/([^/?]+)/);
  if (!fileMatch) throw new Error(`Invalid Figma URL: ${figmaUrl}`);
  const fileKey = fileMatch[1]!;

  const nodeMatch = figmaUrl.match(/[?&]node-id=([^&]+)/);
  const nodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]!).replace('-', ':') : undefined;

  const url = `https://api.figma.com/v1/files/${fileKey}${nodeId ? `/nodes?ids=${nodeId}` : ''}`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { name?: string; document?: unknown; nodes?: unknown };
  const name = data.name ? toPascalCase(data.name) : 'FigmaScreen';
  const spec = JSON.stringify(nodeId ? data.nodes : data.document, null, 2).slice(0, 8000);
  return { spec, name };
}

// ── LLM ───────────────────────────────────────────────────────────────────────

async function generateDartCode(args: {
  screenName: string;
  designSpec: string;
  context:    string;
  apiUrl:     string;
  apiKey:     string;
  model:      string;
}): Promise<string> {
  const { screenName, designSpec, context, apiUrl, apiKey, model } = args;

  const body = {
    model: process.env['OVERRIDE_MODEL'] ?? model,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: `You are a Flutter/Dart expert. Generate production-quality, compilable Dart code.
Return ONLY raw Dart source code. No markdown fences, no explanations.
Always import package:flutter/material.dart.
Extend StatelessWidget (StatefulWidget only if local state is needed).
Use const constructors. Handle null safety. No dynamic types.
Wrap the screen body in SafeArea. Use const spacing values.`,
      },
      {
        role: 'user',
        content: `Generate a Flutter screen widget named ${screenName}.

${context}

Design specification:
${designSpec}

Requirements:
- class ${screenName} extends StatelessWidget
- const ${screenName}({super.key});
- Scaffold with a SafeArea body
- Match the design as closely as possible
- Use Image.network() placeholders for any images`,
      },
    ],
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-api-key':     apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let code = (data.choices?.[0]?.message?.content ?? '').trim();
  code = code.replace(/^```dart\n?/m, '').replace(/```\s*$/m, '').trim();
  if (!code) throw new Error('LLM returned empty code');
  return code;
}

// ── Project context ─────────────────────────────────────────────────────────────

async function readProjectContext(root: string): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(root, '.av', 'context.json'), 'utf8');
    const ctx = JSON.parse(raw) as Record<string, string>;
    return `Project context (follow these patterns exactly):
- State management: ${ctx['stateManagement'] ?? 'unknown'}
- Navigation: ${ctx['navigationLib'] ?? 'unknown'}
- Networking: ${ctx['networkingLib'] ?? 'unknown'}
- Architecture: ${ctx['architecturePattern'] ?? 'unknown'}`;
  } catch {
    return '';
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(capitalize)
    .join('') || 'FigmaScreen';
}

function toSnakeCase(name: string): string {
  return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
