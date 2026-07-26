/**
 * CacheService - In-memory TTL-based caching for dashboard metrics
 *
 * Provides caching with automatic expiration checking and pattern-based invalidation.
 * Default TTL is 300 seconds (5 minutes) for dashboard metrics.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<unknown>>;
  private readonly defaultTTL: number;
  private readonly maxEntries: number;

  constructor(defaultTTLSeconds: number = 300, maxEntries: number = 1000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds;
    this.maxEntries = maxEntries;
  }

  /**
   * Retrieve a value from cache
   * Automatically removes expired entries and updates LRU position
   * @returns The cached value or null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update LRU position by deleting and re-setting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Store a value in cache with TTL
   * Enforces LRU eviction and memory pressure checks
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Time to live in seconds (defaults to 300)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTTL;
    const expiresAt = Date.now() + ttl * 1000;

    // LRU eviction if cache size exceeds limit
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }

    // Memory pressure pruning: if heap usage exceeds 1.5 GB, prune 25% of oldest entries
    try {
      const memory = process.memoryUsage();
      if (memory.heapUsed > 1.5 * 1024 * 1024 * 1024) {
        const pruneCount = Math.floor(this.cache.size * 0.25);
        const keys = Array.from(this.cache.keys());
        for (let i = 0; i < pruneCount; i++) {
          this.cache.delete(keys[i]);
        }
      }
    } catch {
      // Fallback if process.memoryUsage is not available (e.g. browser context)
    }

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Invalidate cache entries matching a pattern
   * Supports wildcards using simple string matching
   * @param pattern Pattern to match (e.g., "dashboard:user123:*")
   */
  invalidate(pattern: string): void {
    const regex = this.patternToRegex(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all cache entries for a specific user
   * @param userId User ID to invalidate cache for
   */
  invalidateUser(userId: string): void {
    this.invalidate(`*:${userId}:*`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Convert a pattern with wildcards to a regex
   * @param pattern Pattern with * wildcards
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    const regexPattern = escaped.replace(/\*/g, '.*');
    // eslint-disable-next-line security/detect-non-literal-regexp
    return new RegExp(`^${regexPattern}$`);
  }
}

// Singleton instance for application-wide use
export const cacheService = new CacheService();
