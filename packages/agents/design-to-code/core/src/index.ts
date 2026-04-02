/**
 * @appvelocity/agent-design-to-code-core
 * Phase 1: Figma API Integration Layer
 */

// ─── Figma API types ──────────────────────────────────────────────────────────
export * from './figma/types.js';

// ─── Figma API client ─────────────────────────────────────────────────────────
export {
  FigmaClient,
  FigmaApiError,
  FigmaRateLimitError,
  FigmaAuthError,
} from './figma/client.js';
export type { FigmaClientConfig } from './figma/client.js';

// ─── Figma parsers ────────────────────────────────────────────────────────────
export {
  parseVariables,
  parseComponents,
  parseAutoLayout,
  classifyNode,
  extractScreens,
  resolveAlias,
} from './figma/parsers.js';
export type {
  DesignToken,
  ParsedComponent,
  ParsedAutoLayout,
  NodeClassification,
  TokenType,
} from './figma/parsers.js';

// ─── IR types ─────────────────────────────────────────────────────────────────
export * from './ir/types.js';

// ─── IR builder ───────────────────────────────────────────────────────────────
export { IRBuilder } from './ir/builder.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { parseFigmaUrl, normaliseNodeId } from './utils/url-parser.js';
export { figmaColorToHex, figmaColorToRgba, isTransparent } from './utils/color.js';
export { createLogger } from './utils/logger.js';
