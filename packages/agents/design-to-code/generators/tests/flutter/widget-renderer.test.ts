import { describe, it, expect } from 'vitest';
import { renderScreen, renderComponent, renderElement } from '../../src/flutter/widget-renderer.js';
import { mockDesignIR, mockScreen, mockComponent } from '../fixtures/mock-ir.js';
import type { IRElement } from '@appvelocity/agent-design-to-code-core';

const tokens = mockDesignIR.tokens;

function makeEl(type: IRElement['type'], name: string, extras: Partial<IRElement> = {}): IRElement {
  return {
    id: `el_${name}`,
    type,
    name,
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
    children: [],
    ...extras,
  };
}

describe('renderElement (Flutter)', () => {
  it('type=text emits Text widget', () => {
    const el = makeEl('text', 'Title', {
      text: { value: 'Hello Flutter', style: { fontFamily: 'Roboto', fontSize: 18, fontWeight: 700, path: 'typo.h1' } },
    });
    const result = renderElement(el, 1);
    expect(result).toContain("Text(");
    expect(result).toContain("'Hello Flutter'");
  });

  it('type=touchable emits GestureDetector', () => {
    const el = makeEl('touchable', 'Btn');
    const result = renderElement(el, 1);
    expect(result).toContain('GestureDetector');
    expect(result).toContain('onTap');
  });

  it('type=scrollview emits SingleChildScrollView', () => {
    const el = makeEl('scrollview', 'ScrollEl');
    const result = renderElement(el, 1);
    expect(result).toContain('SingleChildScrollView');
  });

  it('type=flatlist emits ListView.builder', () => {
    const el = makeEl('flatlist', 'List');
    const result = renderElement(el, 1);
    expect(result).toContain('ListView.builder');
  });

  it('type=input emits TextField', () => {
    const el = makeEl('input', 'EmailField');
    const result = renderElement(el, 1);
    expect(result).toContain('TextField');
  });

  it('type=view with direction=row emits Row', () => {
    const el = makeEl('view', 'RowContainer', {
      layout: {
        flex: {
          direction: 'row',
          mainAxisAlignment: 'start',
          crossAxisAlignment: 'start',
          gap: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          wrap: false,
        },
      },
    });
    const result = renderElement(el, 1);
    expect(result).toContain('Row(');
  });

  it('type=view with direction=column emits Column', () => {
    const el = makeEl('view', 'ColContainer', {
      layout: {
        flex: {
          direction: 'column',
          mainAxisAlignment: 'start',
          crossAxisAlignment: 'start',
          gap: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          wrap: false,
        },
      },
    });
    const result = renderElement(el, 1);
    expect(result).toContain('Column(');
  });

  it('collects warning for unsupported element type', () => {
    const warnings: string[] = [];
    const el = makeEl('unknown-future' as 'view', 'Weird');
    renderElement(el, 1, warnings);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('renderScreen (Flutter)', () => {
  it('returns path lib/screens/home_screen.dart', () => {
    const file = renderScreen(mockScreen, tokens);
    expect(file.path).toBe('lib/screens/home_screen.dart');
  });

  it('content includes class HomeScreen extends StatelessWidget', () => {
    const { content } = renderScreen(mockScreen, tokens);
    expect(content).toContain('class HomeScreen extends StatelessWidget');
  });

  it('content includes Widget build(BuildContext context)', () => {
    const { content } = renderScreen(mockScreen, tokens);
    expect(content).toContain('Widget build(BuildContext context)');
  });

  it('language is dart', () => {
    const file = renderScreen(mockScreen, tokens);
    expect(file.language).toBe('dart');
  });
});

describe('renderComponent (Flutter)', () => {
  it('returns path lib/widgets/primary_button.dart', () => {
    const file = renderComponent(mockComponent, tokens);
    expect(file.path).toBe('lib/widgets/primary_button.dart');
  });

  it('content includes class PrimaryButton', () => {
    const { content } = renderComponent(mockComponent, tokens);
    expect(content).toContain('class PrimaryButton');
  });
});
