/**
 * Project context engine — reads an existing Flutter project and uses LLM to
 * detect architecture patterns. Saves result to .av/context.json.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { llmChat } from './llm-client.js';
import type { AvConfig } from './config.js';

export interface ProjectContext {
  stateManagement:   'riverpod' | 'bloc' | 'provider' | 'getx' | 'none' | string;
  navigationLib:     'go_router' | 'auto_route' | 'navigator' | string;
  networkingLib:     'dio' | 'http' | 'chopper' | 'retrofit' | string;
  folderStructure:   'feature' | 'layer' | 'mixed' | string;
  architecturePattern: 'mvvm' | 'mvc' | 'clean' | 'simple' | string;
  existingScreens:   string[];
  packageName:       string;
  flutterVersion?:   string;
}

export async function analyzeProject(
  projectRoot: string,
  config: AvConfig,
): Promise<ProjectContext> {
  const pubspecContent = await readPubspec(projectRoot);
  const libSample      = await sampleLibFiles(projectRoot);

  const apiUrl = config.llmApiUrl ?? process.env['LLM_API_URL'] ?? 'https://quasarmarket.coforge.com/qag/llmrouter-api/v2/chat/completions';
  const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '';

  if (!apiKey) {
    return buildFallbackContext(pubspecContent);
  }

  const prompt = buildAnalysisPrompt(pubspecContent, libSample);

  try {
    const response = await llmChat(
      {
        model: config.model ?? 'gemini-1.5-flash',
        system: 'You are a Flutter project analyzer. Return ONLY valid JSON, no explanation.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
        json: true,
      },
      { apiUrl, apiKey }
    );

    const parsed = JSON.parse(response.content) as Partial<ProjectContext>;
    return {
      stateManagement:   parsed.stateManagement   ?? 'none',
      navigationLib:     parsed.navigationLib     ?? 'navigator',
      networkingLib:     parsed.networkingLib     ?? 'http',
      folderStructure:   parsed.folderStructure   ?? 'mixed',
      architecturePattern: parsed.architecturePattern ?? 'simple',
      existingScreens:   parsed.existingScreens   ?? [],
      packageName:       parsed.packageName       ?? extractPackageName(pubspecContent),
      flutterVersion:    parsed.flutterVersion,
    };
  } catch {
    return buildFallbackContext(pubspecContent);
  }
}

function buildAnalysisPrompt(pubspec: string, libSample: string): string {
  return `Analyze this Flutter project and return JSON:

pubspec.yaml:
${pubspec.slice(0, 2000)}

Sample lib/ files:
${libSample.slice(0, 3000)}

Return JSON with these fields:
{
  "stateManagement": "riverpod" | "bloc" | "provider" | "getx" | "none",
  "navigationLib": "go_router" | "auto_route" | "navigator",
  "networkingLib": "dio" | "http" | "chopper" | "retrofit" | "none",
  "folderStructure": "feature" | "layer" | "mixed",
  "architecturePattern": "mvvm" | "mvc" | "clean" | "simple",
  "existingScreens": ["HomeScreen", "LoginScreen", ...],
  "packageName": "your_app_name",
  "flutterVersion": "3.x.x"
}`;
}

async function readPubspec(projectRoot: string): Promise<string> {
  try {
    return await fs.readFile(path.join(projectRoot, 'pubspec.yaml'), 'utf8');
  } catch {
    return '';
  }
}

async function sampleLibFiles(projectRoot: string): Promise<string> {
  const libDir = path.join(projectRoot, 'lib');
  const samples: string[] = [];

  try {
    const entries = await collectDartFiles(libDir, 10);
    for (const filePath of entries) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        samples.push(`// ${path.relative(projectRoot, filePath)}\n${content.slice(0, 500)}`);
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // lib dir doesn't exist or not readable
  }

  return samples.join('\n\n');
}

async function collectDartFiles(dir: string, limit: number): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...(await collectDartFiles(fullPath, limit - results.length)));
      } else if (entry.isFile() && entry.name.endsWith('.dart')) {
        results.push(fullPath);
      }
    }
  } catch {
    // ignore read errors
  }
  return results.slice(0, limit);
}

function buildFallbackContext(pubspec: string): ProjectContext {
  const stateManagement =
    pubspec.includes('flutter_riverpod') ? 'riverpod'
    : pubspec.includes('flutter_bloc')   ? 'bloc'
    : pubspec.includes('provider')        ? 'provider'
    : pubspec.includes('get:')            ? 'getx'
    : 'none';

  const navigationLib =
    pubspec.includes('go_router')   ? 'go_router'
    : pubspec.includes('auto_route') ? 'auto_route'
    : 'navigator';

  const networkingLib =
    pubspec.includes('dio:')      ? 'dio'
    : pubspec.includes('chopper') ? 'chopper'
    : pubspec.includes('retrofit') ? 'retrofit'
    : 'http';

  return {
    stateManagement,
    navigationLib,
    networkingLib,
    folderStructure:   'mixed',
    architecturePattern: 'simple',
    existingScreens:   [],
    packageName:       extractPackageName(pubspec),
  };
}

function extractPackageName(pubspec: string): string {
  const match = /^name:\s*(\S+)/m.exec(pubspec);
  return match?.[1] ?? 'generated_app';
}
