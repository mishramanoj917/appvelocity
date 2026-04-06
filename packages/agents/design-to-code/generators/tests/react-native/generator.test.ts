import { describe, it, expect } from 'vitest';
import { ReactNativeGenerator } from '../../src/react-native/generator.js';
import { mockDesignIR, mockScope, emptyScope } from '../fixtures/mock-ir.js';

const gen = new ReactNativeGenerator();

describe('ReactNativeGenerator', () => {
  it('returns a CodeBundle with framework: react-native', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    expect(bundle.framework).toBe('react-native');
  });

  it('emits one screen file at src/screens/HomeScreen.tsx', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('src/screens/HomeScreen.tsx');
  });

  it('emits one component file at src/components/PrimaryButton.tsx', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('src/components/PrimaryButton.tsx');
  });

  it('emits tokens file at src/tokens/tokens.ts', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('src/tokens/tokens.ts');
  });

  it('collects assets where url is defined', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    // asset:1 has url, asset:2 does not
    expect(bundle.assets).toHaveLength(1);
    expect(bundle.assets[0]!.url).toContain('cdn.figma.com');
  });

  it('dependencies includes react and react-native keys', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    expect(bundle.dependencies).toHaveProperty('react');
    expect(bundle.dependencies).toHaveProperty('react-native');
  });

  it('when options.includeTests=true, emits a .test.tsx per screen', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope, { includeTests: true });
    const paths = bundle.files.map((f) => f.path);
    expect(paths.some((p) => p.endsWith('.test.tsx'))).toBe(true);
  });

  it('screens-first: screen file appears before component file in bundle', () => {
    const { bundle } = gen.generate(mockDesignIR, { ...mockScope, priority: 'screens-first' });
    const screenIdx = bundle.files.findIndex((f) => f.path.includes('/screens/'));
    const compIdx   = bundle.files.findIndex((f) => f.path.includes('/components/'));
    expect(screenIdx).toBeLessThan(compIdx);
  });

  it('components-first: component file appears before screen file in bundle', () => {
    const { bundle } = gen.generate(mockDesignIR, { ...mockScope, priority: 'components-first' });
    const screenIdx = bundle.files.findIndex((f) => f.path.includes('/screens/'));
    const compIdx   = bundle.files.findIndex((f) => f.path.includes('/components/'));
    expect(compIdx).toBeLessThan(screenIdx);
  });

  it('scope filters screens by ID (screen not in scope → no file)', () => {
    const { bundle } = gen.generate(mockDesignIR, { ...mockScope, screens: ['non-existent'] });
    const paths = bundle.files.map((f) => f.path);
    expect(paths).not.toContain('src/screens/HomeScreen.tsx');
  });

  it('empty scope includes all screens and components', () => {
    const { bundle } = gen.generate(mockDesignIR, emptyScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('src/screens/HomeScreen.tsx');
    expect(paths).toContain('src/components/PrimaryButton.tsx');
  });

  it('stats match actual counts', () => {
    const { stats } = gen.generate(mockDesignIR, mockScope);
    expect(stats.screenCount).toBe(1);
    expect(stats.componentCount).toBe(1);
    expect(stats.assetCount).toBe(1);
    expect(stats.fileCount).toBeGreaterThanOrEqual(3); // screen + component + tokens
  });
});
