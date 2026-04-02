import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { FigmaClient, FigmaApiError, FigmaAuthError } from '../../src/figma/client.js';
import { MOCK_FIGMA_FILE, MOCK_VARIABLES_RESPONSE } from '../fixtures/figma-mocks.js';

// We mock the axios instance created inside FigmaClient by intercepting at the module level
let mockAxios: MockAdapter;
let client: FigmaClient;

beforeEach(() => {
  client = new FigmaClient({
    accessToken: 'test-token-abc',
    rateLimitPerMinute: 100, // high limit so tests run fast
    cacheTtlMs: 5000,
  });
  // Access the private http instance via bracket notation for testing
  mockAxios = new MockAdapter((client as unknown as { http: typeof axios }).http);
});

afterEach(() => {
  mockAxios.restore();
  vi.clearAllMocks();
});

// ─── getFile ──────────────────────────────────────────────────────────────────

describe('FigmaClient.getFile', () => {
  it('fetches a file and returns typed data', async () => {
    mockAxios.onGet('/v1/files/test-key').reply(200, MOCK_FIGMA_FILE);

    const file = await client.getFile('test-key');

    expect(file.name).toBe('AppVelocity Design System');
    expect(file.document.type).toBe('DOCUMENT');
    expect(Object.keys(file.components)).toHaveLength(2);
  });

  it('returns cached result on second call', async () => {
    mockAxios.onGet('/v1/files/cached-key').reply(200, MOCK_FIGMA_FILE);

    await client.getFile('cached-key');
    await client.getFile('cached-key');

    // Only one real HTTP call — second was served from cache
    expect(mockAxios.history['get']?.length).toBe(1);
  });

  it('bypasses cache when force=true', async () => {
    mockAxios.onGet('/v1/files/force-key').reply(200, MOCK_FIGMA_FILE);

    await client.getFile('force-key');
    await client.getFile('force-key', true); // force refresh

    expect(mockAxios.history['get']?.length).toBe(2);
  });

  it('throws FigmaAuthError on 403', async () => {
    mockAxios.onGet('/v1/files/secure-key').reply(403, { message: 'Forbidden' });

    await expect(client.getFile('secure-key')).rejects.toThrow(FigmaAuthError);
  });

  it('throws FigmaApiError with 404 status on missing file', async () => {
    mockAxios.onGet('/v1/files/missing').reply(404, { message: 'Not found' });

    const err = await client.getFile('missing').catch((e) => e as FigmaApiError);
    expect(err).toBeInstanceOf(FigmaApiError);
    expect(err.statusCode).toBe(404);
  });
});

// ─── getLocalVariables ────────────────────────────────────────────────────────

describe('FigmaClient.getLocalVariables', () => {
  it('fetches variables and caches the response', async () => {
    mockAxios
      .onGet('/v1/files/var-file/variables/local')
      .reply(200, MOCK_VARIABLES_RESPONSE);

    const res = await client.getLocalVariables('var-file');

    expect(Object.keys(res.meta.variables)).toHaveLength(4);
    expect(res.meta.variables['var-primary']?.resolvedType).toBe('COLOR');
  });
});

// ─── getFileNodes ─────────────────────────────────────────────────────────────

describe('FigmaClient.getFileNodes', () => {
  it('constructs the correct query string', async () => {
    mockAxios.onGet(/\/v1\/files\/nf-key\/nodes/).reply(200, {
      name: 'test',
      lastModified: '',
      thumbnailUrl: '',
      nodes: {},
    });

    await client.getFileNodes('nf-key', ['0:1', '0:2']);

    const req = mockAxios.history['get']?.[0];
    expect(req?.url).toContain('0%3A1%2C0%3A2');
  });
});

// ─── getImageExports ──────────────────────────────────────────────────────────

describe('FigmaClient.getImageExports', () => {
  it('returns image URLs for requested nodes', async () => {
    const mockResp = {
      images: { 'icon:001': 'https://cdn.figma.com/img/icon.svg' },
    };
    mockAxios.onGet(/\/v1\/images\/img-file/).reply(200, mockResp);

    const res = await client.getImageExports('img-file', ['icon:001'], {
      format: 'svg',
    });

    expect(res.images['icon:001']).toContain('cdn.figma.com');
  });

  it('never caches image export responses', async () => {
    const mockResp = { images: { 'n:1': 'https://cdn.figma.com/a.png' } };
    mockAxios.onGet(/\/v1\/images\/uncached-file/).reply(200, mockResp);

    await client.getImageExports('uncached-file', ['n:1']);
    await client.getImageExports('uncached-file', ['n:1']);

    // Image exports are always live
    expect(mockAxios.history['get']?.length).toBe(2);
  });
});

// ─── Cache management ─────────────────────────────────────────────────────────

describe('FigmaClient cache', () => {
  it('clearCache forces a fresh fetch', async () => {
    mockAxios.onGet('/v1/files/clear-test').reply(200, MOCK_FIGMA_FILE);

    await client.getFile('clear-test');
    client.clearCache();
    await client.getFile('clear-test');

    expect(mockAxios.history['get']?.length).toBe(2);
  });
});
