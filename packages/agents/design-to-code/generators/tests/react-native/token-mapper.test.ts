import { describe, it, expect } from 'vitest';
import { buildTokensFile } from '../../src/react-native/token-mapper.js';
import { mockDesignIR } from '../fixtures/mock-ir.js';

describe('buildTokensFile', () => {
  it('returns path src/tokens/tokens.ts with typescript language', () => {
    const file = buildTokensFile(mockDesignIR.tokens);
    expect(file.path).toBe('src/tokens/tokens.ts');
    expect(file.language).toBe('typescript');
  });

  it('respects custom outputDir', () => {
    const file = buildTokensFile(mockDesignIR.tokens, 'app');
    expect(file.path).toBe('app/tokens/tokens.ts');
  });

  it('exports COLORS with hex values', () => {
    const { content } = buildTokensFile(mockDesignIR.tokens);
    expect(content).toContain('export const COLORS');
    expect(content).toContain('#6366F1');
  });

  it('exports TYPOGRAPHY with fontFamily and fontSize', () => {
    const { content } = buildTokensFile(mockDesignIR.tokens);
    expect(content).toContain('export const TYPOGRAPHY');
    expect(content).toContain("fontFamily: 'Inter'");
    expect(content).toContain('fontSize: 16');
  });

  it('exports SPACING record', () => {
    const { content } = buildTokensFile(mockDesignIR.tokens);
    expect(content).toContain('export const SPACING');
    expect(content).toContain('sm: 8');
  });

  it('exports RADII record', () => {
    const { content } = buildTokensFile(mockDesignIR.tokens);
    expect(content).toContain('export const RADII');
  });

  it('produces empty objects for empty token sets', () => {
    const emptyTokens = { ...mockDesignIR.tokens, colors: {}, typography: {}, spacing: {}, radii: {} };
    const { content } = buildTokensFile(emptyTokens);
    // Should not throw and should have empty object literals
    expect(content).toContain('export const COLORS = {');
    expect(content).toContain('} as const;');
  });
});
