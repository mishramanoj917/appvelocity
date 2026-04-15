/**
 * Flutter widget renderer.
 *
 * Converts IRScreen / IRComponent / IRElement trees to .dart file content
 * using a Template-Driven approach:
 *
 *   1. FlutterViewModelBuilder — walks the IR tree, renders Dart widget body
 *   2. renderTemplate()        — Handlebars template produces the full .dart file
 *
 * The public API (renderScreen / renderComponent / renderElement) is unchanged
 * so existing callers (FlutterGenerator, tests) require no modifications.
 */

import type {
  IRScreen,
  IRComponent,
  IRElement,
  IRTokenSet,
} from '@appvelocity/agent-design-to-code-core';
import type { CodeFile } from '../types.js';
import { toPascalCase, toSnakeCase } from '../utils/naming.js';
import { renderTemplate } from '../template-engine/engine.js';
import { FlutterViewModelBuilder, renderElement as builderRenderElement } from '../builders/flutter-view-model-builder.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderScreen(
  screen: IRScreen,
  _tokens: IRTokenSet,
  outputDir = 'lib',
  warnings?: string[],
): CodeFile {
  const name = toPascalCase(screen.componentName || screen.name);
  const builder = new FlutterViewModelBuilder();
  const vm = builder.buildScreen(screen, _tokens, warnings);
  const content = renderTemplate('flutter/component', vm);

  return {
    path: `${outputDir}/screens/${toSnakeCase(name)}.dart`,
    content,
    language: 'dart',
  };
}

export function renderComponent(
  component: IRComponent,
  _tokens: IRTokenSet,
  outputDir = 'lib',
  warnings?: string[],
): CodeFile {
  const name = toPascalCase(component.componentName || component.name);
  const builder = new FlutterViewModelBuilder();
  const vm = builder.buildComponent(component, _tokens, warnings);
  const content = renderTemplate('flutter/component', vm);

  return {
    path: `${outputDir}/widgets/${toSnakeCase(name)}.dart`,
    content,
    language: 'dart',
  };
}

/**
 * Renders a single IRElement to a Dart widget string.
 * Delegates to the Flutter ViewModel builder's element renderer.
 */
export function renderElement(
  el: IRElement,
  depth: number,
  warnings?: string[],
): string {
  return builderRenderElement(el, depth, warnings);
}
