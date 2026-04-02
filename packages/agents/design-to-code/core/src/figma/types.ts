/**
 * Figma REST API — TypeScript types
 *
 * Phase 1, Step 1: Define types before writing the client.
 * Reference: https://www.figma.com/developers/api
 */

// ─── File metadata ────────────────────────────────────────────────────────────

export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  styles: Record<string, FigmaStyle>;
  schemaVersion: number;
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

export type FigmaNodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'STAR'
  | 'LINE'
  | 'ELLIPSE'
  | 'REGULAR_POLYGON'
  | 'RECTANGLE'
  | 'TEXT'
  | 'SLICE'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE';

export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  visible?: boolean;
  children?: FigmaNode[];
  // Layout
  absoluteBoundingBox?: FigmaRect;
  constraints?: FigmaConstraints;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  // Style
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  // Text
  characters?: string;
  style?: FigmaTypeStyle;
  // Component
  componentId?: string;
}

export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

// ─── Paints & colours ─────────────────────────────────────────────────────────

export interface FigmaPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
}

export interface FigmaColor {
  r: number; // 0–1
  g: number;
  b: number;
  a: number;
}

// ─── Effects ──────────────────────────────────────────────────────────────────

export interface FigmaEffect {
  type: 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius?: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
}

// ─── Typography ───────────────────────────────────────────────────────────────

export interface FigmaTypeStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal?: 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';
  letterSpacing?: number;
  lineHeightPx?: number;
}

// ─── Components & Styles ──────────────────────────────────────────────────────

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
}

export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

// ─── Variables / Design Tokens ────────────────────────────────────────────────

export interface FigmaVariablesResponse {
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}

export interface FigmaVariable {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, FigmaVariableValue>;
  description?: string;
}

export type FigmaVariableValue =
  | FigmaColor
  | number
  | string
  | boolean
  | { type: 'VARIABLE_ALIAS'; id: string };

export interface FigmaVariableCollection {
  id: string;
  name: string;
  key: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  variableIds: string[];
}

// ─── Image export ─────────────────────────────────────────────────────────────

export interface FigmaImagesResponse {
  images: Record<string, string | null>; // nodeId → url
}

// ─── API response wrappers (added Phase 1) ────────────────────────────────────

/** Response from GET /v1/files/:key/nodes */
export interface FigmaNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  nodes: Record<string, { document: FigmaNode; components: Record<string, FigmaComponent> }>;
}

/** Response from GET /v1/files/:key/components */
export interface FigmaComponentsResponse {
  meta: {
    components: Array<{
      key: string;
      file_key: string;
      node_id: string;
      name: string;
      description: string;
      updated_at: string;
    }>;
  };
}

/** Auto-layout alignment values */
export type FigmaLayoutAlign =
  | 'MIN'
  | 'CENTER'
  | 'MAX'
  | 'STRETCH'
  | 'INHERIT';

/** Primary-axis align items */
export type FigmaPrimaryAxisAlignItems =
  | 'MIN'
  | 'CENTER'
  | 'MAX'
  | 'SPACE_BETWEEN';

/** Counter-axis align items */
export type FigmaCounterAxisAlignItems =
  | 'MIN'
  | 'CENTER'
  | 'MAX'
  | 'BASELINE';
