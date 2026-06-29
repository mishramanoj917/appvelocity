/**
 * @appvelocity/agent-design-to-code-generators
 * Phase 3: Code Generators for React Native and Flutter.
 */

export { ReactNativeGenerator } from './react-native/generator.js';
export { FlutterGenerator } from './flutter/generator.js';
export { BaseGenerator } from './base-generator.js';
export { resolveLayout } from './flutter/layout-resolver.js';
export type { LayoutSpec } from './flutter/layout-resolver.js';
export { buildAssetAccessorFile, buildPubspecAssetEntries } from './flutter/asset-pipeline.js';

export type {
  CodeBundle,
  CodeFile,
  AssetFile,
  GeneratorOptions,
  GeneratorResult,
  GenerationScope,
} from './types.js';
