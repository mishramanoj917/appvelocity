/**
 * IR → compact text serialiser for LLM prompts.
 *
 * Converts the platform-agnostic DesignIR into a human-readable, token-efficient
 * text tree that fits inside a code-generation prompt without overwhelming the
 * model's context window.
 */

import type { IRElement, IRScreen, IRComponent, IRTokenSet } from '@appvelocity/agent-design-to-code-core';

const ELEMENT_CAP = 20;    // max children per node in serialised output
const CHAR_BUDGET  = 5000;  // max chars for a full screen tree

// ─── Public API ───────────────────────────────────────────────────────────────

export function serializeScreen(screen: IRScreen): string {
  const header = `Screen: ${screen.componentName} (${screen.width}×${screen.height})`;
  const tree   = serializeElement(screen.root, 0, CHAR_BUDGET - header.length);
  return `${header}\n${tree}`;
}

export function serializeComponent(component: IRComponent): string {
  const header = `Component: ${component.componentName}`;
  const tree   = serializeElement(component.defaultVariant, 0, CHAR_BUDGET / 2);
  return `${header}\n${tree}`;
}

/**
 * Returns a compact one-line summary of the token set for injection into prompts.
 * Limits output to the most-prominent tokens so the prompt doesn't balloon.
 */
export function serializeTokenSummary(tokens: IRTokenSet): string {
  const lines: string[] = [];

  const colors = Object.entries(tokens.colors).slice(0, 12);
  if (colors.length > 0) {
    lines.push('COLORS: ' + colors.map(([k, v]) => `${k}="${v.hex}"`).join(', '));
  }

  const typo = Object.entries(tokens.typography).slice(0, 6);
  if (typo.length > 0) {
    lines.push(
      'TYPOGRAPHY: ' +
        typo.map(([k, v]) => `${k}(fs=${v.fontSize},fw=${v.fontWeight})`).join(', ')
    );
  }

  const spacing = Object.entries(tokens.spacing).slice(0, 8);
  if (spacing.length > 0) {
    lines.push('SPACING: ' + spacing.map(([k, v]) => `${k}=${v}`).join(', '));
  }

  const radii = Object.entries(tokens.radii).slice(0, 6);
  if (radii.length > 0) {
    lines.push('RADII: ' + radii.map(([k, v]) => `${k}=${v}`).join(', '));
  }

  return lines.join('\n');
}

// ─── Core serialiser ──────────────────────────────────────────────────────────

function serializeElement(el: IRElement, depth: number, remainingChars: number): string {
  if (remainingChars <= 0) return '  '.repeat(depth) + '[... truncated]';

  const pad   = '  '.repeat(depth);
  const attrs: string[] = [];

  // ── Dimensions ──────────────────────────────────────────────────────────────
  const w = el.layout.width;
  const h = el.layout.height;
  if (w != null && w !== 'auto' && w !== '100%') attrs.push(`w=${w}`);
  if (h != null && h !== 'auto')                  attrs.push(`h=${h}`);
  if (w === '100%')                               attrs.push('w=100%');

  // ── Background / opacity ────────────────────────────────────────────────────
  if (el.style.backgroundColor) attrs.push(`bg="${el.style.backgroundColor}"`);
  if (el.style.opacity != null && el.style.opacity < 1) {
    attrs.push(`op=${el.style.opacity}`);
  }

  // ── Border radius ───────────────────────────────────────────────────────────
  const br = el.style.borderRadius;
  if (br != null) {
    if (typeof br === 'number' && br > 0) {
      attrs.push(`radius=${br}`);
    } else if (typeof br === 'object') {
      const { topLeft: tl, topRight: tr, bottomRight: brl, bottomLeft: bl } = br;
      if (tl === tr && tr === brl && brl === bl) {
        if (tl > 0) attrs.push(`radius=${tl}`);
      } else {
        attrs.push(`radius=${tl}/${tr}/${brl}/${bl}`);
      }
    }
  }

  // ── Border stroke ───────────────────────────────────────────────────────────
  if (el.style.borderWidth) {
    attrs.push(`border-w=${el.style.borderWidth} border-c="${el.style.borderColor ?? '#000'}"`);
  }
  if (el.style.overflow && el.style.overflow !== 'visible') {
    attrs.push(`overflow=${el.style.overflow}`);
  }

  // ── Flex layout ─────────────────────────────────────────────────────────────
  const flex = el.layout.flex;
  if (flex.direction !== 'none') attrs.push(`flex=${flex.direction}`);
  if (flex.gap > 0)               attrs.push(`gap=${flex.gap}`);
  if (flex.mainAxisAlignment  !== 'start')  attrs.push(`main=${flex.mainAxisAlignment}`);
  if (flex.crossAxisAlignment !== 'start')  attrs.push(`cross=${flex.crossAxisAlignment}`);
  if (flex.wrap) attrs.push('wrap');

  // ── Padding ─────────────────────────────────────────────────────────────────
  const p = flex.padding;
  if (p.top > 0 || p.right > 0 || p.bottom > 0 || p.left > 0) {
    if (p.top === p.right && p.right === p.bottom && p.bottom === p.left) {
      attrs.push(`pad=${p.top}`);
    } else {
      attrs.push(`pad=${p.top}/${p.right}/${p.bottom}/${p.left}`);
    }
  }

  // ── Absolute position ───────────────────────────────────────────────────────
  if (el.layout.position === 'absolute') {
    attrs.push(`abs top=${el.layout.top ?? 0},left=${el.layout.left ?? 0}`);
    if (el.layout.zIndex) attrs.push(`z=${el.layout.zIndex}`);
  }

  // ── Text content ────────────────────────────────────────────────────────────
  if (el.text) {
    const s       = el.text.style;
    const preview = el.text.value.slice(0, 50).replace(/\n/g, ' ').replace(/"/g, "'");
    attrs.push(`text="${preview}"`);
    if (s.fontSize) attrs.push(`fs=${s.fontSize}`);
    if (s.fontWeight && Number(s.fontWeight) >= 600) attrs.push('bold');
    if (s.color) attrs.push(`color="${s.color}"`);
    if (s.textAlign && s.textAlign !== 'left') attrs.push(`align=${s.textAlign}`);
    if (s.textDecoration && s.textDecoration !== 'none') attrs.push(`deco=${s.textDecoration}`);
  }

  // ── Image / icon ────────────────────────────────────────────────────────────
  if (el.image) {
    if (el.image.src) {
      // Do NOT truncate CDN URLs — Figma export URLs are 200+ chars and must be
      // passed verbatim to the LLM so it can generate correct Image sources.
      attrs.push(`src="${el.image.src}"`);
    } else {
      attrs.push(`asset="${el.image.nodeId.replace(':', '_')}.${el.image.format}"`);
    }
  }

  // ── Build line ──────────────────────────────────────────────────────────────
  const safeName = el.name.replace(/[^a-zA-Z0-9\s_-]/g, '').slice(0, 30).trim() || el.type;
  const tag      = `[${el.type}:${safeName}]`;
  const line     = pad + tag + (attrs.length > 0 ? ' ' + attrs.join(' ') : '');

  if (el.children.length === 0) return line;

  const lineLen      = line.length + 1;
  const childStrings: string[] = [];
  let usedChars      = lineLen;

  for (const child of el.children.slice(0, ELEMENT_CAP)) {
    const childStr = serializeElement(child, depth + 1, remainingChars - usedChars);
    childStrings.push(childStr);
    usedChars += childStr.length + 1;
    if (usedChars >= remainingChars) break;
  }

  return line + '\n' + childStrings.join('\n');
}
