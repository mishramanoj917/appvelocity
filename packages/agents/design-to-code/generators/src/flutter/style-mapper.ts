/**
 * Flutter style mapper.
 *
 * Converts IRLayout and IRStyle to Dart code snippets for
 * BoxDecoration, EdgeInsets, and layout widget props.
 */

import type { IRLayout, IRStyle, IRCornerRadii, IRShadowToken } from '@appvelocity/agent-design-to-code-core';

// ─── Layout helpers ───────────────────────────────────────────────────────────

/**
 * Returns Dart CrossAxisAlignment enum value string from IR cross-axis.
 */
export function irCrossAxisToDart(a: string): string {
  switch (a) {
    case 'center':  return 'CrossAxisAlignment.center';
    case 'end':     return 'CrossAxisAlignment.end';
    case 'stretch': return 'CrossAxisAlignment.stretch';
    default:        return 'CrossAxisAlignment.start';
  }
}

/**
 * Returns Dart MainAxisAlignment enum value string from IR main-axis.
 */
export function irMainAxisToDart(a: string): string {
  switch (a) {
    case 'center':        return 'MainAxisAlignment.center';
    case 'end':           return 'MainAxisAlignment.end';
    case 'space-between': return 'MainAxisAlignment.spaceBetween';
    default:              return 'MainAxisAlignment.start';
  }
}

/**
 * Converts IRLayout padding to Dart EdgeInsets snippet.
 * Returns undefined when all padding is 0.
 */
export function irPaddingToDart(layout: IRLayout): string | undefined {
  const { top, right, bottom, left } = layout.flex.padding;
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return undefined;
  if (top === right && right === bottom && bottom === left) {
    return `EdgeInsets.all(${top})`;
  }
  return `EdgeInsets.only(top: ${top}, right: ${right}, bottom: ${bottom}, left: ${left})`;
}

// ─── Style → BoxDecoration ────────────────────────────────────────────────────

export interface BoxDecorationParts {
  /** Dart BoxDecoration(...) snippet, or undefined when no decoration is needed */
  decoration?: string;
  opacity?: number;
}

export function irStyleToBoxDecoration(style: IRStyle): BoxDecorationParts {
  const parts: string[] = [];

  if (style.backgroundColor) {
    parts.push(`color: Color(${hexToFlutterColor(style.backgroundColor)})`);
  }

  if (style.borderColor || style.borderWidth) {
    const color = style.borderColor ?? '#000000';
    const width = style.borderWidth ?? 1;
    parts.push(`border: Border.all(color: Color(${hexToFlutterColor(color)}), width: ${width})`);
  }

  if (style.borderRadius !== undefined) {
    parts.push(`borderRadius: ${irBorderRadiusToDart(style.borderRadius)}`);
  }

  if (style.shadow) {
    parts.push(`boxShadow: [${irShadowToDart(style.shadow)}]`);
  }

  const decoration = parts.length > 0
    ? `BoxDecoration(\n  ${parts.join(',\n  ')},\n)`
    : undefined;

  return { decoration, opacity: style.opacity };
}

// ─── Corner radii → BorderRadius ─────────────────────────────────────────────

export function irBorderRadiusToDart(r: number | IRCornerRadii): string {
  if (typeof r === 'number') {
    return `BorderRadius.circular(${r})`;
  }
  return (
    `BorderRadius.only(\n` +
    `  topLeft: Radius.circular(${r.topLeft}),\n` +
    `  topRight: Radius.circular(${r.topRight}),\n` +
    `  bottomRight: Radius.circular(${r.bottomRight}),\n` +
    `  bottomLeft: Radius.circular(${r.bottomLeft}),\n` +
    `)`
  );
}

// ─── Shadow → BoxShadow ───────────────────────────────────────────────────────

export function irShadowToDart(shadow: IRShadowToken): string {
  return (
    `BoxShadow(\n` +
    `  color: Color(${hexToFlutterColor(shadow.color)}).withOpacity(0.25),\n` +
    `  offset: Offset(${shadow.x}, ${shadow.y}),\n` +
    `  blurRadius: ${shadow.blur},\n` +
    (shadow.spread ? `  spreadRadius: ${shadow.spread},\n` : '') +
    `)`
  );
}

// ─── Color conversion ─────────────────────────────────────────────────────────

/**
 * Converts a CSS hex color to a Flutter 0xFF... int literal.
 * Supports #RGB, #RRGGBB, #RRGGBBAA.
 */
export function hexToFlutterColor(hex: string): string {
  const clean = hex.replace('#', '');
  let r = 'FF', g = 'FF', b = 'FF', a = 'FF';

  if (clean.length === 3) {
    r = clean[0]!.repeat(2);
    g = clean[1]!.repeat(2);
    b = clean[2]!.repeat(2);
  } else if (clean.length === 6) {
    r = clean.slice(0, 2);
    g = clean.slice(2, 4);
    b = clean.slice(4, 6);
  } else if (clean.length === 8) {
    r = clean.slice(0, 2);
    g = clean.slice(2, 4);
    b = clean.slice(4, 6);
    a = clean.slice(6, 8);
  }

  return `0x${a.toUpperCase()}${r.toUpperCase()}${g.toUpperCase()}${b.toUpperCase()}`;
}
