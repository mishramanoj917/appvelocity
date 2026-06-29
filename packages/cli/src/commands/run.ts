/**
 * av run — run the Flutter app with device selection and error recovery.
 */

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import type { Command } from 'commander';
import { findProjectRoot, readConfig, applyConfigToEnv } from '../lib/config.js';

const execFileAsync = promisify(execFile);

export function registerRun(program: Command): void {
  program
    .command('run')
    .description('Run the Flutter app with LLM-powered error recovery')
    .option('-d, --device <id>', 'Device ID to run on (use "av run --list-devices" to see options)')
    .option('--list-devices', 'List available devices and exit', false)
    .option('--release', 'Run in release mode', false)
    .action(async (opts: { device?: string; listDevices: boolean; release: boolean }) => {
      const { default: chalk } = await import('chalk');

      const root   = await findProjectRoot();
      const config = await readConfig(root);
      applyConfigToEnv(config);

      const flutterBin = process.env['FLUTTER_PATH'] ?? 'flutter';

      if (opts.listDevices) {
        await listDevices(flutterBin, chalk);
        return;
      }

      const deviceId = opts.device ?? await pickDevice(flutterBin);
      if (!deviceId) {
        console.log(chalk.yellow('No device selected. Use --device <id> or connect a device/emulator.'));
        return;
      }

      const args = ['run', '-d', deviceId];
      if (opts.release) args.push('--release');

      console.log(chalk.bold(`\nStarting Flutter app on device: ${deviceId}\n`));
      console.log(chalk.dim('  r  → hot reload'));
      console.log(chalk.dim('  R  → hot restart'));
      console.log(chalk.dim('  q  → quit'));
      console.log('');

      const proc = spawn(flutterBin, args, { cwd: root, stdio: ['inherit', 'inherit', 'inherit'] });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\nApp exited cleanly.'));
        } else {
          console.log(chalk.yellow(`\nApp exited with code ${code}.`));
          console.log(chalk.dim('Run av build to check for compile errors.'));
        }
      });

      proc.on('error', (err) => {
        console.log(chalk.red(`\nFailed to start Flutter: ${err.message}`));
        console.log(chalk.dim('Make sure Flutter SDK is installed and on your PATH, or set FLUTTER_PATH env var.'));
      });
    });
}

async function listDevices(flutterBin: string, chalk: typeof import('chalk').default): Promise<void> {
  try {
    const { stdout } = await execFileAsync(flutterBin, ['devices', '--machine'], { timeout: 30_000 });
    const devices = JSON.parse(stdout) as Array<{ id: string; name: string; platform: string; isSupported: boolean }>;

    console.log(chalk.bold('\nAvailable devices:\n'));
    for (const d of devices.filter((d) => d.isSupported)) {
      console.log(`  ${chalk.cyan(d.id.padEnd(30))} ${d.name} (${d.platform})`);
    }
    if (devices.filter((d) => d.isSupported).length === 0) {
      console.log(chalk.yellow('  No devices found. Connect a device or start an emulator.'));
    }
  } catch {
    console.log(chalk.yellow('Could not list devices. Is Flutter installed?'));
  }
}

async function pickDevice(flutterBin: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(flutterBin, ['devices', '--machine'], { timeout: 30_000 });
    const devices = JSON.parse(stdout) as Array<{ id: string; isSupported: boolean }>;
    const supported = devices.filter((d) => d.isSupported);
    return supported[0]?.id;
  } catch {
    return undefined;
  }
}
