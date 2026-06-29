/**
 * FlutterRunner — spawns flutter CLI commands and streams output.
 */

import { spawn, execFile, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export interface BuildResult {
  success: boolean;
  output:  string;
  errors:  DartCompileError[];
}

export interface DartCompileError {
  file:    string;
  line:    number;
  col:     number;
  message: string;
}

export class FlutterRunner {
  private runProcess: ChildProcess | undefined;

  get flutterBin(): string {
    const config = vscode.workspace.getConfiguration('appvelocity');
    return config.get<string>('flutterPath') || 'flutter';
  }

  get workspacePath(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  async build(
    target = 'apk',
    onOutput: (line: string) => void,
  ): Promise<BuildResult> {
    return new Promise((resolve) => {
      const proc = spawn(
        this.flutterBin,
        ['build', target, '--debug'],
        { cwd: this.workspacePath, stdio: 'pipe' }
      );
      let output = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        text.split('\n').filter(Boolean).forEach(onOutput);
      });
      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        text.split('\n').filter(Boolean).forEach(onOutput);
      });
      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          errors:  code === 0 ? [] : parseDartErrors(output),
        });
      });
      proc.on('error', () => resolve({ success: false, output, errors: [] }));
    });
  }

  // ── Run ────────────────────────────────────────────────────────────────────

  async run(
    deviceId: string,
    onOutput: (line: string) => void,
    onExit:   (code: number) => void,
  ): Promise<void> {
    this.runProcess?.kill();
    this.runProcess = spawn(
      this.flutterBin,
      ['run', '-d', deviceId],
      { cwd: this.workspacePath, stdio: 'pipe' }
    );

    this.runProcess.stdout?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(onOutput);
    });
    this.runProcess.stderr?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(onOutput);
    });
    this.runProcess.on('close', (code) => onExit(code ?? 0));
  }

  hotReload():  void { this.runProcess?.stdin?.write('r'); }
  hotRestart(): void { this.runProcess?.stdin?.write('R'); }
  stop():       void { this.runProcess?.stdin?.write('q'); this.runProcess?.kill(); }

  // ── Analyze ────────────────────────────────────────────────────────────────

  async analyze(): Promise<{ errors: DartCompileError[]; output: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(
        this.flutterBin,
        ['analyze', '--no-fatal-infos'],
        { cwd: this.workspacePath, timeout: 60_000 }
      );
      const output = stdout + stderr;
      return { errors: parseDartErrors(output), output };
    } catch (err) {
      const output = (err as { stderr?: string; stdout?: string }).stderr ?? '';
      return { errors: parseDartErrors(output), output };
    }
  }

  // ── Device list ────────────────────────────────────────────────────────────

  async getDevices(): Promise<Array<{ id: string; name: string; platform: string }>> {
    try {
      const { stdout } = await execFileAsync(
        this.flutterBin,
        ['devices', '--machine'],
        { timeout: 45_000, cwd: this.workspacePath || undefined, maxBuffer: 4 * 1024 * 1024 }
      );
      const start = stdout.indexOf('[');
      const end = stdout.lastIndexOf(']');
      if (start === -1 || end === -1) return [];
      const devices = JSON.parse(stdout.slice(start, end + 1)) as Array<{
        id: string; name: string; targetPlatform: string; isSupported?: boolean;
      }>;
      return devices.filter((d) => d.isSupported !== false).map((d) => ({
        id:       d.id,
        name:     d.name,
        platform: d.targetPlatform,
      }));
    } catch {
      return [];
    }
  }
}

function parseDartErrors(output: string): DartCompileError[] {
  const errors: DartCompileError[] = [];
  const regex = /^([\w/\\.-]+\.dart):(\d+):(\d+):\s*(?:Error|error):\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(output)) !== null) {
    errors.push({
      file:    m[1]!,
      line:    parseInt(m[2]!, 10),
      col:     parseInt(m[3]!, 10),
      message: m[4]!.trim(),
    });
  }
  return errors;
}
