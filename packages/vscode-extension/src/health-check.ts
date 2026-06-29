/**
 * Health check — verifies the environment is ready before generate/build/run.
 *
 * Each check returns a status:
 *   ok    — ready
 *   warn  — works but degraded (e.g. no devices connected)
 *   fail  — blocks the operation (e.g. no Flutter SDK, no API key)
 *
 * `gate('generate')` / `gate('build')` / `gate('run')` return only the checks
 * relevant to that operation so the panel can block on a critical failure.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export type HealthStatus = 'ok' | 'warn' | 'fail';

export interface HealthItem {
  id:       string;
  label:    string;
  status:   HealthStatus;
  detail:   string;
  /** Operations this check is required for. Empty = informational only. */
  requiredFor: Array<'generate' | 'build' | 'run'>;
  /** Optional hint on how to fix a fail/warn. */
  fix?:     string;
}

export interface HealthReport {
  items:    HealthItem[];
  ok:       boolean; // true if no `fail` items at all
}

function flutterBin(): string {
  return vscode.workspace.getConfiguration('appvelocity').get<string>('flutterPath') || 'flutter';
}

function workspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkFlutterSdk(): Promise<HealthItem> {
  const base: Omit<HealthItem, 'status' | 'detail'> = {
    id: 'flutter',
    label: 'Flutter SDK / CLI',
    requiredFor: ['build', 'run'],
    fix: 'Install Flutter and ensure `flutter` is on PATH, or set appvelocity.flutterPath in settings.',
  };
  try {
    const { stdout } = await execFileAsync(flutterBin(), ['--version'], { timeout: 20_000 });
    const version = (stdout.split('\n')[0] ?? '').trim();
    return { ...base, status: 'ok', detail: version || 'Flutter available' };
  } catch {
    return { ...base, status: 'fail', detail: 'flutter command not found' };
  }
}

async function checkDartSdk(): Promise<HealthItem> {
  const base: Omit<HealthItem, 'status' | 'detail'> = {
    id: 'dart',
    label: 'Dart SDK',
    requiredFor: ['build'],
    fix: 'Dart ships with Flutter — fixing the Flutter SDK check usually resolves this.',
  };
  try {
    const { stdout, stderr } = await execFileAsync('dart', ['--version'], { timeout: 15_000 });
    const out = (stdout || stderr).trim();
    return { ...base, status: 'ok', detail: out || 'Dart available' };
  } catch {
    // Non-fatal — flutter bundles dart even if `dart` isn't separately on PATH.
    return { ...base, status: 'warn', detail: 'dart not on PATH (Flutter bundles its own)' };
  }
}

function checkProject(): HealthItem {
  const base: Omit<HealthItem, 'status' | 'detail'> = {
    id: 'project',
    label: 'Flutter project (pubspec.yaml)',
    requiredFor: ['generate', 'build', 'run'],
    fix: 'Open a folder that contains a pubspec.yaml at its root.',
  };
  const root = workspaceRoot();
  if (!root) return { ...base, status: 'fail', detail: 'No workspace folder open' };
  if (fs.existsSync(path.join(root, 'pubspec.yaml'))) {
    return { ...base, status: 'ok', detail: path.basename(root) };
  }
  return { ...base, status: 'fail', detail: 'pubspec.yaml not found in workspace root' };
}

function checkApiCredentials(): HealthItem[] {
  const cfg = vscode.workspace.getConfiguration('appvelocity');
  const apiUrl = cfg.get<string>('llmApiUrl') || '';
  const apiKey = cfg.get<string>('apiKey') || '';

  const urlItem: HealthItem = {
    id: 'llmApiUrl',
    label: 'LLM proxy URL',
    requiredFor: ['generate'],
    status: apiUrl ? 'ok' : 'fail',
    detail: apiUrl ? redactUrl(apiUrl) : 'not configured',
    fix: 'Set appvelocity.llmApiUrl in settings (Configure API Keys).',
  };
  const keyItem: HealthItem = {
    id: 'apiKey',
    label: 'LLM API key',
    requiredFor: ['generate'],
    status: apiKey ? 'ok' : 'fail',
    detail: apiKey ? `set (${mask(apiKey)})` : 'not configured',
    fix: 'Set appvelocity.apiKey in settings (Configure API Keys).',
  };
  return [urlItem, keyItem];
}

function checkFigmaToken(): HealthItem {
  const token =
    vscode.workspace.getConfiguration('appvelocity').get<string>('figmaToken') ||
    process.env['FIGMA_ACCESS_TOKEN'] ||
    '';
  return {
    id: 'figmaToken',
    label: 'Figma access token',
    requiredFor: ['generate'],
    status: token ? 'ok' : 'warn',
    detail: token ? `set (${mask(token)})` : 'not set (only needed for Figma generation)',
    fix: 'Set appvelocity.figmaToken in settings, or paste a token in the Generate tab.',
  };
}

function checkFigmaMcp(): HealthItem {
  const base: Omit<HealthItem, 'status' | 'detail'> = {
    id: 'figmaMcp',
    label: 'Figma MCP server',
    requiredFor: [], // informational — REST fallback exists
    fix: 'Add a "figma" entry under mcpServers in .claude/settings.json (project or ~/.claude).',
  };

  // Look in the project root first, then the user-global Claude config.
  const candidates = [
    path.join(workspaceRoot(), '.claude', 'settings.json'),
    path.join(process.env['HOME'] || '', '.claude', 'settings.json'),
    path.join(process.env['HOME'] || '', '.claude.json'),
  ].filter((p) => p && !p.startsWith(path.sep + '.claude')); // drop empty-HOME garbage

  for (const settingsPath of candidates) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const json = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      if (json.mcpServers && json.mcpServers['figma']) {
        const where = settingsPath.includes(workspaceRoot()) ? 'project' : 'user (~/.claude)';
        return { ...base, status: 'ok', detail: `configured (${where})` };
      }
    } catch {
      // missing / unparseable — try next candidate
    }
  }
  return { ...base, status: 'warn', detail: 'not configured — REST API fallback will be used' };
}

async function checkDevices(): Promise<HealthItem> {
  const base: Omit<HealthItem, 'status' | 'detail'> = {
    id: 'devices',
    label: 'Connected devices / emulators',
    requiredFor: ['run'],
    fix: 'Start an emulator/simulator or connect a device, then refresh.',
  };
  try {
    // First run after boot can be slow while iOS/Android tooling spins up.
    const { stdout, stderr } = await execFileAsync(
      flutterBin(),
      ['devices', '--machine'],
      { timeout: 45_000, cwd: workspaceRoot() || undefined, maxBuffer: 4 * 1024 * 1024 },
    );
    const devices = parseDevicesJson(stdout);
    if (devices === null) {
      const hint = (stderr || stdout).split('\n').find(Boolean)?.trim() ?? 'unexpected output';
      return { ...base, status: 'warn', detail: `unparseable device output (${hint.slice(0, 80)})` };
    }
    const usable = devices.filter((d) => d.isSupported !== false);
    if (usable.length === 0) return { ...base, status: 'warn', detail: 'no devices found' };
    return { ...base, status: 'ok', detail: `${usable.length} device(s): ${usable.map((d) => d.name).join(', ')}` };
  } catch (err) {
    const e = err as { killed?: boolean; signal?: string; code?: string; message?: string };
    if (e.killed || e.signal === 'SIGTERM') {
      return { ...base, status: 'warn', detail: 'device query timed out (try refresh — first scan is slow)' };
    }
    if (e.code === 'ENOENT') {
      return { ...base, status: 'warn', detail: 'flutter not found (set appvelocity.flutterPath)' };
    }
    return { ...base, status: 'warn', detail: `could not query devices: ${(e.message ?? '').slice(0, 80)}` };
  }
}

/**
 * `flutter devices --machine` sometimes prints a non-JSON preamble line before
 * the JSON array. Extract the first top-level JSON array and parse it.
 */
function parseDevicesJson(out: string): Array<{ name: string; isSupported?: boolean }> | null {
  const start = out.indexOf('[');
  const end = out.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(out.slice(start, end + 1)) as Array<{ name: string; isSupported?: boolean }>;
  } catch {
    return null;
  }
}

// ── Orchestration ─────────────────────────────────────────────────────────────

export async function runHealthCheck(): Promise<HealthReport> {
  const [flutter, dart, devices] = await Promise.all([
    checkFlutterSdk(),
    checkDartSdk(),
    checkDevices(),
  ]);

  const items: HealthItem[] = [
    checkProject(),
    flutter,
    dart,
    ...checkApiCredentials(),
    checkFigmaToken(),
    checkFigmaMcp(),
    devices,
  ];

  return { items, ok: items.every((i) => i.status !== 'fail') };
}

/**
 * Returns the subset of checks required for an operation, plus whether the
 * operation is cleared to proceed (no `fail` among its required checks).
 */
export function gate(
  report: HealthReport,
  op: 'generate' | 'build' | 'run',
): { cleared: boolean; blocking: HealthItem[]; relevant: HealthItem[] } {
  const relevant = report.items.filter((i) => i.requiredFor.includes(op));
  const blocking = relevant.filter((i) => i.status === 'fail');
  return { cleared: blocking.length === 0, blocking, relevant };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function mask(secret: string): string {
  if (secret.length <= 6) return '••••';
  return `${secret.slice(0, 4)}…${secret.slice(-2)}`;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
