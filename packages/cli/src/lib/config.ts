/**
 * CLI config — reads/writes .av/config.json in the project root.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface AvConfig {
  llmApiUrl?:    string;
  apiKey?:       string;
  model?:        string;
  figmaToken?:   string;
  maxBuildRetries?: number;
}

export async function findProjectRoot(startDir = process.cwd()): Promise<string> {
  let dir = startDir;
  while (true) {
    try {
      await fs.access(path.join(dir, 'pubspec.yaml'));
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return startDir; // reached filesystem root
      dir = parent;
    }
  }
}

export async function readConfig(projectRoot: string): Promise<AvConfig> {
  const configPath = path.join(projectRoot, '.av', 'config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw) as AvConfig;
  } catch {
    return {};
  }
}

export async function writeConfig(projectRoot: string, config: AvConfig): Promise<void> {
  const avDir = path.join(projectRoot, '.av');
  await fs.mkdir(avDir, { recursive: true });
  await fs.writeFile(path.join(avDir, 'config.json'), JSON.stringify(config, null, 2));
}

export function applyConfigToEnv(config: AvConfig): void {
  if (config.llmApiUrl)  process.env['LLM_API_URL']     = config.llmApiUrl;
  if (config.apiKey)     process.env['ANTHROPIC_API_KEY'] = config.apiKey;
  if (config.model)      process.env['OVERRIDE_MODEL']   = config.model;
  if (config.figmaToken) process.env['FIGMA_ACCESS_TOKEN'] = config.figmaToken;
}
