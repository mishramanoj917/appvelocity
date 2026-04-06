/**
 * BaseGenerator — abstract base class for all framework generators.
 *
 * Subclasses implement `generate()` and call the shared `filterByScope()`
 * helper to obtain the ordered set of screens and components to process.
 */

import type { DesignIR } from '@appvelocity/agent-design-to-code-core';
import type { GenerationScope, GeneratorOptions, GeneratorResult } from './types.js';

export abstract class BaseGenerator {
  abstract readonly framework: 'react-native' | 'flutter';

  abstract generate(
    ir: DesignIR,
    scope: GenerationScope,
    options?: GeneratorOptions
  ): GeneratorResult;

  /**
   * Returns the screens and components that match the scope, in priority order.
   * When `scope.screens` is empty the full IR screen list is used.
   * When `scope.components` is empty all components are included.
   */
  protected filterByScope(
    ir: DesignIR,
    scope: GenerationScope
  ): {
    screens: DesignIR['screens'];
    components: DesignIR['components'];
  } {
    const screenIds = new Set(scope.screens);
    const componentIds = new Set(scope.components);

    const screens =
      scope.screens.length > 0
        ? ir.screens.filter((s) => screenIds.has(s.id))
        : ir.screens;

    const components =
      scope.components.length > 0
        ? ir.components.filter((c) => componentIds.has(c.id))
        : ir.components;

    // Respect screens-first vs components-first ordering in returned object
    return { screens, components };
  }
}
