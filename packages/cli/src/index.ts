#!/usr/bin/env node
/**
 * AppVelocity CLI — av
 *
 * Commands:
 *   av analyze                       Detect Flutter project architecture
 *   av generate --figma <url>        Generate screen from Figma
 *   av generate --screenshot <path>  Generate screen from screenshot
 *   av generate --prompt <text>      Generate screen from description
 *   av build [--target apk|ios|web]  Build with LLM error fix loop
 *   av run [--device <id>]           Run app with error recovery
 *   av config set <key> <value>      Configure CLI settings
 *   av config get [key]              Show configuration
 */

import { Command } from 'commander';
import { registerAnalyze }  from './commands/analyze.js';
import { registerGenerate } from './commands/generate.js';
import { registerBuild }    from './commands/build.js';
import { registerRun }      from './commands/run.js';
import { registerConfig }   from './commands/config.js';

const program = new Command();

program
  .name('av')
  .description('AppVelocity Flutter CLI — AI-powered Flutter development assistant')
  .version('0.1.0');

registerAnalyze(program);
registerGenerate(program);
registerBuild(program);
registerRun(program);
registerConfig(program);

program.parse(process.argv);
