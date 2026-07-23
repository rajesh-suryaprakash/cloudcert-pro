import { describe, it, expect } from 'vitest';
import { CacheService } from './CacheService';

describe('CacheService', () => {
  it('should store and retrieve values correctly', () => {
    const cache = new CacheService();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    const cache = new CacheService();
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should respect TTL expiration', async () => {
    const cache = new CacheService(1); // 1 second TTL
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(cache.get('key1')).toBeNull();
  });

  it('should enforce max entries via LRU eviction', () => {
    const cache = new CacheService(300, 3); // Max entries = 3
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.set('k3', 'v3');

    // Access k1 to move it to MRU (Most Recently Used)
    expect(cache.get('k1')).toBe('v1');
    expect(cache.get('k2')).toBe('v2');
    expect(cache.get('k3')).toBe('v3');

    // Adding 4th element should evict the least recently used key (which is now k1, since it was accessed first and no others were accessed since, wait, actually we accessed k1, then k2, then k3, so k1 is least recently used!)
    // Wait, let's make it explicit:
    // Order of access: k2, k3, then k1.
    cache.get('k2');
    cache.get('k3');
    cache.get('k1'); // k1 is now MRU, k2 is LRU!

    cache.set('k4', 'v4');
    expect(cache.get('k2')).toBeNull(); // evicted!
    expect(cache.get('k1')).toBe('v1'); // retained!
    expect(cache.get('k3')).toBe('v3');
    expect(cache.get('k4')).toBe('v4');

    // Updating k3 should not evict anything because it already exists
    cache.set('k3', 'v3-new');
    expect(cache.get('k3')).toBe('v3-new');
    expect(cache.getStats().size).toBe(3);
  });

  it('should invalidate matching patterns', () => {
    const cache = new CacheService();
    cache.set('user:1:profile', 'prof1');
    cache.set('user:1:settings', 'sett1');
    cache.set('user:2:profile', 'prof2');

    cache.invalidate('user:1:*');
    expect(cache.get('user:1:profile')).toBeNull();
    expect(cache.get('user:1:settings')).toBeNull();
    expect(cache.get('user:2:profile')).toBe('prof2');
  });

  it('should invalidate entries by user ID', () => {
    const cache = new CacheService();
    cache.set('dashboard:123:data', 'dash123');
    cache.set('history:123:list', 'hist123');
    cache.set('dashboard:456:data', 'dash456');

    cache.invalidateUser('123');
    expect(cache.get('dashboard:123:data')).toBeNull();
    expect(cache.get('history:123:list')).toBeNull();
    expect(cache.get('dashboard:456:data')).toBe('dash456');
  });

  it('should support clearing the entire cache', () => {
    const cache = new CacheService();
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
    expect(cache.getStats().size).toBe(0);
  });
});
