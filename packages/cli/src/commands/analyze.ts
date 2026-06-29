/**
 * av analyze — detect Flutter project architecture and save context.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Command } from 'commander';
import { findProjectRoot, readConfig, writeConfig } from '../lib/config.js';
import { analyzeProject } from '../lib/project-context.js';

export function registerAnalyze(program: Command): void {
  program
    .command('analyze')
    .description('Analyze the current Flutter project and detect its architecture patterns')
    .option('-o, --output <path>', 'Output path for context JSON', '.av/context.json')
    .action(async (opts: { output: string }) => {
      const { default: chalk } = await import('chalk');
      const { default: ora }   = await import('ora');

      const spinner = ora('Finding Flutter project root…').start();
      const root    = await findProjectRoot();
      const config  = await readConfig(root);

      spinner.text = 'Reading project files…';
      const context = await analyzeProject(root, config);

      // Save context
      const outputPath = path.join(root, opts.output);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(context, null, 2));

      spinner.succeed('Project analyzed');

      console.log('');
      console.log(chalk.bold('Project context:'));
      console.log(`  State management : ${chalk.cyan(context.stateManagement)}`);
      console.log(`  Navigation       : ${chalk.cyan(context.navigationLib)}`);
      console.log(`  Networking       : ${chalk.cyan(context.networkingLib)}`);
      console.log(`  Architecture     : ${chalk.cyan(context.architecturePattern)}`);
      console.log(`  Folder structure : ${chalk.cyan(context.folderStructure)}`);
      if (context.existingScreens.length > 0) {
        console.log(`  Screens found    : ${chalk.cyan(context.existingScreens.join(', '))}`);
      }
      console.log('');
      console.log(chalk.green(`Saved to ${outputPath}`));
      console.log(chalk.dim('Run av generate --figma <url> to generate a screen'));
    });
}
