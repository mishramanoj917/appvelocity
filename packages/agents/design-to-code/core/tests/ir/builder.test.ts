import { describe, it, expect } from 'vitest';
import { IRBuilder } from '../../src/ir/builder.js';
import { parseFigmaUrl, normaliseNodeId } from '../../src/utils/url-parser.js';
import { figmaColorToHex, figmaColorToRgba, isTransparent, mixColors } from '../../src/utils/color.js';
import { MOCK_FIGMA_FILE, MOCK_VARIABLES_RESPONSE } from '../fixtures/figma-mocks.js';

// ─── IRBuilder ────────────────────────────────────────────────────────────────

describe('IRBuilder', () => {
  const builder = new IRBuilder();

  it('builds a DesignIR with all top-level fields', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    expect(ir.fileKey).toBe('test-key');
    expect(ir.fileName).toBe('AppVelocity Design System');
    expect(ir.meta.schemaVersion).toBe('1.0');
  });

  it('extracts one screen', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    expect(ir.screens).toHaveLength(1);
    expect(ir.screens[0]?.name).toBe('Home Screen');
    expect(ir.screens[0]?.width).toBe(375);
    expect(ir.screens[0]?.height).toBe(812);
  });

  it('generates a PascalCase componentName for the screen', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    expect(ir.screens[0]?.componentName).toBe('HomeScreen');
  });

  it('builds element index for quick lookup', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    const index = ir.screens[0]?.elementIndex ?? {};
    expect(Object.keys(index).length).toBeGreaterThan(0);
    expect(index['text:title']).toBeDefined();
  });

  it('maps TEXT node to text element with content', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    const title = ir.screens[0]?.elementIndex['text:title'];
    expect(title?.type).toBe('text');
    expect(title?.text?.value).toBe('Welcome to AppVelocity');
    expect(title?.text?.style.fontFamily).toBe('Inter');
    expect(title?.text?.style.fontSize).toBe(28);
  });

  it('maps INSTANCE to component-instance element', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    const btn = ir.screens[0]?.elementIndex['comp-instance:btn'];
    expect(btn?.type).toBe('component-instance');
  });

  it('extracts background colour from fill', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    const card = ir.screens[0]?.elementIndex['frame:card'];
    expect(card?.style.backgroundColor).toBeTruthy();
  });

  it('extracts drop shadow from effects', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key');
    const card = ir.screens[0]?.elementIndex['frame:card'];
    expect(card?.style.shadow).toBeDefined();
    expect(card?.style.shadow?.blur).toBe(8);
  });

  it('includes design tokens when variables provided', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key', MOCK_VARIABLES_RESPONSE);
    expect(Object.keys(ir.tokens.colors).length).toBeGreaterThan(0);
    expect(Object.keys(ir.tokens.spacing).length).toBeGreaterThan(0);
  });

  it('reports accurate stats in meta', () => {
    const ir = builder.build(MOCK_FIGMA_FILE, 'test-key', MOCK_VARIABLES_RESPONSE);
    expect(ir.meta.stats.screenCount).toBe(1);
    expect(ir.meta.stats.tokenCount).toBeGreaterThan(0);
  });
});

// ─── parseFigmaUrl ────────────────────────────────────────────────────────────

describe('parseFigmaUrl', () => {
  it('parses a standard /file/ URL', () => {
    const result = parseFigmaUrl('https://www.figma.com/file/aBcDeF123456/My-Design?node-id=1-2');
    expect(result.fileKey).toBe('aBcDeF123456');
    expect(result.nodeId).toBe('1-2');
  });

  it('parses a /design/ URL', () => {
    const result = parseFigmaUrl('https://figma.com/design/XYZ789/App-UI');
    expect(result.fileKey).toBe('XYZ789');
  });

  it('accepts a bare file key', () => {
    const result = parseFigmaUrl('aBcDeF1234567890');
    expect(result.fileKey).toBe('aBcDeF1234567890');
  });

  it('throws on completely invalid input', () => {
    expect(() => parseFigmaUrl('not-a-url')).toThrow();
  });

  it('decodes URL-encoded node ids', () => {
    const result = parseFigmaUrl(
      'https://www.figma.com/file/KEY/Name?node-id=123%3A456'
    );
    expect(result.nodeId).toBe('123:456');
  });
});

describe('normaliseNodeId', () => {
  it('converts dash-separated to colon-separated', () => {
    expect(normaliseNodeId('0-1')).toBe('0:1');
    expect(normaliseNodeId('123-456')).toBe('123:456');
  });

  it('leaves already-normalised IDs unchanged', () => {
    expect(normaliseNodeId('0:1')).toBe('0:1');
  });
});

// ─── Color utilities ──────────────────────────────────────────────────────────

describe('figmaColorToHex', () => {
  it('converts 0–1 RGBA to 6-digit hex for opaque color', () => {
    expect(figmaColorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
    expect(figmaColorToHex({ r: 0, g: 0, b: 1, a: 1 })).toBe('#0000ff');
    expect(figmaColorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffff');
    expect(figmaColorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
  });

  it('produces 8-digit hex for semi-transparent color', () => {
    const hex = figmaColorToHex({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(hex).toHaveLength(9); // # + 8 chars
    expect(hex).toMatch(/^#[0-9a-f]{8}$/i);
  });

  it('rounds channel values correctly', () => {
    // 0.388 * 255 ≈ 98.94 → rounds to 99 = 0x63
    const hex = figmaColorToHex({ r: 0.388, g: 0.400, b: 0.945, a: 1 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('figmaColorToRgba', () => {
  it('produces a valid rgba() string', () => {
    const result = figmaColorToRgba({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(result).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
    expect(result).toBe('rgba(255, 0, 0, 0.500)');
  });
});

describe('isTransparent', () => {
  it('returns true for alpha=0', () => {
    expect(isTransparent({ r: 1, g: 1, b: 1, a: 0 })).toBe(true);
  });

  it('returns false for any visible color', () => {
    expect(isTransparent({ r: 0, g: 0, b: 0, a: 0.01 })).toBe(false);
    expect(isTransparent({ r: 1, g: 1, b: 1, a: 1 })).toBe(false);
  });
});

describe('mixColors', () => {
  it('returns first color at ratio=0', () => {
    const a = { r: 1, g: 0, b: 0, a: 1 };
    const b = { r: 0, g: 0, b: 1, a: 1 };
    expect(mixColors(a, b, 0)).toEqual(a);
  });

  it('returns second color at ratio=1', () => {
    const a = { r: 1, g: 0, b: 0, a: 1 };
    const b = { r: 0, g: 0, b: 1, a: 1 };
    expect(mixColors(a, b, 1)).toEqual(b);
  });

  it('blends midpoint at ratio=0.5', () => {
    const a = { r: 1, g: 0, b: 0, a: 1 };
    const b = { r: 0, g: 0, b: 1, a: 1 };
    const mid = mixColors(a, b, 0.5);
    expect(mid.r).toBeCloseTo(0.5);
    expect(mid.b).toBeCloseTo(0.5);
  });
});
