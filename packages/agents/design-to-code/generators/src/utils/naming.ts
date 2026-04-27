/**
 * Naming utilities — convert between identifier conventions.
 */

/**
 * "home screen" | "home-screen" | "homeScreen" → "HomeScreen"
 * Guards against empty results and digit-leading identifiers.
 */
export function toPascalCase(input: string): string {
  const result = input
    .replace(/[-_/\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return /^\d/.test(result) ? `S${result}` : (result || 'Screen');
}

/**
 * "HomeScreen" | "home screen" | "home-screen" → "home_screen"
 */
export function toSnakeCase(input: string): string {
  return input
    // Insert underscore before uppercase letters that follow a lowercase/digit
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    // Replace spaces, hyphens, slashes with underscore
    .replace(/[\s\-/\\]+/g, '_')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Returns the correct file name for a component based on framework.
 *  - react-native → "HomeScreen.tsx"
 *  - flutter      → "home_screen.dart"
 */
export function toFileName(
  componentName: string,
  framework: 'react-native' | 'flutter'
): string {
  if (framework === 'flutter') {
    return `${toSnakeCase(componentName)}.dart`;
  }
  return `${toPascalCase(componentName)}.tsx`;
}

/**
 * Strips non-alphanumeric characters and ensures a valid identifier.
 * Used for slugifying asset names.
 */
export function toIdentifier(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .replace(/_+/g, '_');
}
