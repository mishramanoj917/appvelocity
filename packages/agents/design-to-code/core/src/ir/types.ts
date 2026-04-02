/**
 * Intermediate Representation (IR) — platform-agnostic design schema
 *
 * The IR sits between the Figma API (raw) and the code generators (framework-specific).
 * It describes WHAT to render, not HOW. Generators translate IR to RN/Flutter/etc.
 */

import type { DesignToken, ParsedAutoLayout, NodeClassification } from '../figma/parsers.js';

// ─── Top-level IR ─────────────────────────────────────────────────────────────

export interface DesignIR {
  /** Figma file key */
  fileKey: string;
  /** Human-readable file name */
  fileName: string;
  /** ISO timestamp of Figma last-modified */
  lastModified: string;
  /** Resolved design tokens, grouped by type */
  tokens: IRTokenSet;
  /** All parsed screens */
  screens: IRScreen[];
  /** Reusable component definitions */
  components: IRComponent[];
  /** Asset references (icons, images) */
  assets: IRAsset[];
  /** Build metadata */
  meta: IRMeta;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

export interface IRTokenSet {
  colors: Record<string, IRColorToken>;
  typography: Record<string, IRTypographyToken>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, IRShadowToken>;
  raw: DesignToken[];
}

export interface IRColorToken {
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
  path: string;
  isAlias: boolean;
  aliasPath?: string;
}

export interface IRTypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  lineHeight?: number;
  letterSpacing?: number;
  path: string;
}

export interface IRShadowToken {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
  inset?: boolean;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export interface IRScreen {
  id: string;
  name: string;
  /** Normalised slug for file naming, e.g. "HomeScreen" */
  componentName: string;
  width: number;
  height: number;
  /** The root element tree */
  root: IRElement;
  /** Flat map of all elements by ID for quick lookup */
  elementIndex: Record<string, IRElement>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface IRComponent {
  id: string;
  name: string;
  componentName: string;
  atomicLevel: 'atom' | 'molecule' | 'organism' | 'template';
  variants: IRComponentVariant[];
  defaultVariant: IRElement;
}

export interface IRComponentVariant {
  properties: Record<string, string>;
  root: IRElement;
}

// ─── Element tree ─────────────────────────────────────────────────────────────

export type IRElementType =
  | 'view'
  | 'text'
  | 'image'
  | 'icon'
  | 'scrollview'
  | 'flatlist'
  | 'touchable'
  | 'input'
  | 'component-instance';

export interface IRElement {
  id: string;
  type: IRElementType;
  name: string;
  classification: NodeClassification;

  // Layout
  layout: IRLayout;
  // Style
  style: IRStyle;
  // Content (type-specific)
  text?: IRTextContent;
  image?: IRImageContent;
  componentRef?: string; // points to IRComponent.id

  children: IRElement[];
}

export interface IRLayout {
  flex: ParsedAutoLayout;
  width?: number | 'auto' | '100%';
  height?: number | 'auto';
  position?: 'absolute' | 'relative';
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  zIndex?: number;
}

export interface IRStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number | IRCornerRadii;
  opacity?: number;
  shadow?: IRShadowToken;
  overflow?: 'hidden' | 'visible' | 'scroll';
}

export interface IRCornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface IRTextContent {
  value: string;
  style: IRTypographyToken & {
    color?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    textDecoration?: 'none' | 'underline' | 'line-through';
  };
}

export interface IRImageContent {
  src?: string;     // resolved export URL
  alt?: string;
  nodeId: string;   // Figma node ID to export
  format: 'svg' | 'png';
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export interface IRAsset {
  id: string;
  nodeId: string;
  name: string;
  /** Suggested file name without extension, e.g. "ic_arrow_right" */
  slug: string;
  format: 'svg' | 'png' | 'jpg';
  url?: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface IRMeta {
  generatedAt: string;
  figmaVersion: string;
  schemaVersion: '1.0';
  stats: {
    screenCount: number;
    componentCount: number;
    tokenCount: number;
    assetCount: number;
  };
}
