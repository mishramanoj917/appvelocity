/**
 * Indentation utilities for code generation.
 */

/**
 * Prepends `spaces` spaces to every non-empty line in `code`.
 */
export function indentBlock(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

/**
 * Returns a string of `count * 2` spaces (2-space indent unit).
 */
export function indent(depth: number): string {
  return '  '.repeat(depth);
}
