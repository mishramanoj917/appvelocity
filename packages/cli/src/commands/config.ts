/**
 * av config — read/write CLI configuration in .av/config.json
 */

import type { Command } from 'commander';
import { findProjectRoot, readConfig, writeConfig } from '../lib/config.js';
import type { AvConfig } from '../lib/config.js';

const VALID_KEYS: Array<keyof AvConfig> = ['llmApiUrl', 'apiKey', 'model', 'figmaToken', 'maxBuildRetries'];

export function registerConfig(program: Command): void {
  const config = program.command('config').description('Read and write CLI configuration');

  config
    .command('set <key> <value>')
    .description(`Set a config value. Keys: ${VALID_KEYS.join(', ')}`)
    .action(async (key: string, value: string) => {
      const { default: chalk } = await import('chalk');
      if (!VALID_KEYS.includes(key as keyof AvConfig)) {
        console.log(chalk.red(`Unknown key: ${key}. Valid keys: ${VALID_KEYS.join(', ')}`));
        process.exit(1);
      }
      const root = await findProjectRoot();
      const cfg  = await readConfig(root);
      const typed = key === 'maxBuildRetries' ? parseInt(value, 10) : value;
      (cfg as Record<string, unknown>)[key] = typed;
      await writeConfig(root, cfg);
      console.log(chalk.green(`Set ${key} = ${value}`));
    });

  config
    .command('get [key]')
    .description('Show current configuration')
    .action(async (key?: string) => {
      const { default: chalk } = await import('chalk');
      const root = await findProjectRoot();
      const cfg  = await readConfig(root);

      if (key) {
        const val = (cfg as Record<string, unknown>)[key];
        console.log(val !== undefined ? String(val) : chalk.dim('(not set)'));
      } else {
        console.log(chalk.bold('\nAppVelocity CLI configuration:\n'));
        for (const k of VALID_KEYS) {
          const v = cfg[k];
          const display = k === 'apiKey' && v ? '****' + String(v).slice(-4) : (v ?? chalk.dim('(not set)'));
          console.log(`  ${k.padEnd(18)} ${display}`);
        }
      }
    });
}
