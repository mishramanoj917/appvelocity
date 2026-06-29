/**
 * av build — flutter build + LLM compile-error fix loop.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import type { Command } from 'commander';
import { findProjectRoot, readConfig, applyConfigToEnv } from '../lib/config.js';
import { parseDartErrors, groupByFile } from '../lib/dart-error-parser.js';
import { llmChat } from '../lib/llm-client.js';

export function registerBuild(program: Command): void {
  program
    .command('build')
    .description('Build the Flutter app and auto-fix compile errors using LLM')
    .option('-t, --target <target>', 'Build target (apk, ios, web, macos)', 'apk')
    .option('--max-retries <n>', 'Max LLM fix attempts', '3')
    .option('--debug', 'Build in debug mode (faster)', false)
    .action(async (opts: { target: string; maxRetries: string; debug: boolean }) => {
      const { default: chalk } = await import('chalk');
      const { default: ora }   = await import('ora');

      const root   = await findProjectRoot();
      const config = await readConfig(root);
      applyConfigToEnv(config);

      const flutterBin  = process.env['FLUTTER_PATH'] ?? 'flutter';
      const maxRetries  = parseInt(opts.maxRetries, 10);
      const mode        = opts.debug ? '--debug' : '--release';
      const apiUrl      = config.llmApiUrl ?? process.env['LLM_API_URL'] ?? '';
      const apiKey      = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '';

      console.log(chalk.bold(`\nBuilding Flutter app (${opts.target} ${mode})…\n`));

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const spinner = ora(`Build attempt ${attempt}…`).start();
        const { exitCode, output } = await runFlutterBuild(flutterBin, opts.target, mode, root);

        if (exitCode === 0) {
          spinner.succeed(chalk.green(`Build succeeded on attempt ${attempt}`));
          return;
        }

        spinner.fail(`Build failed (attempt ${attempt})`);

        const errors = parseDartErrors(output);
        const errorErrors = errors.filter((e) => e.severity === 'error');

        if (errorErrors.length === 0) {
          console.log(chalk.yellow('\nBuild failed but no parseable Dart errors found. Check output above.'));
          console.log(output.slice(-2000));
          return;
        }

        console.log(chalk.yellow(`\n  ${errorErrors.length} error(s) found:`));
        for (const e of errorErrors.slice(0, 5)) {
          console.log(chalk.red(`  ${e.filePath}:${e.line}:${e.col} — ${e.message}`));
        }

        if (attempt > maxRetries) {
          console.log(chalk.red(`\nMax retries (${maxRetries}) reached. ${errorErrors.length} error(s) remain.`));
          return;
        }

        if (!apiKey) {
          console.log(chalk.yellow('\nNo API key configured — cannot auto-fix. Run: av config set apiKey <key>'));
          return;
        }

        const fixSpinner = ora('Applying LLM fixes…').start();
        const byFile = groupByFile(errorErrors);
        let fixCount = 0;

        for (const [filePath, fileErrors] of byFile) {
          const fullPath = path.join(root, filePath);
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const errList = fileErrors.map((e) => `  Line ${e.line}:${e.col} — ${e.message}`).join('\n');

            const contextLines = extractErrorContext(content, fileErrors);

            const response = await llmChat({
              model: config.model ?? 'gemini-1.5-pro',
              system: `You are a Flutter/Dart expert. Fix Dart compilation errors.
Return ONLY the corrected Dart file content. No markdown fences, no explanations.
Do not change logic — only fix the compilation errors listed.`,
              messages: [{
                role: 'user',
                content: `Fix these Dart errors in ${filePath}:
${errList}

Relevant code context:
${contextLines}

Full file content:
${content}`,
              }],
              max_tokens: 4096,
            }, { apiUrl, apiKey });

            let fixed = response.content.trim();
            // Strip markdown fences if present
            fixed = fixed.replace(/^```dart\n?/m, '').replace(/```\s*$/m, '').trim();

            if (fixed.length > 50 && fixed.includes('class') || fixed.includes('import')) {
              await fs.writeFile(fullPath, fixed, 'utf8');
              fixCount++;
            }
          } catch (err) {
            console.log(chalk.yellow(`  Could not fix ${filePath}: ${err instanceof Error ? err.message : String(err)}`));
          }
        }

        fixSpinner.succeed(`Applied fixes to ${fixCount} file(s)`);
        console.log('');
      }
    });
}

async function runFlutterBuild(
  flutterBin: string,
  target: string,
  mode: string,
  cwd: string,
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const args = ['build', target, mode];
    const proc = spawn(flutterBin, args, { cwd, stdio: 'pipe' });
    let output = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    proc.on('close', (code) => resolve({ exitCode: code ?? 1, output }));
    proc.on('error', () => resolve({ exitCode: 1, output }));
  });
}

function extractErrorContext(content: string, errors: { line: number }[]): string {
  const lines  = content.split('\n');
  const ranges = new Set<number>();
  for (const e of errors) {
    for (let l = Math.max(0, e.line - 10); l <= Math.min(lines.length - 1, e.line + 5); l++) {
      ranges.add(l);
    }
  }
  return [...ranges].sort((a, b) => a - b)
    .map((l) => `${l + 1}: ${lines[l] ?? ''}`)
    .join('\n');
}
