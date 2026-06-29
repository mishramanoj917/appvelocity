/**
 * AppVelocity sidebar WebView panel.
 *
 * Hosts the HTML panel that communicates with the extension host via
 * postMessage for all AI and Flutter CLI operations. Generate/Build/Run are
 * gated behind a health check (Flutter SDK, API keys, Figma token/MCP, …).
 */

import * as vscode from 'vscode';
import { FlutterRunner } from '../flutter-runner.js';
import { generateScreen } from '../generator.js';
import { runHealthCheck, gate, type HealthItem } from '../health-check.js';

export class AppVelocityPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'appvelocity.panel';

  private _view?: vscode.WebviewView;
  private readonly _runner = new FlutterRunner();

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: PanelMessage) => {
      await this._handleMessage(msg);
    });
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<void> {
    this._post({ type: 'healthRunning' });
    const report = await runHealthCheck();
    this._post({ type: 'healthResult', items: report.items, ok: report.ok });
  }

  /**
   * Run the relevant health checks for `op`. If a required check fails, surface
   * the blockers and return false (operation must not proceed).
   */
  private async _preflight(op: 'generate' | 'build' | 'run'): Promise<boolean> {
    const report = await runHealthCheck();
    this._post({ type: 'healthResult', items: report.items, ok: report.ok });
    const { cleared, blocking } = gate(report, op);
    if (!cleared) {
      this._post({ type: 'preflightBlocked', op, blocking });
    }
    return cleared;
  }

  // ── Command handlers ────────────────────────────────────────────────────────

  async analyzeProject(): Promise<void> {
    this._post({ type: 'status', text: 'Analyzing project…' });
    const { errors, output } = await this._runner.analyze();
    this._post({ type: 'analyzeResult', errors, output });
  }

  async generate(figmaUrl?: string, figmaToken?: string, prompt?: string): Promise<void> {
    if (!(await this._preflight('generate'))) return;

    this._post({ type: 'genStart' });
    try {
      const result = await generateScreen(
        { figmaUrl, figmaToken, prompt },
        (line) => this._post({ type: 'genLog', line }),
      );
      this._post({ type: 'genDone', success: true, file: result.relativePath });

      // Open the generated file in the editor
      const doc = await vscode.workspace.openTextDocument(result.absolutePath);
      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showInformationMessage(`AppVelocity: generated ${result.relativePath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._post({ type: 'genDone', success: false, error: message });
      this._post({ type: 'genLog', line: `Error: ${message}` });
    }
  }

  async buildAndFix(): Promise<void> {
    if (!(await this._preflight('build'))) return;

    this._post({ type: 'buildStart' });
    const result = await this._runner.build('apk', (line) => {
      this._post({ type: 'buildLog', line });
    });
    this._post({ type: 'buildDone', success: result.success, errors: result.errors });
  }

  async runApp(deviceId: string): Promise<void> {
    if (!(await this._preflight('run'))) return;

    this._post({ type: 'runStart', deviceId });
    await this._runner.run(
      deviceId,
      (line) => this._post({ type: 'runLog', line }),
      (code) => this._post({ type: 'runDone', code }),
    );
  }

  async listDevices(): Promise<void> {
    const devices = await this._runner.getDevices();
    this._post({ type: 'deviceList', devices });
  }

  hotReload():  void { this._runner.hotReload(); }
  hotRestart(): void { this._runner.hotRestart(); }
  stopApp():    void { this._runner.stop(); }

  // ── Message handler ─────────────────────────────────────────────────────────

  private async _handleMessage(msg: PanelMessage): Promise<void> {
    switch (msg.type) {
      case 'health':      await this.healthCheck(); break;
      case 'analyze':     await this.analyzeProject(); break;
      case 'generate':    await this.generate(msg.figmaUrl, msg.figmaToken, msg.prompt); break;
      case 'build':       await this.buildAndFix();    break;
      case 'run':         await this.runApp(msg.deviceId ?? ''); break;
      case 'listDevices': await this.listDevices();    break;
      case 'hotReload':   this.hotReload();            break;
      case 'hotRestart':  this.hotRestart();           break;
      case 'stopApp':     this.stopApp();              break;
      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'appvelocity');
        break;
    }
  }

  private _post(msg: Record<string, unknown>): void {
    this._view?.webview.postMessage(msg);
  }

  // ── HTML ────────────────────────────────────────────────────────────────────

  private _getHtml(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AppVelocity Flutter</title>
<style>
  :root { --brand: #f15b40; --bg: var(--vscode-sideBar-background); --fg: var(--vscode-foreground); --card: var(--vscode-editor-background); --border: var(--vscode-panel-border); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); font-size: 13px; background: var(--bg); color: var(--fg); }
  .header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .header h1 { font-size: 14px; font-weight: 600; }
  .logo { width: 20px; height: 20px; background: var(--brand); border-radius: 4px; }
  .tabs { display: flex; border-bottom: 1px solid var(--border); }
  .tab { flex: 1; padding: 8px 4px; font-size: 11px; cursor: pointer; text-align: center; border-bottom: 2px solid transparent; color: var(--vscode-descriptionForeground); }
  .tab.active { border-bottom-color: var(--brand); color: var(--fg); }
  .panel { padding: 12px 16px; }
  .panel:not(.active) { display: none; }
  .btn { display: block; width: 100%; padding: 8px 12px; background: var(--brand); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-bottom: 8px; text-align: left; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--fg); border: 1px solid var(--border); }
  .log { background: var(--vscode-terminal-background, #1e1e1e); color: var(--vscode-terminal-foreground, #d4d4d4); border-radius: 4px; padding: 8px; font-family: monospace; font-size: 11px; max-height: 220px; overflow-y: auto; white-space: pre-wrap; margin-top: 8px; }
  .error-item { background: rgba(255,0,0,0.08); border-left: 3px solid #f44; padding: 6px 8px; margin: 4px 0; font-size: 11px; border-radius: 0 4px 4px 0; }
  .error-file { font-weight: 600; }
  .device-item { padding: 6px 8px; cursor: pointer; border-radius: 4px; margin: 2px 0; }
  .device-item:hover { background: var(--vscode-list-hoverBackground); }
  .section-title { font-size: 11px; font-weight: 600; margin-bottom: 8px; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.5px; }
  .status { font-size: 11px; color: var(--vscode-descriptionForeground); padding: 4px 0; }
  .controls { display: flex; gap: 6px; margin-top: 8px; }
  .controls .btn { flex: 1; text-align: center; margin-bottom: 0; }
  .field { margin-bottom: 10px; }
  .field label { display: block; font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
  .field input { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 5px 8px; font-size: 12px; }
  .hc-item { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border); }
  .hc-dot { flex: 0 0 auto; width: 14px; text-align: center; font-size: 12px; line-height: 18px; }
  .hc-body { flex: 1; min-width: 0; }
  .hc-label { font-size: 12px; font-weight: 500; }
  .hc-detail { font-size: 11px; color: var(--vscode-descriptionForeground); word-break: break-word; }
  .hc-fix { font-size: 11px; color: var(--brand); margin-top: 2px; }
  .ok   { color: #3fb950; }
  .warn { color: #d29922; }
  .fail { color: #f85149; }
  .banner { padding: 8px 10px; border-radius: 4px; font-size: 11px; margin-bottom: 10px; }
  .banner.fail { background: rgba(248,81,73,0.12); border-left: 3px solid #f85149; color: var(--fg); }
</style>
</head>
<body>
<div class="header">
  <div class="logo"></div>
  <h1>AppVelocity Flutter</h1>
</div>

<div class="tabs">
  <div class="tab active" onclick="showTab('health')"    id="tab-health">Health</div>
  <div class="tab"        onclick="showTab('project')"   id="tab-project">Project</div>
  <div class="tab"        onclick="showTab('generate')"  id="tab-generate">Generate</div>
  <div class="tab"        onclick="showTab('build')"     id="tab-build">Build</div>
  <div class="tab"        onclick="showTab('run')"       id="tab-run">Run</div>
</div>

<!-- HEALTH TAB -->
<div class="panel active" id="panel-health">
  <p class="status" style="margin-bottom:10px">Pre-flight check — verifies the environment before generate, build, and run.</p>
  <button class="btn" onclick="post('health')" id="hc-btn">🩺 Run Health Check</button>
  <button class="btn btn-ghost" onclick="post('openSettings')">⚙ Configure API Keys</button>
  <div id="hc-list" style="margin-top:10px"></div>
</div>

<!-- PROJECT TAB -->
<div class="panel" id="panel-project">
  <div id="project-content">
    <p class="status" style="margin-bottom:12px">Detect your project's architecture, state management, and navigation patterns.</p>
    <button class="btn" onclick="analyze()">🔍 Analyze Project</button>
    <button class="btn btn-ghost" onclick="post('openSettings')">⚙ Configure API Keys</button>
  </div>
  <div id="project-result" style="display:none">
    <div class="section-title">Detected Architecture</div>
    <div id="context-display"></div>
  </div>
</div>

<!-- GENERATE TAB -->
<div class="panel" id="panel-generate">
  <div class="field">
    <label>Figma URL</label>
    <input type="text" id="figma-url" placeholder="https://www.figma.com/design/...">
  </div>
  <div class="field">
    <label>Figma Token (or set in settings)</label>
    <input type="password" id="figma-token" placeholder="figd_...">
  </div>
  <div class="field">
    <label>…or describe the screen (used if no Figma URL)</label>
    <input type="text" id="gen-prompt" placeholder="Login screen with OAuth buttons">
  </div>
  <button class="btn" onclick="generate()" id="gen-btn">✨ Generate Screen</button>
  <div id="gen-status" class="status"></div>
  <div class="log" id="gen-log" style="display:none"></div>
</div>

<!-- BUILD TAB -->
<div class="panel" id="panel-build">
  <p class="status" style="margin-bottom:12px">Build your Flutter app. Errors are detected and auto-fixed by AI.</p>
  <button class="btn" onclick="build()" id="build-btn">🔨 Build & Auto-Fix</button>
  <div id="build-status" class="status"></div>
  <div class="log" id="build-log" style="display:none"></div>
  <div id="error-list"></div>
</div>

<!-- RUN TAB -->
<div class="panel" id="panel-run">
  <div class="section-title">Devices</div>
  <div id="device-list"><button class="btn btn-ghost" onclick="post('listDevices')">↻ Refresh Devices</button></div>
  <div id="run-controls" style="display:none">
    <div class="controls">
      <button class="btn" onclick="post('hotReload')"  title="Hot Reload (r)"  style="background:#4CAF50">⚡ Reload</button>
      <button class="btn" onclick="post('hotRestart')" title="Hot Restart (R)" style="background:#FF9800">↺ Restart</button>
      <button class="btn" onclick="post('stopApp')"    title="Quit"            style="background:#f44336">■ Stop</button>
    </div>
    <div class="log" id="run-log"></div>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();
let selectedDevice = null;

function post(type, extra) { vscode.postMessage({ type, ...extra }); }
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function analyze() { post('analyze'); }

function generate() {
  const url    = document.getElementById('figma-url').value.trim();
  const token  = document.getElementById('figma-token').value.trim();
  const prompt = document.getElementById('gen-prompt').value.trim();
  if (!url && !prompt) { document.getElementById('gen-status').textContent = 'Enter a Figma URL or a description'; return; }
  document.getElementById('gen-btn').disabled = true;
  document.getElementById('gen-status').textContent = 'Running pre-flight check…';
  document.getElementById('gen-log').style.display = 'block';
  document.getElementById('gen-log').textContent = '';
  post('generate', { figmaUrl: url || undefined, figmaToken: token || undefined, prompt: prompt || undefined });
}

function build() {
  document.getElementById('build-btn').disabled = true;
  document.getElementById('build-log').style.display = 'block';
  document.getElementById('build-log').textContent = '';
  document.getElementById('error-list').innerHTML = '';
  document.getElementById('build-status').textContent = 'Running pre-flight check…';
  post('build');
}

function runOnDevice(deviceId) {
  selectedDevice = deviceId;
  document.getElementById('run-controls').style.display = 'block';
  document.getElementById('run-log').textContent = '';
  post('run', { deviceId });
}

function renderHealth(items) {
  const icon = { ok: '<span class="ok">●</span>', warn: '<span class="warn">▲</span>', fail: '<span class="fail">✕</span>' };
  return items.map(i =>
    '<div class="hc-item">' +
      '<div class="hc-dot">' + (icon[i.status] || '') + '</div>' +
      '<div class="hc-body">' +
        '<div class="hc-label">' + esc(i.label) + '</div>' +
        '<div class="hc-detail">' + esc(i.detail) + '</div>' +
        ((i.status !== 'ok' && i.fix) ? '<div class="hc-fix">→ ' + esc(i.fix) + '</div>' : '') +
      '</div>' +
    '</div>'
  ).join('');
}

window.addEventListener('message', ({ data }) => {
  switch (data.type) {
    case 'healthRunning':
      document.getElementById('hc-list').innerHTML = '<p class="status">Checking environment…</p>';
      break;

    case 'healthResult':
      document.getElementById('hc-list').innerHTML = renderHealth(data.items);
      break;

    case 'preflightBlocked': {
      const names = (data.blocking || []).map(b => b.label).join(', ');
      const msg = '⛔ Cannot ' + data.op + ' — fix: ' + names + '. See Health tab.';
      if (data.op === 'generate') {
        document.getElementById('gen-btn').disabled = false;
        document.getElementById('gen-status').textContent = msg;
      } else if (data.op === 'build') {
        document.getElementById('build-btn').disabled = false;
        document.getElementById('build-status').textContent = msg;
      }
      showTab('health');
      document.getElementById('hc-list').innerHTML =
        '<div class="banner fail">' + esc(msg) + '</div>' +
        document.getElementById('hc-list').innerHTML;
      break;
    }

    case 'status':
      document.getElementById('project-content').querySelector('.status').textContent = data.text;
      break;

    case 'analyzeResult': {
      document.getElementById('project-result').style.display = 'block';
      const ctx = data.context || {};
      document.getElementById('context-display').innerHTML = Object.entries(ctx)
        .filter(([,v]) => v && !Array.isArray(v))
        .map(([k,v]) => '<div class="status"><strong>'+esc(k)+'</strong>: '+esc(v)+'</div>')
        .join('');
      break;
    }

    case 'genStart':
      document.getElementById('gen-status').textContent = 'Generating…';
      break;

    case 'genLog':
      document.getElementById('gen-log').textContent += data.line + '\\n';
      document.getElementById('gen-log').scrollTop = 9999;
      break;

    case 'genDone':
      document.getElementById('gen-btn').disabled = false;
      document.getElementById('gen-status').textContent = data.success
        ? '✓ Generated ' + data.file
        : '✗ ' + (data.error || 'Generation failed');
      break;

    case 'buildLog':
      document.getElementById('build-log').textContent += data.line + '\\n';
      document.getElementById('build-log').scrollTop = 9999;
      break;

    case 'buildStart':
      document.getElementById('build-status').textContent = 'Building…';
      break;

    case 'buildDone':
      document.getElementById('build-btn').disabled = false;
      document.getElementById('build-status').textContent = data.success ? '✓ Build succeeded' : '✗ Build failed';
      if (data.errors && data.errors.length > 0) {
        document.getElementById('error-list').innerHTML = '<div class="section-title" style="margin-top:12px">Errors</div>' +
          data.errors.slice(0,10).map(e =>
            '<div class="error-item"><div class="error-file">'+esc(e.file)+':'+esc(e.line)+'</div><div>'+esc(e.message)+'</div></div>'
          ).join('');
      }
      break;

    case 'deviceList':
      document.getElementById('device-list').innerHTML =
        (data.devices.length === 0
          ? '<p class="status">No devices found. Connect a device or start an emulator.</p>'
          : data.devices.map(d =>
              '<div class="device-item" onclick="runOnDevice(\\'' + esc(d.id) + '\\')"><strong>'+esc(d.name)+'</strong><br><span style="font-size:11px;color:var(--vscode-descriptionForeground)">'+esc(d.platform)+'</span></div>'
            ).join('')
        ) + '<button class="btn btn-ghost" style="margin-top:8px" onclick="post(\\'listDevices\\')">↻ Refresh</button>';
      break;

    case 'runLog':
      document.getElementById('run-log').textContent += data.line + '\\n';
      document.getElementById('run-log').scrollTop = 9999;
      break;

    case 'runDone':
      document.getElementById('run-controls').style.display = 'none';
      break;
  }
});

// Auto-load devices when opening the Run tab
document.getElementById('tab-run').addEventListener('click', () => post('listDevices'));
// Run an initial health check on load
post('health');
</script>
</body>
</html>`;
  }
}

type PanelMessage =
  | { type: 'health' }
  | { type: 'analyze' }
  | { type: 'generate'; figmaUrl?: string; figmaToken?: string; prompt?: string }
  | { type: 'build' }
  | { type: 'run'; deviceId?: string }
  | { type: 'listDevices' }
  | { type: 'hotReload' }
  | { type: 'hotRestart' }
  | { type: 'stopApp' }
  | { type: 'openSettings' };

// Re-exported for type clarity in message payloads.
export type { HealthItem };
