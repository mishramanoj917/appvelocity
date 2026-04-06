/**
 * Shared test fixtures for generator tests.
 */

import type { DesignIR, IRScreen, IRComponent, IRElement } from '@appvelocity/agent-design-to-code-core';
import type { GenerationScope } from '../../src/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeView(id: string, name: string, children: IRElement[] = []): IRElement {
  return {
    id,
    type: 'view',
    name,
    classification: 'molecule',
    layout: {
      flex: {
        direction: 'column',
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
        gap: 8,
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        wrap: false,
      },
    },
    style: { backgroundColor: '#FFFFFF', borderRadius: 8 },
    children,
  };
}

function makeText(id: string, value: string): IRElement {
  return {
    id,
    type: 'text',
    name: `Text_${id}`,
    classification: 'atom',
    layout: {
      flex: {
        direction: 'none',
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        wrap: false,
      },
    },
    style: {},
    text: {
      value,
      style: {
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 24,
        color: '#111827',
        path: 'typography.body',
      },
    },
    children: [],
  };
}

function makeTouchable(id: string, children: IRElement[] = []): IRElement {
  return {
    id,
    type: 'touchable',
    name: `Touchable_${id}`,
    classification: 'atom',
    layout: {
      flex: {
        direction: 'row',
        mainAxisAlignment: 'center',
        crossAxisAlignment: 'center',
        gap: 0,
        padding: { top: 12, right: 24, bottom: 12, left: 24 },
        wrap: false,
      },
    },
    style: { backgroundColor: '#6366F1', borderRadius: 8 },
    children,
  };
}

// ─── Root element tree ────────────────────────────────────────────────────────

const titleText  = makeText('el:title',  'Welcome to AppVelocity');
const bodyText   = makeText('el:body',   'AI-powered mobile development');
const btnLabel   = makeText('el:btnlbl', 'Get Started');
const button     = makeTouchable('el:btn', [btnLabel]);
const rootView   = makeView('el:root', 'HomeRoot', [titleText, bodyText, button]);

// ─── Screens ──────────────────────────────────────────────────────────────────

export const mockScreen: IRScreen = {
  id: '1:1',
  name: 'HomeScreen',
  componentName: 'HomeScreen',
  width: 375,
  height: 812,
  root: rootView,
  elementIndex: {
    'el:root':   rootView,
    'el:title':  titleText,
    'el:body':   bodyText,
    'el:btn':    button,
    'el:btnlbl': btnLabel,
  },
};

// ─── Components ───────────────────────────────────────────────────────────────

const componentRoot = makeTouchable('comp:root', [makeText('comp:label', 'Click me')]);

export const mockComponent: IRComponent = {
  id: 'comp:1',
  name: 'PrimaryButton',
  componentName: 'PrimaryButton',
  atomicLevel: 'atom',
  variants: [
    {
      properties: { state: 'default' },
      root: componentRoot,
    },
  ],
  defaultVariant: componentRoot,
};

// ─── Tokens ───────────────────────────────────────────────────────────────────

export const mockDesignIR: DesignIR = {
  fileKey: 'abc1234567890',
  fileName: 'MyApp',
  lastModified: '2024-01-01T00:00:00Z',
  tokens: {
    colors: {
      'primary_500': { hex: '#6366F1', rgba: { r: 0.39, g: 0.40, b: 0.95, a: 1 }, path: 'colors.primary.500', isAlias: false },
      'neutral_900': { hex: '#111827', rgba: { r: 0.07, g: 0.09, b: 0.15, a: 1 }, path: 'colors.neutral.900', isAlias: false },
    },
    typography: {
      'body_md': {
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 24,
        letterSpacing: 0,
        path: 'typography.body.md',
      },
    },
    spacing: {
      'sm': 8,
      'md': 16,
      'lg': 24,
    },
    radii: {
      'sm': 4,
      'md': 8,
    },
    shadows: {},
    raw: [],
  },
  screens: [mockScreen],
  components: [mockComponent],
  assets: [
    { id: 'asset:1', nodeId: '2:1', name: 'Hero Image', slug: 'img_hero', format: 'png', url: 'https://cdn.figma.com/img/hero.png' },
    { id: 'asset:2', nodeId: '2:2', name: 'Icon No URL', slug: 'ic_arrow', format: 'svg' }, // no url — should be excluded
  ],
  meta: {
    generatedAt: '2024-01-01T00:00:00Z',
    figmaVersion: '1',
    schemaVersion: '1.0',
    stats: { screenCount: 1, componentCount: 1, tokenCount: 4, assetCount: 2 },
  },
} as unknown as DesignIR;

export const mockScope: GenerationScope = {
  screens:    ['1:1'],
  components: ['comp:1'],
  priority:   'screens-first',
};

export const emptyScope: GenerationScope = {
  screens:    [],
  components: [],
  priority:   'screens-first',
};
