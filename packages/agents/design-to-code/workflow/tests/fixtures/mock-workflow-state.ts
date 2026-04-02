/**
 * Test fixtures — minimal WorkflowState and related objects for unit tests.
 */

import type { WorkflowState, IRValidationResult, ExecutionPlan } from '../../src/types.js';
import type { FigmaFile, DesignIR } from '@appvelocity/agent-design-to-code-core';

export const VALID_FIGMA_URL = 'https://www.figma.com/file/abc1234567890/MyApp';
export const VALID_FILE_KEY = 'abc1234567890';

export function makeBaseState(
  overrides: Partial<WorkflowState> = {}
): WorkflowState {
  return {
    figmaUrl: VALID_FIGMA_URL,
    targetFramework: 'react-native',
    options: {},
    errors: [],
    retryCount: 0,
    currentStep: '',
    logs: [],
    ...overrides,
  };
}

export const mockFigmaFile: FigmaFile = {
  name: 'MyApp',
  version: '1',
  lastModified: '2024-01-01T00:00:00Z',
  thumbnailUrl: 'https://example.com/thumb.png',
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
            id: '1:1',
            name: 'HomeScreen',
            type: 'FRAME',
            children: [],
          },
        ],
      },
    ],
  },
  components: {},
  componentSets: {},
  styles: {},
} as unknown as FigmaFile;

export const mockDesignIR: DesignIR = {
  fileKey: VALID_FILE_KEY,
  fileName: 'MyApp',
  lastModified: '2024-01-01T00:00:00Z',
  tokens: {
    colors: {},
    typography: {},
    spacing: {},
    radii: {},
    shadows: {},
    raw: [],
  },
  screens: [
    {
      id: '1:1',
      name: 'HomeScreen',
      componentName: 'HomeScreen',
      width: 375,
      height: 812,
      root: {
        id: '1:1',
        type: 'view',
        name: 'HomeScreen',
        classification: 'screen',
        layout: {
          flex: {
            direction: 'vertical',
            wrap: false,
            mainAxisAlignment: 'start',
            crossAxisAlignment: 'start',
            gap: 0,
          },
        },
        style: {},
        children: [],
      },
      elementIndex: {},
    },
  ],
  components: [],
  assets: [],
  meta: {
    generatedAt: '2024-01-01T00:00:00Z',
    figmaVersion: '1',
    schemaVersion: '1.0',
    stats: { screenCount: 1, componentCount: 0, tokenCount: 0, assetCount: 0 },
  },
} as unknown as DesignIR;

export const mockExecutionPlan: ExecutionPlan = {
  screens: ['1:1'],
  components: [],
  priority: 'screens-first',
  estimatedDuration: 180,
};

export const mockValidationResult: IRValidationResult = {
  valid: true,
  score: 90,
  issues: [],
};

export const mockFailedValidationResult: IRValidationResult = {
  valid: false,
  score: 30,
  issues: [
    {
      severity: 'error',
      category: 'structure',
      message: 'Screen has no elements',
      fixSuggestion: 'Add at least one element to the screen',
    },
  ],
};
