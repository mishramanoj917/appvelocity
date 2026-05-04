/**
 * style-generator — deterministic StyleSheet generation from DesignIR.
 *
 * Instead of asking the LLM to invent StyleSheet dimensions from a text
 * description, this module pre-generates the COMPLETE StyleSheet from the IR's
 * exact pixel values. The LLM then only writes the JSX/Widget tree structure,
 * referencing pre-named style keys.
 *
 * This is the primary driver of pixel-perfect output — the IR already has
 * absoluteBoundingBox dimensions from Figma (or better, plugin renderedBounds).
 * All we do here is write them out as valid code, no guesswork involved.
 */

import type {
  IRScreen,
  IRComponent,
  IRElement,
  IRCornerRadii,
} from '@appvelocity/agent-design-to-code-core';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a complete React Native `StyleSheet.create({ ... })` block for the
 * given screen or component. Every element in the IR gets a named entry.
 */
export function generateRNStyleSheet(
  target: IRScreen | IRComponent
): { code: string; styleMap: Map<string, string> } {
  const root = 'root' in target ? target.root : target.defaultVariant;
  const entries: string[] = [];
  const styleMap = new Map<string, string>(); // elementId → style key name
  const usedNames = new Set<string>(['safeArea']);

  // safeArea is always first — wraps the entire screen
  const bgColor = extractRootBg(root);
  entries.push(`  safeArea: { flex: 1, backgroundColor: '${bgColor}' }`);

  walkRN(root, entries, styleMap, usedNames);

  const code = `const styles = StyleSheet.create({\n${entries.join(',\n')},\n});`;
  return { code, styleMap };
}

/**
 * Returns a block of Dart `const` declarations for layout constants used in the
 * Flutter widget tree (dimensions, radii, paddings).
 */
export function generateFlutterLayoutConstants(
  target: IRScreen | IRComponent
): string {
  const root = 'root' in target ? target.root : target.defaultVariant;
  const lines: string[] = ['// Layout constants — auto-generated from design IR'];
  const usedNames = new Set<string>();

  walkFlutter(root, lines, usedNames);
  return lines.join('\n');
}

// ─── React Native walker ──────────────────────────────────────────────────────

function walkRN(
  el: IRElement,
  entries: string[],
  styleMap: Map<string, string>,
  usedNames: Set<string>
): void {
  const styleName = toUniqueKey(el.name, usedNames);
  styleMap.set(el.id, styleName);

  const props: string[] = [];

  // Dimensions (from IR — absoluteBoundingBox or pluginRenderedBounds)
  if (typeof el.layout.width === 'number')  props.push(`width: ${el.layout.width}`);
  if (typeof el.layout.height === 'number') props.push(`height: ${el.layout.height}`);
  if (el.layout.width === '100%')           props.push(`width: '100%'`);

  // Flex layout
  const flex = el.layout.flex;
  if (flex.direction === 'row')    props.push(`flexDirection: 'row'`);
  if (flex.direction === 'column') props.push(`flexDirection: 'column'`);
  if (flex.gap > 0)                props.push(`gap: ${flex.gap}`);
  if (flex.wrap)                   props.push(`flexWrap: 'wrap'`);

  const justifyMap: Record<string, string> = {
    center:          'center',
    end:             'flex-end',
    'space-between': 'space-between',
  };
  const alignMap: Record<string, string> = {
    center:  'center',
    end:     'flex-end',
    stretch: 'stretch',
  };
  if (flex.mainAxisAlignment  !== 'start') props.push(`justifyContent: '${justifyMap[flex.mainAxisAlignment] ?? flex.mainAxisAlignment}'`);
  if (flex.crossAxisAlignment !== 'start') props.push(`alignItems: '${alignMap[flex.crossAxisAlignment] ?? flex.crossAxisAlignment}'`);

  // Padding
  const p = flex.padding;
  if (p.top === p.right && p.right === p.bottom && p.bottom === p.left && p.top > 0) {
    props.push(`padding: ${p.top}`);
  } else {
    if (p.top > 0)    props.push(`paddingTop: ${p.top}`);
    if (p.right > 0)  props.push(`paddingRight: ${p.right}`);
    if (p.bottom > 0) props.push(`paddingBottom: ${p.bottom}`);
    if (p.left > 0)   props.push(`paddingLeft: ${p.left}`);
  }

  // Background
  if (el.style.backgroundColor) props.push(`backgroundColor: '${el.style.backgroundColor}'`);

  // Border radius
  if (el.style.borderRadius != null) {
    if (typeof el.style.borderRadius === 'number' && el.style.borderRadius > 0) {
      props.push(`borderRadius: ${el.style.borderRadius}`);
    } else if (typeof el.style.borderRadius === 'object') {
      const r = el.style.borderRadius as IRCornerRadii;
      if (r.topLeft === r.topRight && r.topRight === r.bottomRight && r.bottomRight === r.bottomLeft) {
        if (r.topLeft > 0) props.push(`borderRadius: ${r.topLeft}`);
      } else {
        props.push(`borderTopLeftRadius: ${r.topLeft}, borderTopRightRadius: ${r.topRight}, borderBottomRightRadius: ${r.bottomRight}, borderBottomLeftRadius: ${r.bottomLeft}`);
      }
    }
  }

  // Border stroke
  if (el.style.borderWidth) {
    props.push(`borderWidth: ${el.style.borderWidth}`);
    if (el.style.borderColor) props.push(`borderColor: '${el.style.borderColor}'`);
  }

  // Overflow
  if (el.style.overflow === 'hidden') props.push(`overflow: 'hidden'`);

  // Opacity
  if (el.style.opacity != null && el.style.opacity < 1) {
    props.push(`opacity: ${Math.round(el.style.opacity * 100) / 100}`);
  }

  // Absolute positioning
  if (el.layout.position === 'absolute') {
    props.push(`position: 'absolute'`);
    if (el.layout.top  != null) props.push(`top: ${el.layout.top}`);
    if (el.layout.left != null) props.push(`left: ${el.layout.left}`);
    if (el.layout.zIndex)       props.push(`zIndex: ${el.layout.zIndex}`);
  }

  // Shadow
  if (el.style.shadow) {
    const s = el.style.shadow;
    props.push(
      `shadowColor: '${s.color}', shadowOffset: { width: ${s.x}, height: ${s.y} }, ` +
      `shadowOpacity: 0.3, shadowRadius: ${s.blur}, elevation: ${Math.round(s.blur / 2)}`
    );
  }

  // Text-specific
  if (el.type === 'text' && el.text) {
    const ts = el.text.style;
    if (ts.fontSize)                         props.push(`fontSize: ${ts.fontSize}`);
    if (ts.fontWeight)                        props.push(`fontWeight: '${ts.fontWeight}'`);
    if (ts.color)                             props.push(`color: '${ts.color}'`);
    if (ts.textAlign && ts.textAlign !== 'left') props.push(`textAlign: '${ts.textAlign}'`);
    if (ts.lineHeight)                        props.push(`lineHeight: ${Math.round(ts.lineHeight)}`);
    if (ts.letterSpacing)                     props.push(`letterSpacing: ${ts.letterSpacing}`);
    if (ts.textDecoration && ts.textDecoration !== 'none') props.push(`textDecorationLine: '${ts.textDecoration}'`);
  }

  if (props.length > 0) {
    entries.push(`  ${styleName}: { ${props.join(', ')} }`);
  }

  for (const child of el.children) walkRN(child, entries, styleMap, usedNames);
}

// ─── Flutter walker ────────────────────────────────────────────────────────────

function walkFlutter(
  el: IRElement,
  lines: string[],
  usedNames: Set<string>
): void {
  const prefix = toConstPrefix(el.name, usedNames);

  if (typeof el.layout.width  === 'number') lines.push(`const double k${prefix}Width = ${el.layout.width};`);
  if (typeof el.layout.height === 'number') lines.push(`const double k${prefix}Height = ${el.layout.height};`);

  const p = el.layout.flex.padding;
  if (p.top > 0 || p.right > 0 || p.bottom > 0 || p.left > 0) {
    lines.push(`const EdgeInsets k${prefix}Padding = EdgeInsets.fromLTRB(${p.left}, ${p.top}, ${p.right}, ${p.bottom});`);
  }

  if (el.style.borderRadius != null && typeof el.style.borderRadius === 'number' && el.style.borderRadius > 0) {
    lines.push(`const BorderRadius k${prefix}Radius = BorderRadius.all(Radius.circular(${el.style.borderRadius}));`);
  }

  for (const child of el.children) walkFlutter(child, lines, usedNames);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUniqueKey(name: string, used: Set<string>): string {
  const base = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'element';

  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}${n++}`;
  }
  used.add(key);
  return key;
}

function toConstPrefix(name: string, used: Set<string>): string {
  const base = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Element';

  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}${n++}`;
  }
  used.add(key);
  return key;
}

function extractRootBg(root: IRElement): string {
  return root.style.backgroundColor ?? '#FFFFFF';
}
