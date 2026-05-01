import axios, { type AxiosInstance, type AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import PQueue from 'p-queue';
import { LRUCache } from 'lru-cache';
import { createLogger } from '../utils/logger.js';
import { createFigmaRedisCache, type FigmaRedisCache } from './redis-cache.js';
import type {
  FigmaFile,
  FigmaNodesResponse,
  FigmaVariablesResponse,
  FigmaImagesResponse,
  FigmaComponentsResponse,
} from './types.js';

const log = createLogger('FigmaClient');

// ─── Config ───────────────────────────────────────────────────────────────────

export interface FigmaClientConfig {
  /** Personal access token from figma.com/settings */
  accessToken: string;
  /** Max requests per minute (Figma allows ~60–100). Default: 60 */
  rateLimitPerMinute?: number;
  /** In-memory cache TTL in ms. Default: 5 minutes */
  cacheTtlMs?: number;
  /** Max items in LRU cache. Default: 100 */
  cacheMaxSize?: number;
  /** Base URL override (useful for testing). Default: https://api.figma.com */
  baseUrl?: string;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class FigmaApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = 'FigmaApiError';
  }
}

export class FigmaRateLimitError extends FigmaApiError {
  constructor(retryAfterMs: number) {
    super(`Figma API rate limit exceeded. Retry after ${retryAfterMs}ms`);
    this.name = 'FigmaRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
  public readonly retryAfterMs: number;
}

export class FigmaAuthError extends FigmaApiError {
  constructor() {
    super('Figma authentication failed. Check your FIGMA_ACCESS_TOKEN.', 403);
    this.name = 'FigmaAuthError';
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class FigmaClient {
  private readonly http: AxiosInstance;
  private readonly queue: PQueue;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly cache: LRUCache<string, any>;
  private readonly redis: FigmaRedisCache;

  constructor(config: FigmaClientConfig) {
    const {
      rateLimitPerMinute = 60,
      cacheTtlMs = 5 * 60 * 1000,
      cacheMaxSize = 100,
      baseUrl = 'https://api.figma.com',
    } = config;

    // Axios instance with auth header
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-Figma-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });

    // Retry on network errors and 5xx (not 4xx — those are client errors)
    axiosRetry(this.http, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err: AxiosError) => {
        const status = err.response?.status;
        // Don't retry auth or not-found errors
        if (status === 403 || status === 404) return false;
        // Retry on rate limit (429) or server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(err) || status === 429;
      },
      onRetry: (count: number, err: AxiosError) => {
        log.warn(`Figma API retry ${count}/3`, { error: err.message });
      },
    });

    // p-queue enforces rate limit
    // interval = 60_000ms, intervalCap = rateLimitPerMinute
    this.queue = new PQueue({
      interval: 60_000,
      intervalCap: rateLimitPerMinute,
      concurrency: 5,
    });

    // LRU cache for GET responses
    this.cache = new LRUCache<string, any>({
      max: cacheMaxSize,
      ttl: cacheTtlMs,
    });

    this.redis = createFigmaRedisCache();

    log.info('FigmaClient initialised', { rateLimitPerMinute, cacheTtlMs, redisEnabled: this.redis.isAvailable() });
  }

  // ─── Public API methods ─────────────────────────────────────────────────────

  /**
   * Fetches the full file tree including document, components, and styles.
   * Uses cache by default; pass force=true to bypass.
   */
  async getFile(fileKey: string, force = false): Promise<FigmaFile> {
    const cacheKey = `file:${fileKey}`;
    if (!force) {
      // L1: in-memory LRU
      const l1 = this.cache.get(cacheKey);
      if (l1) {
        log.debug('L1 cache hit', { key: cacheKey });
        return l1 as FigmaFile;
      }
      // L2: Redis
      const l2 = await this.redis.get<FigmaFile>(fileKey, 'file');
      if (l2) {
        log.debug('L2 Redis cache hit', { fileKey });
        this.cache.set(cacheKey, l2);
        return l2;
      }
    }

    const data = await this.get<FigmaFile>(`/v1/files/${fileKey}`);
    this.cache.set(cacheKey, data);
    await this.redis.set(fileKey, 'file', data);
    return data;
  }

  /**
   * Fetches specific nodes by ID (more efficient than the full file for large files).
   * nodeIds should be in the colon format "0:1" or comma-separated.
   */
  async getFileNodes(
    fileKey: string,
    nodeIds: string[],
    force = false
  ): Promise<FigmaNodesResponse> {
    const ids = nodeIds.join(',');
    const cacheKey = `nodes:${fileKey}:${ids}`;

    if (!force) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached as FigmaNodesResponse;
    }

    const data = await this.get<FigmaNodesResponse>(
      `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`
    );
    this.cache.set(cacheKey, data);
    return data;
  }

  /**
   * Fetches all local variables (design tokens) for the file.
   * Requires the file to use Figma Variables (paid plan).
   */
  async getLocalVariables(
    fileKey: string,
    force = false
  ): Promise<FigmaVariablesResponse> {
    const cacheKey = `vars:${fileKey}`;
    if (!force) {
      const l1 = this.cache.get(cacheKey);
      if (l1) return l1 as FigmaVariablesResponse;
      const l2 = await this.redis.get<FigmaVariablesResponse>(fileKey, 'vars');
      if (l2) {
        this.cache.set(cacheKey, l2);
        return l2;
      }
    }

    const data = await this.get<FigmaVariablesResponse>(
      `/v1/files/${fileKey}/variables/local`
    );
    this.cache.set(cacheKey, data);
    await this.redis.set(fileKey, 'vars', data);
    return data;
  }

  /**
   * Fetches component metadata for a file.
   */
  async getComponents(
    fileKey: string,
    force = false
  ): Promise<FigmaComponentsResponse> {
    const cacheKey = `components:${fileKey}`;
    if (!force) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached as FigmaComponentsResponse;
    }

    const data = await this.get<FigmaComponentsResponse>(
      `/v1/files/${fileKey}/components`
    );
    this.cache.set(cacheKey, data);
    return data;
  }

  /**
   * Requests image export URLs for specific nodes.
   * format: 'svg' | 'png' | 'jpg' | 'pdf'
   * scale: 1–4 (only for raster formats)
   */
  async getImageExports(
    fileKey: string,
    nodeIds: string[],
    options: {
      format?: 'svg' | 'png' | 'jpg' | 'pdf';
      scale?: number;
    } = {}
  ): Promise<FigmaImagesResponse> {
    const { format = 'svg', scale = 1 } = options;
    const ids = nodeIds.join(',');
    const params = new URLSearchParams({
      ids: encodeURIComponent(ids),
      format,
      ...(format !== 'svg' && format !== 'pdf' ? { scale: String(scale) } : {}),
    });

    // Image exports are never cached (URLs expire)
    return this.get<FigmaImagesResponse>(`/v1/images/${fileKey}?${params.toString()}`);
  }

  /** Returns the number of requests currently queued */
  get queueSize(): number {
    return this.queue.size;
  }

  /** Clears the response cache */
  clearCache(): void {
    this.cache.clear();
    log.debug('Cache cleared');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async get<T>(endpoint: string): Promise<T> {
    return this.queue.add(async () => {
      log.debug('GET', { endpoint });

      try {
        const response = await this.http.get<T>(endpoint);
        return response.data;
      } catch (err) {
        throw this.normaliseError(err as AxiosError, endpoint);
      }
    }) as Promise<T>;
  }

  private normaliseError(err: AxiosError, endpoint: string): FigmaApiError {
    const status = err.response?.status;

    if (status === 403) return new FigmaAuthError();

    if (status === 429) {
      const retryAfter = Number(err.response?.headers['retry-after'] ?? 60) * 1000;
      return new FigmaRateLimitError(retryAfter);
    }

    if (status === 404) {
      return new FigmaApiError(
        `Figma resource not found: ${endpoint}. ` +
          'Check that the file key is correct and you have access.',
        404,
        endpoint
      );
    }

    if (err.code === 'ECONNABORTED') {
      return new FigmaApiError(
        `Figma API request timed out: ${endpoint}`,
        undefined,
        endpoint
      );
    }

    return new FigmaApiError(
      err.message ?? 'Unknown Figma API error',
      status,
      endpoint
    );
  }
}
