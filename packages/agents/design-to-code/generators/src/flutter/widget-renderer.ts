/**
 * Flutter widget renderer.
 *
 * Converts IRScreen / IRComponent / IRElement trees to .dart file content.
 */

import type {
  IRScreen,
  IRComponent,
  IRElement,
  IRTokenSet,
} from '@appvelocity/agent-design-to-code-core';
import type { CodeFile } from '../types.js';
import { toPascalCase, toSnakeCase } from '../utils/naming.js';
import { indent } from '../utils/indent.js';
import {
  irCrossAxisToDart,
  irMainAxisToDart,
  irPaddingToDart,
  irStyleToBoxDecoration,
  hexToFlutterColor,
} from './style-mapper.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderScreen(
  screen: IRScreen,
  _tokens: IRTokenSet,
  outputDir = 'lib',
  warnings?: string[]
): CodeFile {
  const name = toPascalCase(screen.componentName || screen.name);
  const body = renderElement(screen.root, 2, warnings);

  return {
    path: `${outputDir}/screens/${toSnakeCase(name)}.dart`,
    content: buildWidgetFile(name, body, true),
    language: 'dart',
  };
}

export function renderComponent(
  component: IRComponent,
  _tokens: IRTokenSet,
  outputDir = 'lib',
  warnings?: string[]
): CodeFile {
  const name = toPascalCase(component.componentName || component.name);
  const body = renderElement(component.defaultVariant, 2, warnings);

  return {
    path: `${outputDir}/widgets/${toSnakeCase(name)}.dart`,
    content: buildWidgetFile(name, body, false),
    language: 'dart',
  };
}

// ─── Element renderer (recursive) ────────────────────────────────────────────

export function renderElement(
  el: IRElement,
  depth: number,
  warnings?: string[]
): string {
  const pad = indent(depth);

  switch (el.type) {
    case 'text': {
      return renderTextWidget(el, pad);
    }

    case 'image':
    case 'icon': {
      const uri = el.image?.src ?? '';
      const { decoration, opacity } = irStyleToBoxDecoration(el.style);
      const inner = uri
        ? `Image.network('${escapeStr(uri)}')`
        : `Container(${decoration ? `\n${pad}  decoration: ${decoration}` : ''}\n${pad})`;
      return opacity !== undefined
        ? `${pad}Opacity(\n${pad}  opacity: ${opacity},\n${pad}  child: ${inner},\n${pad})`
        : `${pad}${inner}`;
    }

    case 'imagebackground': {
      // Image fill with overlaid children — DecorationImage inside Container
      const uri = el.image?.src ?? '';
      const children = el.children.map((c) => renderElement(c, depth + 1, warnings));
      const childWidget = children.length === 0
        ? `${indent(depth + 1)}const SizedBox.shrink()`
        : children.length === 1
          ? children[0]!
          : `${indent(depth + 1)}Stack(\n${indent(depth + 2)}children: [\n${children.join(',\n')},\n${indent(depth + 2)}],\n${indent(depth + 1)})`;
      const decorationImage = uri
        ? `DecorationImage(\n${pad}    image: NetworkImage('${escapeStr(uri)}'),\n${pad}    fit: BoxFit.cover,\n${pad}  )`
        : null;
      const decorationStr = decorationImage
        ? `BoxDecoration(\n${pad}  image: ${decorationImage},\n${pad})`
        : 'BoxDecoration()';
      return (
        `${pad}Container(\n` +
        `${pad}  decoration: ${decorationStr},\n` +
        `${pad}  child: ${childWidget.trim()},\n` +
        `${pad})`
      );
    }

    case 'touchable': {
      const child = renderChildren(el.children, depth + 1, warnings);
      return (
        `${pad}GestureDetector(\n` +
        `${pad}  onTap: () {},\n` +
        `${pad}  child: ${child.trim()},\n` +
        `${pad})`
      );
    }

    case 'scrollview': {
      const child = renderChildren(el.children, depth + 1, warnings);
      return (
        `${pad}SingleChildScrollView(\n` +
        `${pad}  child: ${child.trim()},\n` +
        `${pad})`
      );
    }

    case 'flatlist': {
      return (
        `${pad}ListView.builder(\n` +
        `${pad}  itemCount: 0,\n` +
        `${pad}  itemBuilder: (context, index) => const SizedBox.shrink(),\n` +
        `${pad})`
      );
    }

    case 'input': {
      return `${pad}const TextField()`;
    }

    case 'component-instance': {
      const refName = toPascalCase(el.componentRef ?? el.name);
      return `${pad}${refName}()`;
    }

    case 'view':
    default: {
      if (el.type !== 'view') {
        warnings?.push(`Unsupported IRElementType '${el.type}' for element '${el.name}' — rendered as Container/Column/Row`);
      }
      return renderContainerOrFlex(el, depth, warnings);
    }
  }
}

// ─── Container / Flex layout ──────────────────────────────────────────────────

function renderContainerOrFlex(el: IRElement, depth: number, warnings?: string[]): string {
  const pad = indent(depth);
  const { flex } = el.layout;
  const { decoration, opacity } = irStyleToBoxDecoration(el.style);
  const padding = irPaddingToDart(el.layout);
  const children = el.children.map((c) => renderElement(c, depth + 1, warnings));

  let inner: string;

  if (flex.direction !== 'none') {
    const isRow = flex.direction === 'row';
    const tag = isRow ? 'Row' : 'Column';
    const childrenStr = children.length > 0
      ? `[\n${children.join(',\n')},\n${pad}  ]`
      : '[]';

    inner = (
      `${tag}(\n` +
      `${pad}  mainAxisAlignment: ${irMainAxisToDart(flex.mainAxisAlignment)},\n` +
      `${pad}  crossAxisAlignment: ${irCrossAxisToDart(flex.crossAxisAlignment)},\n` +
      (flex.gap > 0 ? `${pad}  // gap: ${flex.gap} — use SizedBox separators in production\n` : '') +
      `${pad}  children: ${childrenStr},\n` +
      `${pad})`
    );
  } else if (children.length === 1) {
    inner = children[0]!;
  } else if (children.length > 1) {
    const childrenStr = `[\n${children.join(',\n')},\n${pad}  ]`;
    inner = `Stack(\n${pad}  children: ${childrenStr},\n${pad})`;
  } else {
    inner = 'const SizedBox.shrink()';
  }

  // Wrap in Container only if we have decoration/padding/opacity
  const needsContainer = decoration || padding || opacity !== undefined;
  if (!needsContainer) {
    return `${pad}${inner}`;
  }

  const containerParts: string[] = [];
  if (padding)    containerParts.push(`padding: ${padding}`);
  if (decoration) containerParts.push(`decoration: ${decoration}`);
  if (opacity !== undefined) containerParts.push(`// opacity: ${opacity} — wrap with Opacity widget if needed`);

  const containerArgs = containerParts.length > 0
    ? `\n${pad}  ${containerParts.join(`,\n${pad}  `)},\n${pad}  child: ${inner},\n${pad}`
    : ` child: ${inner} `;

  return `${pad}Container(${containerArgs})`;
}

// ─── Text widget ──────────────────────────────────────────────────────────────

function renderTextWidget(el: IRElement, pad: string): string {
  const value = escapeStr(el.text?.value ?? '');
  const ts = el.text?.style;

  if (!ts) {
    return `${pad}Text('${value}')`;
  }

  const styleParts: string[] = [];
  if (ts.fontFamily)    styleParts.push(`fontFamily: '${ts.fontFamily}'`);
  if (ts.fontSize)      styleParts.push(`fontSize: ${ts.fontSize}`);
  if (ts.fontWeight)    styleParts.push(`fontWeight: FontWeight.w${ts.fontWeight}`);
  if (ts.color)         styleParts.push(`color: Color(${hexToFlutterColor(ts.color)})`);
  if (ts.lineHeight && ts.fontSize) {
    styleParts.push(`height: ${(ts.lineHeight / ts.fontSize).toFixed(2)}`);
  }

  const styleStr = styleParts.length > 0
    ? `\n${pad}  style: TextStyle(${styleParts.join(', ')}),`
    : '';

  return `${pad}Text(\n${pad}  '${value}',${styleStr}\n${pad})`;
}

// ─── File builder ─────────────────────────────────────────────────────────────

function buildWidgetFile(name: string, body: string, isScreen: boolean): string {
  const tag = isScreen ? 'Screen' : 'Widget';
  return [
    `// ${name} — auto-generated ${tag}`,
    `// Generated by DesignToCodeAgent. Review before committing.`,
    `import 'package:flutter/material.dart';`,
    ``,
    `class ${name} extends StatelessWidget {`,
    `  const ${name}({super.key});`,
    ``,
    `  @override`,
    `  Widget build(BuildContext context) {`,
    `    return ${body.trim()};`,
    `  }`,
    `}`,
    ``,
  ].join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderChildren(
  children: IRElement[],
  depth: number,
  warnings?: string[]
): string {
  if (children.length === 0) return `${indent(depth)}const SizedBox.shrink()`;
  if (children.length === 1) return renderElement(children[0]!, depth, warnings);

  const pad = indent(depth - 1);
  const items = children.map((c) => renderElement(c, depth, warnings)).join(',\n');
  return `Column(\n${items},\n${pad})`;
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
