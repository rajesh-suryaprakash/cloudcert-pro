/**
 * Unit tests for URL encoding/decoding edge cases in navigationUtils.
 * Requirements: 4.4, 7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encodeNavigationContext,
  decodeNavigationContext,
  cleanupExpiredContexts,
  type NavigationContext,
} from './navigationUtils';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Special characters in IDs
// ---------------------------------------------------------------------------

describe('Special characters in IDs', () => {
  it('handles IDs with spaces', () => {
    const context: NavigationContext = {
      ids: ['id with spaces', 'another id'],
      currentId: 'id with spaces',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id with spaces');
    expect(decoded!.currentId).toBe('id with spaces');
  });

  it('handles IDs with forward slashes', () => {
    const context: NavigationContext = {
      ids: ['org/repo/id', 'path/to/record'],
      currentId: 'org/repo/id',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('org/repo/id');
    expect(decoded!.currentId).toBe('org/repo/id');
  });

  it('handles IDs with ampersands', () => {
    const context: NavigationContext = {
      ids: ['id&with&ampersands', 'normal-id'],
      currentId: 'id&with&ampersands',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id&with&ampersands');
    expect(decoded!.currentId).toBe('id&with&ampersands');
  });

  it('handles IDs with equals signs', () => {
    const context: NavigationContext = {
      ids: ['id=value', 'key=pair'],
      currentId: 'id=value',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id=value');
    expect(decoded!.currentId).toBe('id=value');
  });

  it('handles IDs with hash characters', () => {
    const context: NavigationContext = {
      ids: ['id#fragment', 'another#id'],
      currentId: 'id#fragment',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id#fragment');
    expect(decoded!.currentId).toBe('id#fragment');
  });

  it('handles IDs with question marks', () => {
    const context: NavigationContext = {
      ids: ['id?query=1', 'normal-id'],
      currentId: 'id?query=1',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id?query=1');
    expect(decoded!.currentId).toBe('id?query=1');
  });

  it('handles IDs with unicode characters', () => {
    const context: NavigationContext = {
      ids: ['id-\u4e2d\u6587', 'id-\u00e9\u00e0\u00fc'],
      currentId: 'id-\u4e2d\u6587',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id-\u4e2d\u6587');
    expect(decoded!.currentId).toBe('id-\u4e2d\u6587');
  });

  it('handles IDs with percent signs', () => {
    const context: NavigationContext = {
      ids: ['id%20encoded', 'id%2Fslash'],
      currentId: 'id%20encoded',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id%20encoded');
    expect(decoded!.currentId).toBe('id%20encoded');
  });

  it('handles IDs with plus signs', () => {
    const context: NavigationContext = {
      ids: ['id+plus', 'another+id'],
      currentId: 'id+plus',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toContain('id+plus');
    expect(decoded!.currentId).toBe('id+plus');
  });

  it('handles a single ID with many special characters combined', () => {
    const complexId = 'id with spaces & slashes/and=equals?query#hash';
    const context: NavigationContext = {
      ids: [complexId, 'simple-id'],
      currentId: complexId,
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.currentId).toBe(complexId);
    expect(decoded!.ids).toContain(complexId);
  });

  it('handles filter values with special characters', () => {
    const context: NavigationContext = {
      ids: ['id-1', 'id-2'],
      currentId: 'id-1',
      filters: { search: 'AWS & GCP', vendor: 'Amazon/Google' },
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.filters?.search).toBe('AWS & GCP');
    expect(decoded!.filters?.vendor).toBe('Amazon/Google');
  });
});

// ---------------------------------------------------------------------------
// Empty contexts
// ---------------------------------------------------------------------------

describe('Empty contexts', () => {
  it('returns null when ids param is missing', () => {
    const params = new URLSearchParams({ current: 'some-id' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when current param is missing', () => {
    const params = new URLSearchParams({ ids: 'id-1,id-2' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when both ids and current are missing', () => {
    const params = new URLSearchParams();
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when ids param is an empty string', () => {
    const params = new URLSearchParams({ ids: '', current: 'some-id' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when ids param contains only commas (empty segments)', () => {
    const params = new URLSearchParams({ ids: ',,,', current: 'some-id' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('handles context with no filters (undefined filters)', () => {
    const context: NavigationContext = {
      ids: ['id-1', 'id-2'],
      currentId: 'id-1',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    const hasFilters = decoded!.filters !== undefined && Object.keys(decoded!.filters).length > 0;
    expect(hasFilters).toBe(false);
  });

  it('handles context with empty filters object', () => {
    const context: NavigationContext = {
      ids: ['id-1', 'id-2'],
      currentId: 'id-1',
      filters: {},
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    const hasFilters = decoded!.filters !== undefined && Object.keys(decoded!.filters).length > 0;
    expect(hasFilters).toBe(false);
  });

  it('handles a single-element IDs array', () => {
    const context: NavigationContext = {
      ids: ['only-id'],
      currentId: 'only-id',
    };
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toEqual(['only-id']);
    expect(decoded!.currentId).toBe('only-id');
  });
});

// ---------------------------------------------------------------------------
// Contexts stored via sessionStorage (always)
// ---------------------------------------------------------------------------

describe('Contexts stored via sessionStorage', () => {
  /**
   * Generates a context whose encoded URL will exceed 2000 characters.
   * Each ID is 30 chars; 100 IDs = ~3000 chars just for the ids param.
   */
  function buildLargeContext(): NavigationContext {
    const ids = Array.from(
      { length: 100 },
      (_, i) => `very-long-record-id-${String(i).padStart(8, '0')}`,
    );
    return { ids, currentId: ids[0] };
  }

  it('always uses navRef (sessionStorage) regardless of context size', () => {
    const context = buildLargeContext();
    const params = encodeNavigationContext(context, 'http://localhost/admin');

    // Should use navRef instead of ids directly
    expect(params.has('navRef')).toBe(true);
    expect(params.has('ids')).toBe(false);
    expect(params.get('current')).toBe(context.currentId);
  });

  it('always stores data in sessionStorage on encode', () => {
    const context = buildLargeContext();
    encodeNavigationContext(context, 'http://localhost/admin');

    // At least one key should be stored in sessionStorage
    expect(sessionStorage.length).toBeGreaterThan(0);
  });

  it('round-trips correctly via sessionStorage', () => {
    const context = buildLargeContext();
    const params = encodeNavigationContext(context, 'http://localhost/admin');
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toEqual(context.ids);
    expect(decoded!.currentId).toBe(context.currentId);
  });

  it('returns null when navRef points to missing sessionStorage entry', () => {
    const params = new URLSearchParams({
      navRef: 'admin-nav-context-nonexistent-key',
      current: 'some-id',
    });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when navRef points to expired sessionStorage entry', () => {
    // Manually store an expired entry
    const key = 'admin-nav-context-expired-test';
    const expiredEntry = {
      ids: ['id-1'],
      currentId: 'id-1',
      timestamp: Date.now() - 7200000, // 2 hours ago
      expiresAt: Date.now() - 3600000, // expired 1 hour ago
    };
    sessionStorage.setItem(key, JSON.stringify(expiredEntry));

    const params = new URLSearchParams({ navRef: key, current: 'id-1' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('cleanupExpiredContexts removes expired entries', () => {
    const expiredKey = 'admin-nav-context-expired-cleanup';
    const validKey = 'admin-nav-context-valid-cleanup';

    sessionStorage.setItem(
      expiredKey,
      JSON.stringify({
        ids: ['id-1'],
        currentId: 'id-1',
        timestamp: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000,
      }),
    );
    sessionStorage.setItem(
      validKey,
      JSON.stringify({
        ids: ['id-2'],
        currentId: 'id-2',
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      }),
    );

    cleanupExpiredContexts();

    expect(sessionStorage.getItem(expiredKey)).toBeNull();
    expect(sessionStorage.getItem(validKey)).not.toBeNull();
  });

  it('cleanupExpiredContexts removes entries with invalid JSON', () => {
    const badKey = 'admin-nav-context-bad-json';
    sessionStorage.setItem(badKey, 'not-valid-json{{{');

    cleanupExpiredContexts();

    expect(sessionStorage.getItem(badKey)).toBeNull();
  });

  it('large context with filters round-trips via sessionStorage', () => {
    const context = buildLargeContext();
    context.filters = { search: 'aws', vendor: 'Amazon' };

    const params = encodeNavigationContext(context, 'http://localhost/admin');
    expect(params.has('navRef')).toBe(true);

    const decoded = decodeNavigationContext(params);
    expect(decoded).not.toBeNull();
    expect(decoded!.filters?.search).toBe('aws');
    expect(decoded!.filters?.vendor).toBe('Amazon');
  });
});

// ---------------------------------------------------------------------------
// Malformed URL parameters
// ---------------------------------------------------------------------------

describe('Malformed URL parameters', () => {
  it('returns null for completely empty URLSearchParams', () => {
    const decoded = decodeNavigationContext(new URLSearchParams());
    expect(decoded).toBeNull();
  });

  it('returns null when ids is present but current is absent', () => {
    const params = new URLSearchParams({ ids: 'id-1,id-2,id-3' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when current is present but ids is absent', () => {
    const params = new URLSearchParams({ current: 'id-1' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('returns null when ids is empty string and current is present', () => {
    const params = new URLSearchParams({ ids: '', current: 'id-1' });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('filters out empty segments from comma-separated ids', () => {
    // "id-1,,id-3" has an empty segment in the middle
    const params = new URLSearchParams({ ids: 'id-1,,id-3', current: 'id-1' });
    const decoded = decodeNavigationContext(params);

    // Should succeed but only include non-empty IDs
    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toEqual(['id-1', 'id-3']);
    expect(decoded!.ids).not.toContain('');
  });

  it('handles ids with only one valid entry among empty segments', () => {
    const params = new URLSearchParams({ ids: ',,valid-id,,', current: 'valid-id' });
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toEqual(['valid-id']);
  });

  it('ignores unrecognized query parameters gracefully', () => {
    const params = new URLSearchParams({
      ids: 'id-1,id-2',
      current: 'id-1',
      unknownParam: 'some-value',
      anotherRandom: '123',
    });
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toEqual(['id-1', 'id-2']);
    expect(decoded!.currentId).toBe('id-1');
  });

  it('does not include non-nav prefixed params as filters', () => {
    const params = new URLSearchParams({
      ids: 'id-1,id-2',
      current: 'id-1',
      search: 'should-not-be-filter', // no 'nav' prefix
      navSearch: 'should-be-filter',
    });
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.filters?.search).toBe('should-be-filter');
    // 'search' without nav prefix should not appear in filters
    expect(decoded!.filters?.['search']).not.toBe('should-not-be-filter');
  });

  it('handles navRef with corrupted sessionStorage JSON gracefully', () => {
    const key = 'admin-nav-context-corrupted';
    sessionStorage.setItem(key, '{corrupted json:::');

    const params = new URLSearchParams({ navRef: key, current: 'id-1' });
    // Should not throw, should return null
    expect(() => decodeNavigationContext(params)).not.toThrow();
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('handles navRef pointing to non-existent key gracefully', () => {
    const params = new URLSearchParams({
      navRef: 'admin-nav-context-does-not-exist',
      current: 'id-1',
    });
    const decoded = decodeNavigationContext(params);
    expect(decoded).toBeNull();
  });

  it('does not throw when encodeNavigationContext receives an empty ids array', () => {
    const context: NavigationContext = {
      ids: [],
      currentId: 'id-1',
    };
    // Should not throw even with empty ids
    expect(() => encodeNavigationContext(context, 'http://localhost/admin')).not.toThrow();
  });

  it('handles current param being an empty string', () => {
    const params = new URLSearchParams({ ids: 'id-1,id-2', current: '' });
    const decoded = decodeNavigationContext(params);
    // current is empty string — falsy, should return null
    expect(decoded).toBeNull();
  });
});
