/**
 * Figma API mock fixtures
 * Minimal but realistic data that mirrors real Figma API responses.
 */

import type {
  FigmaFile,
  FigmaNode,
  FigmaVariablesResponse,
} from '../../src/figma/types.js';

export const MOCK_COLOR_TOKEN = {
  r: 0.388,
  g: 0.400,
  b: 0.945,
  a: 1,
};

export const MOCK_FIGMA_FILE: FigmaFile = {
  name: 'AppVelocity Design System',
  lastModified: '2024-01-15T10:30:00Z',
  thumbnailUrl: 'https://example.com/thumb.png',
  version: '1234567890',
  schemaVersion: 0,
  components: {
    'comp-001': {
      key: 'abc123',
      name: 'Button/Primary/Large',
      description: 'Primary CTA button',
      componentSetId: 'set-001',
    },
    'comp-002': {
      key: 'def456',
      name: 'Card/Default',
      description: 'Content card',
    },
  },
  styles: {},
  document: {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '0:1',
        name: 'Page 1',
        type: 'CANVAS',
        children: [
          {
            id: 'screen:home',
            name: 'Home Screen',
            type: 'FRAME',
            absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
            layoutMode: 'VERTICAL',
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 16,
            paddingRight: 16,
            itemSpacing: 12,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
            children: [
              {
                id: 'text:title',
                name: 'Title',
                type: 'TEXT',
                characters: 'Welcome to AppVelocity',
                absoluteBoundingBox: { x: 16, y: 100, width: 343, height: 40 },
                fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
                style: {
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  fontSize: 28,
                  lineHeightPx: 36,
                },
              },
              {
                id: 'frame:card',
                name: 'Feature Card',
                type: 'FRAME',
                absoluteBoundingBox: { x: 16, y: 160, width: 343, height: 120 },
                layoutMode: 'HORIZONTAL',
                paddingTop: 16,
                paddingBottom: 16,
                paddingLeft: 16,
                paddingRight: 16,
                itemSpacing: 12,
                fills: [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98, a: 1 } }],
                effects: [
                  {
                    type: 'DROP_SHADOW',
                    visible: true,
                    radius: 8,
                    color: { r: 0, g: 0, b: 0, a: 0.1 },
                    offset: { x: 0, y: 2 },
                  },
                ],
                children: [],
              },
              {
                id: 'comp-instance:btn',
                name: 'Button/Primary/Large',
                type: 'INSTANCE',
                componentId: 'comp-001',
                absoluteBoundingBox: { x: 16, y: 700, width: 343, height: 48 },
                children: [],
              },
            ],
          },
          {
            id: 'comp-001',
            name: 'Button/Primary/Large',
            type: 'COMPONENT',
            absoluteBoundingBox: { x: 500, y: 0, width: 160, height: 48 },
            layoutMode: 'HORIZONTAL',
            paddingTop: 12,
            paddingBottom: 12,
            paddingLeft: 24,
            paddingRight: 24,
            itemSpacing: 8,
            fills: [{ type: 'SOLID', color: MOCK_COLOR_TOKEN }],
            children: [
              {
                id: 'text:btn-label',
                name: 'Label',
                type: 'TEXT',
                characters: 'Get Started',
                absoluteBoundingBox: { x: 524, y: 15, width: 112, height: 18 },
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
                style: {
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: 16,
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const MOCK_VARIABLES_RESPONSE: FigmaVariablesResponse = {
  meta: {
    variableCollections: {
      'col-001': {
        id: 'col-001',
        name: 'Colors',
        key: 'colors-key',
        defaultModeId: 'mode-light',
        modes: [
          { modeId: 'mode-light', name: 'Light' },
          { modeId: 'mode-dark', name: 'Dark' },
        ],
        variableIds: ['var-primary', 'var-background'],
      },
      'col-002': {
        id: 'col-002',
        name: 'Spacing',
        key: 'spacing-key',
        defaultModeId: 'mode-default',
        modes: [{ modeId: 'mode-default', name: 'Default' }],
        variableIds: ['var-spacing-sm', 'var-spacing-md'],
      },
    },
    variables: {
      'var-primary': {
        id: 'var-primary',
        name: 'Colors/Primary/500',
        key: 'primary-500-key',
        variableCollectionId: 'col-001',
        resolvedType: 'COLOR',
        valuesByMode: {
          'mode-light': MOCK_COLOR_TOKEN,
          'mode-dark': { r: 0.490, g: 0.502, b: 0.969, a: 1 },
        },
        description: 'Primary brand colour',
      },
      'var-background': {
        id: 'var-background',
        name: 'Colors/Background/Default',
        key: 'background-key',
        variableCollectionId: 'col-001',
        resolvedType: 'COLOR',
        valuesByMode: {
          'mode-light': { r: 1, g: 1, b: 1, a: 1 },
          'mode-dark': { r: 0.059, g: 0.071, b: 0.082, a: 1 },
        },
      },
      'var-spacing-sm': {
        id: 'var-spacing-sm',
        name: 'Spacing/SM',
        key: 'spacing-sm-key',
        variableCollectionId: 'col-002',
        resolvedType: 'FLOAT',
        valuesByMode: { 'mode-default': 8 },
      },
      'var-spacing-md': {
        id: 'var-spacing-md',
        name: 'Spacing/MD',
        key: 'spacing-md-key',
        variableCollectionId: 'col-002',
        resolvedType: 'FLOAT',
        valuesByMode: { 'mode-default': 16 },
      },
    },
  },
};
