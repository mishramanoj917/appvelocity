/**
 * ViewModel types for template-driven code generation.
 *
 * Builders transform DesignIR → ViewModels.
 * The template engine renders ViewModels → final file content.
 */

// ─── React Native ─────────────────────────────────────────────────────────────

/**
 * A single property inside a StyleSheet entry.
 * `value` is already serialized as a valid JS literal string, e.g. `"'#FF0000'"` or `"16"`.
 */
export interface StylePropertyVM {
  name: string;
  value: string;
}

/**
 * One entry in StyleSheet.create({ ... }).
 */
export interface StyleEntryVM {
  styleKey: string;
  properties: StylePropertyVM[];
  hasProperties: boolean;
}

/**
 * Everything the React Native screen/component template needs.
 */
export interface RNComponentViewModel {
  /** PascalCase component name, e.g. "LoginScreen" */
  componentName: string;
  /** "Screen" | "Component" — used in the file header comment */
  tag: string;
  /** Pre-rendered JSX element tree body (already indented) */
  body: string;
  /** Ordered list of RN component names to import, e.g. ["View", "Text", "Image"] */
  imports: string[];
  /** Pre-rendered `const styles = StyleSheet.create({...});` block */
  stylesBlock: string;
}

// ─── Flutter ──────────────────────────────────────────────────────────────────

/**
 * Everything the Flutter screen/widget template needs.
 */
export interface FlutterComponentViewModel {
  /** PascalCase class name, e.g. "LoginScreen" */
  className: string;
  /** "Screen" | "Widget" — used in the file header comment */
  tag: string;
  /** Pre-rendered Dart widget tree body (already indented) */
  body: string;
}
