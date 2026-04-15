/**
 * React Native ViewModel Builder
 *
 * Transforms IRScreen / IRComponent / IRElement trees into RNComponentViewModel
 * objects ready for Handlebars template rendering.
 *
 * Improvements over the previous string-concatenation approach:
 *   1. Import tracking  — components are registered in a Set during tree walk,
 *      so imports are always exact and never rely on fragile string scanning.
 *   2. Style serialisation — values are serialised to valid JS literals via
 *      serializeStyleValue(), fixing nested-object and escaping bugs.
 *   3. Single-pass  — styles and element body are collected in one traversal
 *      instead of two separate walks.
 */

import type {
  IRScreen,
  IRComponent,
  IRElement,
  IRTokenSet,
} from '@appvelocity/agent-design-to-code-core';
import type { RNComponentViewModel } from './view-model.js';
import { toPascalCase } from '../utils/naming.js';
import { indent } from '../utils/indent.js';
import { mergeRNStyle } from '../react-native/style-mapper.js';

// ─── Ordered import list ──────────────────────────────────────────────────────

/** RN component names in the order they appear in imports */
const IMPORT_ORDER = [
  'View',
  'Text',
  'Image',
  'ImageBackground',
  'TouchableOpacity',
  'ScrollView',
  'FlatList',
  'TextInput',
] as const;

// ─── Builder class ────────────────────────────────────────────────────────────

export class RNViewModelBuilder {
  private usedComponents = new Set<string>();
  private styleRegistry = new Map<string, Record<string, unknown>>();
  private seenKeys = new Set<string>();

  // ── Public API ──────────────────────────────────────────────────────────────

  buildScreen(screen: IRScreen, tokens: IRTokenSet, warnings?: string[]): RNComponentViewModel {
    this.reset();
    const body = this.renderElement(screen.root, tokens, 2, warnings);
    return {
      componentName: toPascalCase(screen.componentName || screen.name),
      tag: 'Screen',
      body,
      imports: this.resolveImports(),
      stylesBlock: this.serializeStyles(),
    };
  }

  buildComponent(component: IRComponent, tokens: IRTokenSet, warnings?: string[]): RNComponentViewModel {
    this.reset();
    const body = this.renderElement(component.defaultVariant, tokens, 2, warnings);
    return {
      componentName: toPascalCase(component.componentName || component.name),
      tag: 'Component',
      body,
      imports: this.resolveImports(),
      stylesBlock: this.serializeStyles(),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private reset(): void {
    this.usedComponents = new Set();
    this.styleRegistry = new Map();
    this.seenKeys = new Set();
  }

  /**
   * Register a style entry for the element and return the style key.
   * Called for every element during tree traversal.
   */
  private registerStyle(el: IRElement, _tokens: IRTokenSet): string {
    const key = sanitizeStyleKey(el.name || el.id);
    if (!this.seenKeys.has(key)) {
      this.seenKeys.add(key);
      const styleObj = mergeRNStyle(el.layout, el.style);

      // Append text-specific style properties
      if (el.type === 'text' && el.text?.style) {
        const ts = el.text.style;
        if (ts.fontFamily)    styleObj['fontFamily']       = ts.fontFamily;
        if (ts.fontSize)      styleObj['fontSize']         = ts.fontSize;
        if (ts.fontWeight)    styleObj['fontWeight']       = String(ts.fontWeight);
        if (ts.lineHeight)    styleObj['lineHeight']       = ts.lineHeight;
        if (ts.letterSpacing) styleObj['letterSpacing']    = ts.letterSpacing;
        if (ts.color)         styleObj['color']            = ts.color;
        if (ts.textAlign)     styleObj['textAlign']        = ts.textAlign;
        if (ts.textDecoration && ts.textDecoration !== 'none') {
          styleObj['textDecorationLine'] = ts.textDecoration;
        }
      }

      this.styleRegistry.set(key, styleObj);
    }
    return key;
  }

  // ── Element renderer (recursive) ───────────────────────────────────────────

  private renderElement(
    el: IRElement,
    tokens: IRTokenSet,
    depth: number,
    warnings?: string[],
  ): string {
    const pad = indent(depth);
    const styleKey = this.registerStyle(el, tokens);
    const styleRef = `styles.${styleKey}`;

    switch (el.type) {
      case 'text': {
        this.usedComponents.add('Text');
        const value = el.text?.value ?? '';
        const children = this.renderChildren(el.children, tokens, depth + 1, warnings);
        if (children) {
          return `${pad}<Text style={${styleRef}}>\n${children}\n${pad}</Text>`;
        }
        return `${pad}<Text style={${styleRef}}>${escapeJsx(value)}</Text>`;
      }

      case 'image': {
        this.usedComponents.add('Image');
        const uri = el.image?.src ?? '';
        const alt = el.image?.alt ?? el.name;
        return (
          `${pad}<Image\n` +
          `${pad}  style={${styleRef}}\n` +
          `${pad}  source={{ uri: '${escapeAttr(uri)}' }}\n` +
          `${pad}  accessibilityLabel="${escapeAttr(alt)}"\n` +
          `${pad}/>`
        );
      }

      case 'imagebackground': {
        this.usedComponents.add('ImageBackground');
        const uri = el.image?.src ?? '';
        const children = this.renderChildren(el.children, tokens, depth + 1, warnings);
        if (children) {
          return (
            `${pad}<ImageBackground\n` +
            `${pad}  style={${styleRef}}\n` +
            `${pad}  source={{ uri: '${escapeAttr(uri)}' }}\n` +
            `${pad}  resizeMode="cover"\n` +
            `${pad}>\n` +
            `${children}\n` +
            `${pad}</ImageBackground>`
          );
        }
        return (
          `${pad}<ImageBackground\n` +
          `${pad}  style={${styleRef}}\n` +
          `${pad}  source={{ uri: '${escapeAttr(uri)}' }}\n` +
          `${pad}  resizeMode="cover"\n` +
          `${pad}/>`
        );
      }

      case 'icon': {
        this.usedComponents.add('Image');
        const uri = el.image?.src ?? '';
        return (
          `${pad}<Image\n` +
          `${pad}  style={${styleRef}}\n` +
          `${pad}  source={{ uri: '${escapeAttr(uri)}' }}\n` +
          `${pad}/>`
        );
      }

      case 'touchable': {
        this.usedComponents.add('TouchableOpacity');
        const children = this.renderChildren(el.children, tokens, depth + 1, warnings);
        return (
          `${pad}<TouchableOpacity style={${styleRef}} onPress={() => {}}>\n` +
          `${children}\n` +
          `${pad}</TouchableOpacity>`
        );
      }

      case 'scrollview': {
        this.usedComponents.add('ScrollView');
        const children = this.renderChildren(el.children, tokens, depth + 1, warnings);
        return (
          `${pad}<ScrollView style={${styleRef}}>\n` +
          `${children}\n` +
          `${pad}</ScrollView>`
        );
      }

      case 'flatlist': {
        this.usedComponents.add('FlatList');
        return (
          `${pad}<FlatList\n` +
          `${pad}  style={${styleRef}}\n` +
          `${pad}  data={[]}\n` +
          `${pad}  renderItem={() => null}\n` +
          `${pad}  keyExtractor={(_, i) => String(i)}\n` +
          `${pad}/>`
        );
      }

      case 'input': {
        this.usedComponents.add('TextInput');
        return `${pad}<TextInput style={${styleRef}} placeholder="" />`;
      }

      case 'component-instance': {
        const refName = toPascalCase(el.componentRef ?? el.name);
        return `${pad}<${refName} style={${styleRef}} />`;
      }

      case 'view':
      default: {
        if (el.type !== 'view') {
          warnings?.push(
            `Unsupported IRElementType '${el.type}' for element '${el.name}' — rendered as View`
          );
        }
        this.usedComponents.add('View');
        const children = this.renderChildren(el.children, tokens, depth + 1, warnings);
        if (children) {
          return `${pad}<View style={${styleRef}}>\n${children}\n${pad}</View>`;
        }
        return `${pad}<View style={${styleRef}} />`;
      }
    }
  }

  private renderChildren(
    children: IRElement[],
    tokens: IRTokenSet,
    depth: number,
    warnings?: string[],
  ): string {
    return children.map((c) => this.renderElement(c, tokens, depth, warnings)).join('\n');
  }

  // ── Import resolution ───────────────────────────────────────────────────────

  private resolveImports(): string[] {
    return IMPORT_ORDER.filter((name) => this.usedComponents.has(name));
  }

  // ── Style serialisation ─────────────────────────────────────────────────────

  /**
   * Renders the `const styles = StyleSheet.create({...});` block.
   *
   * Each property value is serialised via serializeStyleValue() which:
   *   - wraps strings in single quotes (with proper escaping)
   *   - emits numbers as-is
   *   - expands nested objects inline (e.g. shadowOffset: { width: 2, height: 2 })
   */
  private serializeStyles(): string {
    const lines: string[] = ['const styles = StyleSheet.create({'];

    for (const [key, obj] of this.styleRegistry) {
      const props = Object.entries(obj);
      if (props.length === 0) {
        lines.push(`  ${key}: {},`);
      } else {
        lines.push(`  ${key}: {`);
        for (const [k, v] of props) {
          lines.push(`    ${k}: ${serializeStyleValue(v)},`);
        }
        lines.push(`  },`);
      }
    }

    lines.push('});');
    return lines.join('\n');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Serialise a style value to a valid JavaScript literal string.
 *
 * - string  → 'value' (with escaping)
 * - number  → 16
 * - object  → { key: value, ... }  (inline, recursive)
 * - other   → String(value)
 */
export function serializeStyleValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object' && value !== null) {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${serializeStyleValue(v)}`)
      .join(', ');
    return `{ ${inner} }`;
  }
  return String(value);
}

function sanitizeStyleKey(raw: string): string {
  return (
    raw
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^(\d)/, '_$1')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'container'
  );
}

function escapeJsx(s: string): string {
  return s.replace(/[{}<>]/g, (c) => (
    { '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' }[c] ?? c
  ));
}

function escapeAttr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}
