/**
 * Layout Resolver — deterministic Figma IR → Flutter widget tree spec.
 *
 * Converts IRElement trees into a structured layout specification string
 * that the LLM uses as a blueprint. The LLM follows the spec exactly for
 * widget types and nesting; it only fills in visual properties (colors,
 * text, borders, etc.).
 *
 * Mapping rules (from Figma auto layout research):
 *   HORIZONTAL → Row
 *   VERTICAL   → Column
 *   NONE + >1 child  → Stack (Positioned children)
 *   NONE + 1 child   → SizedBox / Container wrapping child
 *   layoutGrow = 1   → Expanded wrapping child
 *   layoutAlign=STRETCH → height: double.infinity (in Row) / width (in Column)
 *   itemSpacing > 0  → SizedBox(width/height: N) between children
 */

import type { IRElement, IRLayout } from '@appvelocity/agent-design-to-code-core';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LayoutSpec {
  /** Indented tree string for injection into LLM prompt */
  treeText: string;
}

export function resolveLayout(root: IRElement): LayoutSpec {
  const lines: string[] = [];
  walkNode(root, 0, lines);
  return { treeText: lines.join('\n') };
}

// ─── Tree walker ──────────────────────────────────────────────────────────────

function walkNode(el: IRElement, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth);
  const spec = buildNodeSpec(el, depth);
  lines.push(`${pad}${spec.open}`);

  if (el.children.length > 0 && spec.hasChildren) {
    const isRowOrCol = el.layout.flex.direction !== 'none';
    const isStack = !isRowOrCol && el.children.length > 1;
    const gap = el.layout.flex.gap ?? 0;

    el.children.forEach((child, i) => {
      const expanded = shouldWrapExpanded(child);
      if (expanded) lines.push(`${'  '.repeat(depth + 1)}Expanded(`);
      walkNode(child, expanded ? depth + 2 : depth + 1, lines);
      if (expanded) lines.push(`${'  '.repeat(depth + 1)}),`);

      // Insert SizedBox gap between Row/Column children
      if (isRowOrCol && !isStack && gap > 0 && i < el.children.length - 1) {
        const gapWidget = el.layout.flex.direction === 'row'
          ? `SizedBox(width: ${gap}),`
          : `SizedBox(height: ${gap}),`;
        lines.push(`${'  '.repeat(depth + 1)}${gapWidget}`);
      }
    });
  }

  if (spec.close) lines.push(`${pad}${spec.close}`);
}

// ─── Node spec builder ────────────────────────────────────────────────────────

interface NodeSpec {
  open: string;
  close?: string;
  hasChildren: boolean;
}

function buildNodeSpec(el: IRElement, _depth: number): NodeSpec {
  // Leaf element types
  switch (el.type) {
    case 'text':
      return { open: `Text('${el.text?.value ?? ''}'), // ${el.name}`, hasChildren: false };

    case 'image':
    case 'icon': {
      const hasLocalAsset = !!el.image?.src;
      const widget = hasLocalAsset
        ? `Image.asset('assets/images/${el.image!.nodeId}.png', fit: BoxFit.cover),`
        : `Image.network('https://via.placeholder.com/400x300'), // ${el.name}`;
      return { open: widget, hasChildren: false };
    }

    case 'input':
      return { open: `TextField(), // ${el.name}`, hasChildren: false };

    case 'component-instance': {
      const name = toPascalCase(el.componentRef ?? el.name);
      return { open: `${name}(), // component`, hasChildren: false };
    }

    case 'touchable': {
      const { w, h } = dims(el.layout);
      const sizeStr = w || h ? ` // ${[w && `w=${w}`, h && `h=${h}`].filter(Boolean).join(', ')}` : '';
      return {
        open: `GestureDetector(${sizeStr}`,
        close: `), // end ${el.name}`,
        hasChildren: true,
      };
    }

    case 'scrollview':
      return {
        open: `SingleChildScrollView(`,
        close: `), // end ${el.name}`,
        hasChildren: true,
      };

    case 'flatlist':
      return {
        open: `ListView.builder(itemCount: 0, itemBuilder: (ctx, i) => const SizedBox.shrink()), // ${el.name}`,
        hasChildren: false,
      };

    case 'imagebackground':
      return {
        open: `Container(decoration: BoxDecoration(image: DecorationImage(image: NetworkImage('placeholder'), fit: BoxFit.cover)),`,
        close: `), // end ${el.name}`,
        hasChildren: true,
      };

    case 'view':
    default:
      return buildContainerSpec(el);
  }
}

function buildContainerSpec(el: IRElement): NodeSpec {
  const { flex } = el.layout;
  const { w, h } = dims(el.layout);
  const padding = el.layout.flex.padding;
  const hasPadding = padding && (padding.top || padding.right || padding.bottom || padding.left);

  // Absolute positioning
  if (el.layout.position === 'absolute') {
    const pos = [
      el.layout.top  !== undefined && `top: ${el.layout.top}`,
      el.layout.left !== undefined && `left: ${el.layout.left}`,
      el.layout.right !== undefined && `right: ${el.layout.right}`,
      el.layout.bottom !== undefined && `bottom: ${el.layout.bottom}`,
    ].filter(Boolean).join(', ');
    return {
      open: `Positioned(${pos},`,
      close: `), // end ${el.name}`,
      hasChildren: true,
    };
  }

  // No children
  if (el.children.length === 0) {
    const sizeStr = [w && `width: ${w}`, h && `height: ${h}`].filter(Boolean).join(', ');
    return {
      open: sizeStr
        ? `SizedBox(${sizeStr}), // ${el.name}`
        : `Container(), // ${el.name}`,
      hasChildren: false,
    };
  }

  // Auto Layout — Row or Column
  if (flex.direction !== 'none') {
    const tag = flex.direction === 'row' ? 'Row' : 'Column';
    const main = flexMainAlign(flex.mainAxisAlignment);
    const cross = flexCrossAlign(flex.crossAxisAlignment);
    const sizeHint = [w && `w=${w}`, h && `h=${h}`].filter(Boolean).join(', ');
    const paddingHint = hasPadding
      ? ` padding=EdgeInsets.fromLTRB(${padding.left},${padding.top},${padding.right},${padding.bottom})`
      : '';

    const inner = `${tag}(mainAxisAlignment: ${main}, crossAxisAlignment: ${cross}, children: [`;
    const wrapPad = hasPadding;
    const wrapSize = w || h;

    if (wrapPad || wrapSize) {
      const containerParts: string[] = [];
      if (wrapSize) containerParts.push([w && `width: ${w}`, h && `height: ${h}`].filter(Boolean).join(', '));
      if (wrapPad) containerParts.push(`padding: EdgeInsets.fromLTRB(${padding!.left},${padding!.top},${padding!.right},${padding!.bottom})`);
      return {
        open: `Container(${containerParts.join(', ')},${sizeHint ? ` // ${sizeHint}` : ''}`,
        close: `  ]), // end ${tag} for ${el.name}\n), // end Container`,
        hasChildren: true,
      };
    }

    return {
      open: `${inner} // ${el.name}${sizeHint ? ` (${sizeHint})` : ''}${paddingHint}`,
      close: `]), // end ${tag} for ${el.name}`,
      hasChildren: true,
    };
  }

  // Absolute layout — Stack
  if (el.children.length > 1) {
    const sizeStr = [w && `width: ${w}`, h && `height: ${h}`].filter(Boolean).join(', ');
    const open = sizeStr
      ? `SizedBox(${sizeStr}, child: Stack(children: [`
      : `Stack(children: [`;
    const close = sizeStr
      ? `])), // end Stack for ${el.name}`
      : `]), // end Stack for ${el.name}`;
    return { open, close, hasChildren: true };
  }

  // Single child, no layout — transparent wrapper
  const sizeStr = [w && `width: ${w}`, h && `height: ${h}`].filter(Boolean).join(', ');
  if (sizeStr) {
    return {
      open: `SizedBox(${sizeStr},`,
      close: `), // end ${el.name}`,
      hasChildren: true,
    };
  }

  return { open: `// passthrough: ${el.name}`, hasChildren: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shouldWrapExpanded(el: IRElement): boolean {
  // layoutGrow = 1 means the child fills remaining space → Expanded
  return el.layout.width === '100%' && el.layout.flex.direction !== 'none';
}

function dims(layout: IRLayout): { w: string | number | undefined; h: string | number | undefined } {
  return {
    w: layout.width === 'auto' ? undefined : layout.width,
    h: layout.height === 'auto' ? undefined : layout.height,
  };
}

function flexMainAlign(align: string): string {
  switch (align) {
    case 'center':       return 'MainAxisAlignment.center';
    case 'end':          return 'MainAxisAlignment.end';
    case 'space-between': return 'MainAxisAlignment.spaceBetween';
    default:             return 'MainAxisAlignment.start';
  }
}

function flexCrossAlign(align: string): string {
  switch (align) {
    case 'center':  return 'CrossAxisAlignment.center';
    case 'end':     return 'CrossAxisAlignment.end';
    case 'stretch': return 'CrossAxisAlignment.stretch';
    default:        return 'CrossAxisAlignment.start';
  }
}

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}
