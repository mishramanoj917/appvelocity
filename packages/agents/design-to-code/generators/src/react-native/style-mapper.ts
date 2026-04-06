/**
 * React Native style mapper.
 *
 * Converts IRLayout and IRStyle to plain objects suitable for
 * React Native StyleSheet.create(). All values are concrete — no RN imports.
 */

import type { IRLayout, IRStyle, IRCornerRadii, IRShadowToken } from '@appvelocity/agent-design-to-code-core';

// ─── Layout → RN style object ─────────────────────────────────────────────────

export function irLayoutToRNStyle(layout: IRLayout): Record<string, unknown> {
  const style: Record<string, unknown> = {};

  const { flex } = layout;

  if (flex.direction !== 'none') {
    style.flexDirection = flex.direction === 'row' ? 'row' : 'column';

    // justifyContent maps to main-axis
    const jc = mapMainAxis(flex.mainAxisAlignment);
    if (jc) style.justifyContent = jc;

    // alignItems maps to cross-axis
    const ai = mapCrossAxis(flex.crossAxisAlignment);
    if (ai) style.alignItems = ai;

    if (flex.gap > 0) style.gap = flex.gap;
    if (flex.wrap) style.flexWrap = 'wrap';

    const { padding } = flex;
    if (padding.top === padding.right && padding.right === padding.bottom && padding.bottom === padding.left) {
      if (padding.top > 0) style.padding = padding.top;
    } else {
      if (padding.top > 0)    style.paddingTop    = padding.top;
      if (padding.right > 0)  style.paddingRight  = padding.right;
      if (padding.bottom > 0) style.paddingBottom = padding.bottom;
      if (padding.left > 0)   style.paddingLeft   = padding.left;
    }
  }

  // Dimensions
  if (layout.width !== undefined) {
    style.width = layout.width;
  }
  if (layout.height !== undefined) {
    style.height = layout.height;
  }

  // Absolute positioning
  if (layout.position === 'absolute') {
    style.position = 'absolute';
    if (layout.top    !== undefined) style.top    = layout.top;
    if (layout.left   !== undefined) style.left   = layout.left;
    if (layout.right  !== undefined) style.right  = layout.right;
    if (layout.bottom !== undefined) style.bottom = layout.bottom;
  }

  if (layout.zIndex !== undefined) style.zIndex = layout.zIndex;

  return style;
}

// ─── Style → RN style object ──────────────────────────────────────────────────

export function irStyleToRNStyle(style: IRStyle): Record<string, unknown> {
  const rn: Record<string, unknown> = {};

  if (style.backgroundColor) rn.backgroundColor = style.backgroundColor;
  if (style.borderColor)     rn.borderColor     = style.borderColor;
  if (style.borderWidth)     rn.borderWidth     = style.borderWidth;

  if (style.borderRadius !== undefined) {
    if (typeof style.borderRadius === 'number') {
      rn.borderRadius = style.borderRadius;
    } else {
      Object.assign(rn, irCornerRadiiToRN(style.borderRadius));
    }
  }

  if (style.opacity !== undefined) rn.opacity = style.opacity;

  if (style.shadow) {
    Object.assign(rn, irShadowToRNElevation(style.shadow));
  }

  if (style.overflow) rn.overflow = style.overflow;

  return rn;
}

// ─── Corner radii ─────────────────────────────────────────────────────────────

export function irCornerRadiiToRN(r: IRCornerRadii): Record<string, number> {
  return {
    borderTopLeftRadius:     r.topLeft,
    borderTopRightRadius:    r.topRight,
    borderBottomRightRadius: r.bottomRight,
    borderBottomLeftRadius:  r.bottomLeft,
  };
}

// ─── Shadow → RN elevation ────────────────────────────────────────────────────

export function irShadowToRNElevation(shadow: IRShadowToken): Record<string, unknown> {
  return {
    shadowColor:   shadow.color,
    shadowOffset:  { width: shadow.x, height: shadow.y },
    shadowOpacity: 0.25,
    shadowRadius:  shadow.blur / 2,
    elevation:     Math.round(shadow.blur / 4) + 1,
  };
}

// ─── Merges layout + style into a single RN style object ─────────────────────

export function mergeRNStyle(
  layout: IRLayout,
  style: IRStyle
): Record<string, unknown> {
  return { ...irLayoutToRNStyle(layout), ...irStyleToRNStyle(style) };
}

// ─── Serialise a style object to a JS object literal string ──────────────────

export function styleObjectToString(obj: Record<string, unknown>, indent = 4): string {
  const pad = ' '.repeat(indent);
  const inner = Object.entries(obj)
    .map(([k, v]) => {
      if (typeof v === 'string') return `${pad}${k}: '${v}',`;
      if (typeof v === 'object' && v !== null) {
        const nested = Object.entries(v as Record<string, unknown>)
          .map(([nk, nv]) => `${pad}  ${nk}: ${typeof nv === 'string' ? `'${nv}'` : String(nv)}`)
          .join(',\n');
        return `${pad}${k}: { ${nested.trim()} },`;
      }
      return `${pad}${k}: ${String(v)},`;
    })
    .join('\n');
  return `{\n${inner}\n${'  '.repeat(indent / 2)}}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapMainAxis(a: string): string | undefined {
  switch (a) {
    case 'center':        return 'center';
    case 'end':           return 'flex-end';
    case 'space-between': return 'space-between';
    case 'start':         return 'flex-start';
    default:              return undefined;
  }
}

function mapCrossAxis(a: string): string | undefined {
  switch (a) {
    case 'center':  return 'center';
    case 'end':     return 'flex-end';
    case 'stretch': return 'stretch';
    case 'start':   return 'flex-start';
    default:        return undefined;
  }
}
