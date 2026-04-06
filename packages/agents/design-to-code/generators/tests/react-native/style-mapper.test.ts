import { describe, it, expect } from 'vitest';
import {
  irLayoutToRNStyle,
  irStyleToRNStyle,
  irCornerRadiiToRN,
  irShadowToRNElevation,
} from '../../src/react-native/style-mapper.js';
import type { IRLayout, IRStyle, IRCornerRadii, IRShadowToken } from '@appvelocity/agent-design-to-code-core';

function makeLayout(overrides: Partial<IRLayout> = {}): IRLayout {
  return {
    flex: {
      direction: 'column',
      mainAxisAlignment: 'start',
      crossAxisAlignment: 'start',
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      wrap: false,
    },
    ...overrides,
  };
}

describe('irLayoutToRNStyle', () => {
  it('maps direction=row to flexDirection:row', () => {
    const s = irLayoutToRNStyle(makeLayout({ flex: { direction: 'row', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } }));
    expect(s.flexDirection).toBe('row');
  });

  it('maps direction=none — no flexDirection key', () => {
    const s = irLayoutToRNStyle(makeLayout({ flex: { direction: 'none', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } }));
    expect(s).not.toHaveProperty('flexDirection');
  });

  it('maps mainAxisAlignment=space-between to justifyContent:space-between', () => {
    const s = irLayoutToRNStyle(makeLayout({ flex: { direction: 'column', mainAxisAlignment: 'space-between', crossAxisAlignment: 'start', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } }));
    expect(s.justifyContent).toBe('space-between');
  });

  it('maps crossAxisAlignment=stretch to alignItems:stretch', () => {
    const s = irLayoutToRNStyle(makeLayout({ flex: { direction: 'column', mainAxisAlignment: 'start', crossAxisAlignment: 'stretch', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, wrap: false } }));
    expect(s.alignItems).toBe('stretch');
  });

  it('maps position=absolute with top/left', () => {
    const s = irLayoutToRNStyle(makeLayout({ position: 'absolute', top: 10, left: 20 }));
    expect(s.position).toBe('absolute');
    expect(s.top).toBe(10);
    expect(s.left).toBe(20);
  });

  it('maps width=100% as a string', () => {
    const s = irLayoutToRNStyle(makeLayout({ width: '100%' }));
    expect(s.width).toBe('100%');
  });

  it('maps width as number', () => {
    const s = irLayoutToRNStyle(makeLayout({ width: 320 }));
    expect(s.width).toBe(320);
  });

  it('collapses uniform padding to padding shorthand', () => {
    const s = irLayoutToRNStyle(makeLayout({ flex: { direction: 'column', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 16, right: 16, bottom: 16, left: 16 }, wrap: false } }));
    expect(s.padding).toBe(16);
    expect(s).not.toHaveProperty('paddingTop');
  });

  it('maps non-uniform padding to individual props', () => {
    const s = irLayoutToRNStyle(makeLayout({ flex: { direction: 'column', mainAxisAlignment: 'start', crossAxisAlignment: 'start', gap: 0, padding: { top: 8, right: 16, bottom: 8, left: 16 }, wrap: false } }));
    expect(s.paddingTop).toBe(8);
    expect(s.paddingRight).toBe(16);
  });
});

describe('irStyleToRNStyle', () => {
  it('maps backgroundColor', () => {
    const s = irStyleToRNStyle({ backgroundColor: '#FF0000' } as IRStyle);
    expect(s.backgroundColor).toBe('#FF0000');
  });

  it('maps numeric borderRadius', () => {
    const s = irStyleToRNStyle({ borderRadius: 12 } as IRStyle);
    expect(s.borderRadius).toBe(12);
  });

  it('maps opacity', () => {
    const s = irStyleToRNStyle({ opacity: 0.5 } as IRStyle);
    expect(s.opacity).toBe(0.5);
  });

  it('maps overflow:hidden', () => {
    const s = irStyleToRNStyle({ overflow: 'hidden' } as IRStyle);
    expect(s.overflow).toBe('hidden');
  });

  it('maps IRCornerRadii to per-corner props', () => {
    const r: IRCornerRadii = { topLeft: 4, topRight: 8, bottomRight: 4, bottomLeft: 8 };
    const s = irStyleToRNStyle({ borderRadius: r } as unknown as IRStyle);
    expect(s.borderTopLeftRadius).toBe(4);
    expect(s.borderTopRightRadius).toBe(8);
  });
});

describe('irCornerRadiiToRN', () => {
  it('returns all four corner props', () => {
    const r: IRCornerRadii = { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 };
    const result = irCornerRadiiToRN(r);
    expect(result).toEqual({
      borderTopLeftRadius:     1,
      borderTopRightRadius:    2,
      borderBottomRightRadius: 3,
      borderBottomLeftRadius:  4,
    });
  });
});

describe('irShadowToRNElevation', () => {
  it('returns all five shadow props', () => {
    const shadow: IRShadowToken = { x: 0, y: 4, blur: 8, color: '#000000' };
    const result = irShadowToRNElevation(shadow);
    expect(result).toHaveProperty('shadowColor', '#000000');
    expect(result).toHaveProperty('shadowOffset');
    expect(result).toHaveProperty('shadowOpacity');
    expect(result).toHaveProperty('shadowRadius');
    expect(result).toHaveProperty('elevation');
  });
});
