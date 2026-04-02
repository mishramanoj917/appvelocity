import type { FigmaColor } from '../figma/types.js';

/** Convert Figma 0–1 RGBA to CSS hex string (#rrggbb or #rrggbbaa) */
export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Math.round(color.a * 255);

  if (a === 255) {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
}

/** Convert Figma 0–1 RGBA to CSS rgba() string */
export function figmaColorToRgba(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(3)})`;
}

/** Returns true if the color is fully transparent */
export function isTransparent(color: FigmaColor): boolean {
  return color.a === 0;
}

/** Mix two Figma colors at a given ratio (0 = all a, 1 = all b) */
export function mixColors(a: FigmaColor, b: FigmaColor, ratio: number): FigmaColor {
  return {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
    a: a.a + (b.a - a.a) * ratio,
  };
}
