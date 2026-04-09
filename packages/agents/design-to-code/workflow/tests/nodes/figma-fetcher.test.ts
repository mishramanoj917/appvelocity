import { describe, it, expect, vi, beforeEach } from 'vitest';
import { figmaFetcherAgent } from '../../src/nodes/figma-fetcher.js';
import { makeBaseState } from '../fixtures/mock-workflow-state.js';

// Inline mock data to avoid hoisting issues with vi.mock
const MOCK_FILE = {
  name: 'MyApp',
  version: '1',
  lastModified: '2024-01-01T00:00:00Z',
  thumbnailUrl: '',
  document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [{ id: '0:1', name: 'Page 1', type: 'CANVAS', children: [] }] },
  components: {},
  componentSets: {},
  styles: {},
};

const MOCK_VARS = {
  status: 200,
  error: false,
  meta: { variables: { tok1: {}, tok2: {} }, variableCollections: {} },
};

vi.mock('@appvelocity/agent-design-to-code-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@appvelocity/agent-design-to-code-core')>();
  return {
    ...actual,
    FigmaClient: vi.fn(() => ({
      getFile: vi.fn().mockResolvedValue(MOCK_FILE),
      getLocalVariables: vi.fn().mockResolvedValue(MOCK_VARS),
    })),
  };
});

describe('figmaFetcherAgent', () => {
  beforeEach(() => {
    process.env.FIGMA_ACCESS_TOKEN = 'test-token';
  });

  it('stores the fetched FigmaFile in state', async () => {
    const result = await figmaFetcherAgent(makeBaseState());

    expect(result.figmaFile).toBeDefined();
    expect((result.figmaFile as unknown as typeof MOCK_FILE).name).toBe('MyApp');
  });

  it('stores variablesResponse when available', async () => {
    const result = await figmaFetcherAgent(makeBaseState());

    expect(result.variablesResponse).toBeDefined();
  });

  it('sets currentStep to FigmaFetcherAgent', async () => {
    const result = await figmaFetcherAgent(makeBaseState());

    expect(result.currentStep).toBe('FigmaFetcherAgent');
  });

  it('emits a success log for file fetch and info log for tokens', async () => {
    const result = await figmaFetcherAgent(makeBaseState());

    const levels = result.logs!.map((l) => l.level);
    expect(levels).toContain('success');
    expect(levels).toContain('info');
  });

  it('still succeeds when getLocalVariables rejects (variables are optional)', async () => {
    const { FigmaClient } = await import('@appvelocity/agent-design-to-code-core');
    vi.mocked(FigmaClient).mockImplementationOnce(
      () =>
        ({
          getFile: vi.fn().mockResolvedValue(MOCK_FILE),
          getLocalVariables: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
        }) as never
    );

    const result = await figmaFetcherAgent(makeBaseState());

    expect(result.figmaFile).toBeDefined();
    expect(result.variablesResponse).toBeUndefined();
  });
});
