/**
 * ReactNativeGenerator
 *
 * Orchestrates style-mapper, token-mapper, and component-renderer to produce
 * a complete React Native CodeBundle from a DesignIR.
 */

import type { DesignIR } from '@appvelocity/agent-design-to-code-core';
import { BaseGenerator } from '../base-generator.js';
import type { CodeBundle, CodeFile, AssetFile, GenerationScope, GeneratorOptions, GeneratorResult } from '../types.js';
import { renderScreen, renderComponent } from './component-renderer.js';
import { buildTokensFile } from './token-mapper.js';
import { toPascalCase } from '../utils/naming.js';

// Standard React Native peer dependencies
const RN_DEPENDENCIES: Record<string, string> = {
  react:             '18.x',
  'react-native':    '0.74.x',
  '@types/react':    '^18.0.0',
};

export class ReactNativeGenerator extends BaseGenerator {
  readonly framework = 'react-native' as const;

  generate(
    ir: DesignIR,
    scope: GenerationScope,
    options: GeneratorOptions = {}
  ): GeneratorResult {
    const outDir = options.outputDir ?? 'src';
    const { screens, components } = this.filterByScope(ir, scope);
    const warnings: string[] = [];
    const files: CodeFile[] = [];

    // ── Generate in priority order ──────────────────────────────────────────
    const generateScreens = (): void => {
      for (const screen of screens) {
        try {
          files.push(renderScreen(screen, ir.tokens, outDir));
          if (options.includeTests) {
            files.push(buildStubTestFile(
              toPascalCase(screen.componentName || screen.name),
              'screen',
              outDir
            ));
          }
        } catch (err) {
          warnings.push(`Screen '${screen.name}': ${String(err)}`);
        }
      }
    };

    const generateComponents = (): void => {
      for (const component of components) {
        try {
          files.push(renderComponent(component, ir.tokens, outDir));
          if (options.includeTests) {
            files.push(buildStubTestFile(
              toPascalCase(component.componentName || component.name),
              'component',
              outDir
            ));
          }
        } catch (err) {
          warnings.push(`Component '${component.name}': ${String(err)}`);
        }
      }
    };

    if (scope.priority === 'screens-first') {
      generateScreens();
      generateComponents();
    } else {
      generateComponents();
      generateScreens();
    }

    // ── Design tokens ───────────────────────────────────────────────────────
    files.push(buildTokensFile(ir.tokens, outDir));

    // ── Assets ──────────────────────────────────────────────────────────────
    const assets: AssetFile[] = ir.assets
      .filter((a) => !!a.url)
      .map((a) => ({
        path: `${outDir}/assets/${a.slug}.${a.format}`,
        url:  a.url as string,
      }));

    const bundle: CodeBundle = {
      framework: 'react-native',
      files,
      assets,
      dependencies: RN_DEPENDENCIES,
    };

    return {
      bundle,
      warnings,
      stats: {
        screenCount:    screens.length,
        componentCount: components.length,
        assetCount:     assets.length,
        fileCount:      files.length,
      },
    };
  }
}

// ─── Stub test file ───────────────────────────────────────────────────────────

function buildStubTestFile(
  name: string,
  kind: 'screen' | 'component',
  outDir: string
): CodeFile {
  const dir = kind === 'screen' ? 'screens' : 'components';
  const importPath = `./${name}`;
  const content = [
    `import React from 'react';`,
    `import { render } from '@testing-library/react-native';`,
    `import { ${name} } from '${importPath}';`,
    ``,
    `describe('${name}', () => {`,
    `  it('renders without crashing', () => {`,
    `    const { toJSON } = render(<${name} />);`,
    `    expect(toJSON()).toBeTruthy();`,
    `  });`,
    `});`,
    ``,
  ].join('\n');

  return {
    path: `${outDir}/${dir}/${name}.test.tsx`,
    content,
    language: 'typescript',
  };
}
