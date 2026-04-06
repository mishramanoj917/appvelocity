/**
 * FlutterGenerator
 *
 * Orchestrates style-mapper, token-mapper, and widget-renderer to produce
 * a complete Flutter CodeBundle from a DesignIR.
 */

import type { DesignIR } from '@appvelocity/agent-design-to-code-core';
import { BaseGenerator } from '../base-generator.js';
import type { CodeBundle, CodeFile, AssetFile, GenerationScope, GeneratorOptions, GeneratorResult } from '../types.js';
import { renderScreen, renderComponent } from './widget-renderer.js';
import { buildTokenFiles } from './token-mapper.js';
import { toPascalCase } from '../utils/naming.js';

// Standard Flutter pub.dev dependencies
const FLUTTER_DEPENDENCIES: Record<string, string> = {
  flutter:           'sdk: flutter',
  cupertino_icons:   '^1.0.8',
};

export class FlutterGenerator extends BaseGenerator {
  readonly framework = 'flutter' as const;

  generate(
    ir: DesignIR,
    scope: GenerationScope,
    options: GeneratorOptions = {}
  ): GeneratorResult {
    const outDir = options.outputDir ?? 'lib';
    const { screens, components } = this.filterByScope(ir, scope);
    const warnings: string[] = [];
    const files: CodeFile[] = [];

    // ── Generate in priority order ──────────────────────────────────────────
    const generateScreens = (): void => {
      for (const screen of screens) {
        try {
          files.push(renderScreen(screen, ir.tokens, outDir, warnings));
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
          files.push(renderComponent(component, ir.tokens, outDir, warnings));
          if (options.includeTests) {
            files.push(buildStubTestFile(
              toPascalCase(component.componentName || component.name),
              'widget',
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
    files.push(...buildTokenFiles(ir.tokens, outDir));

    // ── Assets ──────────────────────────────────────────────────────────────
    const assets: AssetFile[] = ir.assets
      .filter((a) => !!a.url)
      .map((a) => ({
        path: `${outDir}/assets/${a.slug}.${a.format}`,
        url:  a.url as string,
      }));

    const bundle: CodeBundle = {
      framework: 'flutter',
      files,
      assets,
      dependencies: FLUTTER_DEPENDENCIES,
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
  kind: 'screen' | 'widget',
  outDir: string
): CodeFile {
  const dir = kind === 'screen' ? 'screens' : 'widgets';
  const content = [
    `import 'package:flutter/material.dart';`,
    `import 'package:flutter_test/flutter_test.dart';`,
    `import '../${dir}/${name.toLowerCase()}.dart';`,
    ``,
    `void main() {`,
    `  testWidgets('${name} renders without crashing', (tester) async {`,
    `    await tester.pumpWidget(`,
    `      const MaterialApp(home: ${name}()),`,
    `    );`,
    `    expect(find.byType(${name}), findsOneWidget);`,
    `  });`,
    `}`,
    ``,
  ].join('\n');

  return {
    path: `${outDir}/test/${dir}/${name.toLowerCase()}_test.dart`,
    content,
    language: 'dart',
  };
}
