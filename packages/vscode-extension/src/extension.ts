/**
 * AppVelocity Flutter VS Code Extension — activation entry point.
 *
 * Activates on any workspace that contains a pubspec.yaml file.
 * Registers the sidebar WebView panel and the four main commands.
 */

import * as vscode from 'vscode';
import { AppVelocityPanel } from './panel/panel.js';

let panelProvider: AppVelocityPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  panelProvider = new AppVelocityPanel(context.extensionUri);

  // Register sidebar WebView provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AppVelocityPanel.viewType,
      panelProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // Commands — delegate to panel methods
  context.subscriptions.push(
    vscode.commands.registerCommand('appvelocity.analyzeProject', async () => {
      await vscode.commands.executeCommand('appvelocity.panel.focus');
      await panelProvider?.analyzeProject();
    }),

    vscode.commands.registerCommand('appvelocity.buildAndFix', async () => {
      await vscode.commands.executeCommand('appvelocity.panel.focus');
      await panelProvider?.buildAndFix();
    }),

    vscode.commands.registerCommand('appvelocity.runApp', async () => {
      await vscode.commands.executeCommand('appvelocity.panel.focus');
      await panelProvider?.listDevices();
    }),

    vscode.commands.registerCommand('appvelocity.generateScreen', async () => {
      await vscode.commands.executeCommand('appvelocity.panel.focus');
      // Opening the panel is enough — user fills in the Figma URL and clicks Generate
    }),
  );

  // Show a status-bar shortcut
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.text = '$(rocket) AppVelocity';
  item.tooltip = 'Open AppVelocity Flutter panel';
  item.command = 'appvelocity.panel.focus';
  item.show();
  context.subscriptions.push(item);
}

export function deactivate(): void {
  panelProvider = undefined;
}
