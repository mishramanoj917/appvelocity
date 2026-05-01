/**
 * Redis L2 cache for Figma API responses.
 *
 * Key schema:  appv:figma:{fileKey}:{operation}
 * TTL:         FIGMA_REDIS_TTL_SECONDS (default 1800 = 30 min)
 *
 * Graceful degradation: if Redis is unavailable or REDIS_ENABLED !== 'true',
 * all methods are no-ops. The LRU L1 cache in FigmaClient continues to work.
 *
 * Operations cached: 'file', 'vars', 'components'
 * NOT cached: image export URLs (they expire and must always be fresh)
 */

import Redis from 'ioredis';
import { createLogger } from '../utils/logger.js';

const log = createLogger('FigmaRedisCache');

const TTL_SECONDS = parseInt(
  process.env['FIGMA_REDIS_TTL_SECONDS'] ?? '1800',
  10
);

// ─── Public interface ─────────────────────────────────────────────────────────

export interface FigmaRedisCache {
  get<T>(fileKey: string, operation: string): Promise<T | null>;
  set<T>(fileKey: string, operation: string, value: T): Promise<void>;
  invalidate(fileKey: string): Promise<void>;
  isAvailable(): boolean;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a Redis-backed cache if REDIS_ENABLED=true and REDIS_URL is set.
 * Returns a no-op implementation otherwise, so callers need no null checks.
 */
export function createFigmaRedisCache(): FigmaRedisCache {
  const enabled = process.env['REDIS_ENABLED']?.toLowerCase() === 'true';
  const url     = process.env['REDIS_URL'];

  if (!enabled || !url) {
    log.debug('Redis cache disabled (REDIS_ENABLED or REDIS_URL not set)');
    return new NoopRedisCache();
  }

  return new RedisFigmaCache(url);
}

// ─── Real implementation ──────────────────────────────────────────────────────

class RedisFigmaCache implements FigmaRedisCache {
  private readonly client: Redis;
  private connected = false;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect:       true,
      connectTimeout:    3_000,
      commandTimeout:    2_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't retry — degrade gracefully
    });

    this.client.on('connect', () => {
      this.connected = true;
      log.info('Redis connected');
    });

    this.client.on('error', (err: Error) => {
      if (this.connected) {
        log.warn('Redis error — falling back to L1 cache only', { message: err.message });
      }
      this.connected = false;
    });

    // Initiate connection but don't block
    this.client.connect().catch(() => {
      log.warn('Redis unavailable — L1 LRU cache only');
    });
  }

  isAvailable(): boolean {
    return this.connected;
  }

  async get<T>(fileKey: string, operation: string): Promise<T | null> {
    if (!this.connected) return null;
    try {
      const raw = await this.client.get(_key(fileKey, operation));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(fileKey: string, operation: string, value: T): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.set(
        _key(fileKey, operation),
        JSON.stringify(value),
        'EX',
        TTL_SECONDS
      );
    } catch {
      // Silently swallow — L1 still has the data
    }
  }

  async invalidate(fileKey: string): Promise<void> {
    if (!this.connected) return;
    try {
      const keys = await this.client.keys(`appv:figma:${fileKey}:*`);
      if (keys.length > 0) await this.client.del(...keys);
      log.debug('Redis cache invalidated', { fileKey, keyCount: keys.length });
    } catch {
      // Silently swallow
    }
  }
}

// ─── No-op fallback ───────────────────────────────────────────────────────────

class NoopRedisCache implements FigmaRedisCache {
  isAvailable(): boolean { return false; }
  async get<T>(_fileKey: string, _op: string): Promise<T | null> { return null; }
  async set<T>(_fileKey: string, _op: string, _value: T): Promise<void> {}
  async invalidate(_fileKey: string): Promise<void> {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _key(fileKey: string, operation: string): string {
  return `appv:figma:${fileKey}:${operation}`;
}
