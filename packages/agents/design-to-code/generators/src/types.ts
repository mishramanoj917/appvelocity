/**
 * Public types for the code-generators package.
 *
 * CodeBundle / CodeFile / AssetFile are the canonical definitions —
 * the workflow package re-exports them from here.
 */

// ─── Output bundle ────────────────────────────────────────────────────────────

export interface CodeBundle {
  framework: 'react-native' | 'flutter';
  files: CodeFile[];
  assets: AssetFile[];
  /** Suggested npm / pub.dev dependency versions */
  dependencies: Record<string, string>;
}

export interface CodeFile {
  /** Relative path inside the output project, e.g. "src/screens/HomeScreen.tsx" */
  path: string;
  content: string;
  language: 'typescript' | 'dart';
}

export interface AssetFile {
  /** Relative destination path, e.g. "src/assets/images/hero.png" */
  path: string;
  /** Source URL (Figma CDN or resolved export URL) */
  url: string;
}

// ─── Generator options ────────────────────────────────────────────────────────

export interface GeneratorOptions {
  /** When true, emit a stub test file alongside every component/screen */
  includeTests?: boolean;
  /** Root path prefix injected into every CodeFile.path (default: "src") */
  outputDir?: string;
}

// ─── Generation scope (subset of ExecutionPlan) ───────────────────────────────

/**
 * Framework-agnostic scope passed to generators.
 * Derived from ExecutionPlan in the workflow layer; generators are decoupled
 * from the full workflow type hierarchy.
 */
export interface GenerationScope {
  /** Screen IDs in priority order */
  screens: string[];
  /** Component IDs to include */
  components: string[];
  priority: 'screens-first' | 'components-first';
}

// ─── Generator result ─────────────────────────────────────────────────────────

export interface GeneratorResult {
  bundle: CodeBundle;
  /** Non-fatal issues discovered during generation (e.g. unsupported element type) */
  warnings: string[];
  stats: {
    screenCount: number;
    componentCount: number;
    assetCount: number;
    fileCount: number;
  };
}
