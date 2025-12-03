/**
 * LLM Cache System
 *
 * Provides LRU caching for LLM responses to reduce API costs
 * and improve response times for repeated queries.
 */

import crypto from 'crypto';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

export interface CacheOptions {
  maxSize: number;
  defaultTtlMs: number;
  onEvict?: (key: string, value: any) => void;
}

const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  maxSize: 500,
  defaultTtlMs: 1000 * 60 * 60 * 24, // 24 hours
};

/**
 * LRU Cache implementation for LLM responses
 */
export class LLMCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: CacheOptions;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
  };

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
  }

  /**
   * Generate a cache key from input parameters
   */
  static generateKey(params: Record<string, any>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    entry.hits++;
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.options.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldEntry = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        this.stats.evictions++;
        this.options.onEvict?.(oldestKey, oldEntry?.value);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.options.defaultTtlMs,
      hits: 0,
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.size = this.cache.size;
    return cleaned;
  }
}

/**
 * Global cache instances for different use cases
 */
export const languageDetectionCache = new LLMCache<{ language: string; confidence: number }>({
  maxSize: 200,
  defaultTtlMs: 1000 * 60 * 60 * 24 * 7, // 7 days - language doesn't change
});

export const translationCache = new LLMCache<string>({
  maxSize: 1000,
  defaultTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 days
});

export const conceptExtractionCache = new LLMCache<any>({
  maxSize: 100,
  defaultTtlMs: 1000 * 60 * 60 * 24, // 24 hours
});

/**
 * Wrapper function to execute with caching
 */
export async function withCache<T>(
  cache: LLMCache<T>,
  key: string,
  fn: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get(key);
  if (cached !== undefined) {
    console.log(`[llm-cache] Cache hit for key: ${key.substring(0, 8)}...`);
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  cache.set(key, result, ttlMs);
  console.log(`[llm-cache] Cache miss, stored result for key: ${key.substring(0, 8)}...`);

  return result;
}

/**
 * Create a cached wrapper for an async function
 */
export function makeCached<TArgs extends any[], TReturn>(
  cache: LLMCache<TReturn>,
  fn: (...args: TArgs) => Promise<TReturn>,
  keyGenerator: (...args: TArgs) => string,
  ttlMs?: number
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    const key = keyGenerator(...args);
    return withCache(cache, key, () => fn(...args), ttlMs);
  };
}
