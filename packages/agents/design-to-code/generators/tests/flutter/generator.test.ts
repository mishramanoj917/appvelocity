import { describe, it, expect } from 'vitest';
import { FlutterGenerator } from '../../src/flutter/generator.js';
import { mockDesignIR, mockScope } from '../fixtures/mock-ir.js';

const gen = new FlutterGenerator();

describe('FlutterGenerator', () => {
  it('returns a CodeBundle with framework: flutter', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    expect(bundle.framework).toBe('flutter');
  });

  it('emits screen file at lib/screens/home_screen.dart', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('lib/screens/home_screen.dart');
  });

  it('screen file language is dart', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const screenFile = bundle.files.find((f) => f.path.includes('home_screen'));
    expect(screenFile?.language).toBe('dart');
  });

  it('emits component file at lib/widgets/primary_button.dart', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('lib/widgets/primary_button.dart');
  });

  it('emits app_colors.dart token file', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('lib/tokens/app_colors.dart');
  });

  it('emits app_text_styles.dart token file', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('lib/tokens/app_text_styles.dart');
  });

  it('collects assets where url is defined', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    expect(bundle.assets).toHaveLength(1);
  });

  it('dependencies includes flutter key', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope);
    expect(bundle.dependencies).toHaveProperty('flutter');
  });

  it('when options.includeTests=true, emits a _test.dart per screen', () => {
    const { bundle } = gen.generate(mockDesignIR, mockScope, { includeTests: true });
    const paths = bundle.files.map((f) => f.path);
    expect(paths.some((p) => p.endsWith('_test.dart'))).toBe(true);
  });

  it('stats: screenCount=1, componentCount=1', () => {
    const { stats } = gen.generate(mockDesignIR, mockScope);
    expect(stats.screenCount).toBe(1);
    expect(stats.componentCount).toBe(1);
  });
});
