import { describe, it, expect } from 'vitest';
import { renderScreen, renderComponent, renderElement } from '../../src/react-native/component-renderer.js';
import { mockDesignIR, mockScreen, mockComponent } from '../fixtures/mock-ir.js';
import type { IRElement } from '@appvelocity/agent-design-to-code-core';

const tokens = mockDesignIR.tokens;

describe('renderElement', () => {
  it('renders type=view as <View>', () => {
    const el: IRElement = {
      id: 'x1', type: 'view', name: 'Container', classification: 'molecule',
      layout: { flex: { direction: 'column', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<View');
  });

  it('renders type=text as <Text>', () => {
    const el: IRElement = {
      id: 'x2', type: 'text', name: 'Title', classification: 'atom',
      layout: { flex: { direction: 'none', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, text: { value: 'Hello', style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 600, path: 'typo.body' } },
      children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<Text');
    expect(result).toContain('Hello');
  });

  it('renders type=image as <Image>', () => {
    const el: IRElement = {
      id: 'x3', type: 'image', name: 'Hero', classification: 'image',
      layout: { flex: { direction: 'none', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, image: { src: 'https://example.com/img.png', nodeId: '1:2', format: 'png' },
      children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<Image');
    expect(result).toContain('https://example.com/img.png');
  });

  it('renders type=touchable as <TouchableOpacity>', () => {
    const el: IRElement = {
      id: 'x4', type: 'touchable', name: 'Btn', classification: 'atom',
      layout: { flex: { direction: 'row', mainAxisAlignment: 'center', crossAxisAlignment: 'center', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<TouchableOpacity');
  });

  it('renders type=scrollview as <ScrollView>', () => {
    const el: IRElement = {
      id: 'x5', type: 'scrollview', name: 'Scroll', classification: 'organism',
      layout: { flex: { direction: 'column', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<ScrollView');
  });

  it('renders type=input as <TextInput>', () => {
    const el: IRElement = {
      id: 'x6', type: 'input', name: 'EmailField', classification: 'atom',
      layout: { flex: { direction: 'none', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<TextInput');
  });

  it('renders type=component-instance using componentRef', () => {
    const el: IRElement = {
      id: 'x7', type: 'component-instance', name: 'ButtonInst', classification: 'atom',
      componentRef: 'PrimaryButton',
      layout: { flex: { direction: 'none', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, children: [],
    };
    const result = renderElement(el, tokens, 1);
    expect(result).toContain('<PrimaryButton');
  });

  it('collects a warning for unknown element types', () => {
    const warnings: string[] = [];
    const el = {
      id: 'x8', type: 'unknown-future-type' as 'view', name: 'Weird', classification: 'atom',
      layout: { flex: { direction: 'none', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } },
      style: {}, children: [],
    } as unknown as IRElement;
    renderElement(el, tokens, 1, warnings);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('renderScreen', () => {
  it('returns path src/screens/{name}.tsx with typescript language', () => {
    const file = renderScreen(mockScreen, tokens);
    expect(file.path).toBe('src/screens/HomeScreen.tsx');
    expect(file.language).toBe('typescript');
  });

  it('content includes React import', () => {
    const { content } = renderScreen(mockScreen, tokens);
    expect(content).toContain("import React from 'react'");
  });

  it('content includes StyleSheet.create', () => {
    const { content } = renderScreen(mockScreen, tokens);
    expect(content).toContain('StyleSheet.create');
  });

  it('respects custom outputDir', () => {
    const file = renderScreen(mockScreen, tokens, 'app');
    expect(file.path).toBe('app/screens/HomeScreen.tsx');
  });
});

describe('renderComponent', () => {
  it('returns path src/components/{name}.tsx', () => {
    const file = renderComponent(mockComponent, tokens);
    expect(file.path).toBe('src/components/PrimaryButton.tsx');
    expect(file.language).toBe('typescript');
  });
});
