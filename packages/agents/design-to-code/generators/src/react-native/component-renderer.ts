/**
 * React Native component renderer.
 *
 * Converts IRScreen / IRComponent / IRElement trees to .tsx file content
 * using a Template-Driven approach:
 *
 *   1. RNViewModelBuilder  — walks the IR tree, collects styles (single pass),
 *                            tracks used components (exact import list, no string scanning)
 *   2. renderTemplate()    — Handlebars template produces clean, consistent output
 *
 * The public API (renderScreen / renderComponent / renderElement) is unchanged
 * so existing callers (ReactNativeGenerator, tests) require no modifications.
 */

import type {
  IRScreen,
  IRComponent,
  IRElement,
  IRTokenSet,
} from '@appvelocity/agent-design-to-code-core';
import type { CodeFile } from '../types.js';
import { toPascalCase } from '../utils/naming.js';
import { renderTemplate } from '../template-engine/engine.js';
import { RNViewModelBuilder } from '../builders/rn-view-model-builder.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderScreen(
  screen: IRScreen,
  tokens: IRTokenSet,
  outputDir = 'src',
  warnings?: string[],
): CodeFile {
  const name = toPascalCase(screen.componentName || screen.name);
  const builder = new RNViewModelBuilder();
  const vm = builder.buildScreen(screen, tokens, warnings);
  const content = renderTemplate('react-native/component', vm);

  return {
    path: `${outputDir}/screens/${name}.tsx`,
    content,
    language: 'typescript',
  };
}

export function renderComponent(
  component: IRComponent,
  tokens: IRTokenSet,
  outputDir = 'src',
  warnings?: string[],
): CodeFile {
  const name = toPascalCase(component.componentName || component.name);
  const builder = new RNViewModelBuilder();
  const vm = builder.buildComponent(component, tokens, warnings);
  const content = renderTemplate('react-native/component', vm);

  return {
    path: `${outputDir}/components/${name}.tsx`,
    content,
    language: 'typescript',
  };
}

/**
 * Renders a single IRElement to a JSX string.
 * Exposed for tests and one-off usage; a temporary builder is used internally.
 */
export function renderElement(
  el: IRElement,
  tokens: IRTokenSet,
  depth: number,
  warnings?: string[],
): string {
  // Use a temporary builder to render a single element.
  // This preserves the existing test contract.
  const builder = new RNViewModelBuilder();
  // Build a minimal screen-like structure to trigger the render path
  const vm = builder.buildScreen(
    {
      id: el.id,
      name: el.name,
      componentName: el.name,
      width: 0,
      height: 0,
      root: el,
      elementIndex: {},
    },
    tokens,
    warnings,
  );
  // Extract just the body (pre-rendered element tree) and re-indent for requested depth
  // The builder always renders at depth=2; adjust here if a different depth was requested.
  const lines = vm.body.split('\n');
  if (depth === 2) return vm.body;
  // Shift indentation by (depth - 2) * 2 spaces
  const shift = (depth - 2) * 2;
  return lines
    .map((line) => (shift >= 0 ? ' '.repeat(shift) + line : line.slice(Math.abs(shift))))
    .join('\n');
}
