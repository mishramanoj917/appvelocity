/**
 * React Native component renderer.
 *
 * Converts IRScreen / IRComponent / IRElement trees to .tsx file content.
 */

import type {
  IRScreen,
  IRComponent,
  IRElement,
  IRTokenSet,
} from '@appvelocity/agent-design-to-code-core';
import type { CodeFile } from '../types.js';
import { toPascalCase } from '../utils/naming.js';
import { indent } from '../utils/indent.js';
import { mergeRNStyle, styleObjectToString } from './style-mapper.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderScreen(
  screen: IRScreen,
  tokens: IRTokenSet,
  outputDir = 'src'
): CodeFile {
  const name = toPascalCase(screen.componentName || screen.name);
  const body = renderElement(screen.root, tokens, 1);
  const styles = collectStyles(screen.root, tokens);

  const content = buildComponentFile(name, body, styles, true);

  return {
    path: `${outputDir}/screens/${name}.tsx`,
    content,
    language: 'typescript',
  };
}

export function renderComponent(
  component: IRComponent,
  tokens: IRTokenSet,
  outputDir = 'src'
): CodeFile {
  const name = toPascalCase(component.componentName || component.name);
  const body = renderElement(component.defaultVariant, tokens, 1);
  const styles = collectStyles(component.defaultVariant, tokens);

  const content = buildComponentFile(name, body, styles, false);

  return {
    path: `${outputDir}/components/${name}.tsx`,
    content,
    language: 'typescript',
  };
}

// ─── Element renderer (recursive) ────────────────────────────────────────────

export function renderElement(
  el: IRElement,
  tokens: IRTokenSet,
  depth: number,
  warnings?: string[]
): string {
  const pad = indent(depth);
  const styleKey = sanitizeStyleKey(el.name || el.id);
  const styleRef = `styles.${styleKey}`;

  switch (el.type) {
    case 'text': {
      const value = el.text?.value ?? '';
      const children = renderChildren(el.children, tokens, depth + 1, warnings);
      if (children) {
        return `${pad}<Text style={${styleRef}}>\n${children}\n${pad}</Text>`;
      }
      return `${pad}<Text style={${styleRef}}>${escapeJsx(value)}</Text>`;
    }

    case 'image': {
      const uri = el.image?.src ?? '';
      const alt = el.image?.alt ?? el.name;
      return `${pad}<Image\n${pad}  style={${styleRef}}\n${pad}  source={{ uri: '${uri}' }}\n${pad}  accessibilityLabel="${escapeAttr(alt)}"\n${pad}/>`;
    }

    case 'imagebackground': {
      // Image fill with overlaid children — use ImageBackground
      const uri = el.image?.src ?? '';
      const children = renderChildren(el.children, tokens, depth + 1, warnings);
      if (children) {
        return `${pad}<ImageBackground\n${pad}  style={${styleRef}}\n${pad}  source={{ uri: '${uri}' }}\n${pad}  resizeMode="cover"\n${pad}>\n${children}\n${pad}</ImageBackground>`;
      }
      return `${pad}<ImageBackground style={${styleRef}} source={{ uri: '${uri}' }} resizeMode="cover" />`;
    }

    case 'icon': {
      // Rendered as an Image for maximum compatibility
      const uri = el.image?.src ?? '';
      return `${pad}<Image style={${styleRef}} source={{ uri: '${uri}' }} />`;
    }

    case 'touchable': {
      const children = renderChildren(el.children, tokens, depth + 1, warnings);
      return `${pad}<TouchableOpacity style={${styleRef}} onPress={() => {}}>\n${children}\n${pad}</TouchableOpacity>`;
    }

    case 'scrollview': {
      const children = renderChildren(el.children, tokens, depth + 1, warnings);
      return `${pad}<ScrollView style={${styleRef}}>\n${children}\n${pad}</ScrollView>`;
    }

    case 'flatlist': {
      return `${pad}<FlatList\n${pad}  style={${styleRef}}\n${pad}  data={[]}\n${pad}  renderItem={() => null}\n${pad}  keyExtractor={(_, i) => String(i)}\n${pad}/>`;
    }

    case 'input': {
      return `${pad}<TextInput style={${styleRef}} placeholder="" />`;
    }

    case 'component-instance': {
      const refName = toPascalCase(el.componentRef ?? el.name);
      return `${pad}<${refName} style={${styleRef}} />`;
    }

    case 'view':
    default: {
      if (el.type !== 'view') {
        warnings?.push(`Unsupported IRElementType '${el.type}' for element '${el.name}' — rendered as View`);
      }
      const children = renderChildren(el.children, tokens, depth + 1, warnings);
      if (children) {
        return `${pad}<View style={${styleRef}}>\n${children}\n${pad}</View>`;
      }
      return `${pad}<View style={${styleRef}} />`;
    }
  }
}

// ─── Style collector ──────────────────────────────────────────────────────────

interface StyleEntry { key: string; obj: Record<string, unknown>; }

function collectStyles(root: IRElement, tokens: IRTokenSet): StyleEntry[] {
  const entries: StyleEntry[] = [];
  const seen = new Set<string>();

  function walk(el: IRElement): void {
    const key = sanitizeStyleKey(el.name || el.id);
    if (!seen.has(key)) {
      seen.add(key);
      const styleObj = mergeRNStyle(el.layout, el.style);

      // Add text-specific styles
      if (el.type === 'text' && el.text?.style) {
        const ts = el.text.style;
        if (ts.fontFamily)    styleObj.fontFamily    = ts.fontFamily;
        if (ts.fontSize)      styleObj.fontSize      = ts.fontSize;
        if (ts.fontWeight)    styleObj.fontWeight    = String(ts.fontWeight);
        if (ts.lineHeight)    styleObj.lineHeight    = ts.lineHeight;
        if (ts.letterSpacing) styleObj.letterSpacing = ts.letterSpacing;
        if (ts.color)         styleObj.color         = ts.color;
        if (ts.textAlign)     styleObj.textAlign     = ts.textAlign;
        if (ts.textDecoration && ts.textDecoration !== 'none') {
          styleObj.textDecorationLine = ts.textDecoration;
        }
      }

      entries.push({ key, obj: styleObj });
    }
    el.children.forEach(walk);
  }

  walk(root);
  // suppress unused tokens warning
  void tokens;
  return entries;
}

// ─── File builder ─────────────────────────────────────────────────────────────

function buildComponentFile(
  name: string,
  body: string,
  styles: StyleEntry[],
  isScreen: boolean
): string {
  const imports = detectImports(body);

  const styleSheet = styles
    .map(({ key, obj }) => {
      const hasEntries = Object.keys(obj).length > 0;
      return `  ${key}: ${hasEntries ? styleObjectToString(obj, 4) : '{}'},`;
    })
    .join('\n');

  const tag = isScreen ? 'Screen' : 'Component';
  const lines = [
    `/**`,
    ` * ${name} — auto-generated ${tag}`,
    ` * Generated by DesignToCodeAgent. Review before committing.`,
    ` */`,
    `import React from 'react';`,
    `import {`,
    `  StyleSheet,`,
    ...imports.map((i) => `  ${i},`),
    `} from 'react-native';`,
    ``,
    `export function ${name}(): React.JSX.Element {`,
    `  return (`,
    body,
    `  );`,
    `}`,
    ``,
    `const styles = StyleSheet.create({`,
    styleSheet,
    `});`,
    ``,
  ];

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderChildren(
  children: IRElement[],
  tokens: IRTokenSet,
  depth: number,
  warnings?: string[]
): string {
  return children.map((c) => renderElement(c, tokens, depth, warnings)).join('\n');
}

function detectImports(jsx: string): string[] {
  const tags: string[] = [];
  if (jsx.includes('<View'))            tags.push('View');
  if (jsx.includes('<Text'))            tags.push('Text');
  if (jsx.includes('<Image'))            tags.push('Image');
  if (jsx.includes('<ImageBackground')) tags.push('ImageBackground');
  if (jsx.includes('<TouchableOpacity')) tags.push('TouchableOpacity');
  if (jsx.includes('<ScrollView'))      tags.push('ScrollView');
  if (jsx.includes('<FlatList'))        tags.push('FlatList');
  if (jsx.includes('<TextInput'))       tags.push('TextInput');
  return [...new Set(tags)];
}

function sanitizeStyleKey(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^(\d)/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'container';
}

function escapeJsx(s: string): string {
  return s.replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' }[c] ?? c));
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '\\"');
}
