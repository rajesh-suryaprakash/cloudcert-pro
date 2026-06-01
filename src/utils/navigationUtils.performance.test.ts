/**
 * Performance Tests for Navigation Utilities
 * Feature: admin-detail-navigation
 * Requirements: 5.2
 *
 * Validates that navigation context encoding/decoding meets performance targets:
 * - Context encoding: < 50ms
 * - Context reconstruction (decoding): < 200ms
 * - Memory usage: < 10MB for cached navigation data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encodeNavigationContext,
  decodeNavigationContext,
  getPerformanceMetrics,
  resetPerformanceMetrics,
  cleanupExpiredContexts,
  type NavigationContext,
} from './navigationUtils';

beforeEach(() => {
  sessionStorage.clear();
  resetPerformanceMetrics();
});

afterEach(() => {
  sessionStorage.clear();
  resetPerformanceMetrics();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const hex = i.toString(16).padStart(8, '0');
    return `${hex}-bdfa-5e55-b4f7-c8ff74bf51a7`;
  });
}

function buildContext(idCount: number, withFilters = false): NavigationContext {
  const ids = generateIds(idCount);
  return {
    ids,
    currentId: ids[0],
    filters: withFilters ? { search: 'aws', vendor: 'Amazon', certId: 'cert-123' } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Context encoding speed (< 50ms target)
// ---------------------------------------------------------------------------

describe('Context encoding speed', () => {
  it('encodes a small context (10 IDs) in under 50ms', () => {
    const context = buildContext(10);
    const start = performance.now();
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('encodes a medium context (100 IDs) in under 50ms', () => {
    const context = buildContext(100);
    const start = performance.now();
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('encodes a large context (500 IDs) in under 50ms', () => {
    const context = buildContext(500);
    const start = performance.now();
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('encodes a large context with filters in under 50ms', () => {
    const context = buildContext(500, true);
    const start = performance.now();
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('records encoding time in performance metrics', () => {
    const context = buildContext(50);
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    const metrics = getPerformanceMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.encodingTime).toBeGreaterThanOrEqual(0);
    expect(metrics!.encodingTime).toBeLessThan(50);
  });

  it('correctly reports sessionStorage usage in metrics for large contexts', () => {
    const context = buildContext(200); // Will exceed 2000 char URL limit
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    const metrics = getPerformanceMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.usedSessionStorage).toBe(true);
  });

  it('correctly reports sessionStorage usage for small contexts (always uses sessionStorage)', () => {
    const context = buildContext(5); // sessionStorage is always used regardless of context size
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    const metrics = getPerformanceMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.usedSessionStorage).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Context reconstruction speed (< 200ms target)
// ---------------------------------------------------------------------------

describe('Context reconstruction speed', () => {
  it('decodes a small context (10 IDs) in under 200ms', () => {
    const context = buildContext(10);
    const params = encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    const start = performance.now();
    decodeNavigationContext(params);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });

  it('decodes a large context via sessionStorage in under 200ms', () => {
    const context = buildContext(500);
    const params = encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    // Verify it used sessionStorage
    expect(params.has('navRef')).toBe(true);

    const start = performance.now();
    decodeNavigationContext(params);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });

  it('decodes a context with filters in under 200ms', () => {
    const context = buildContext(50, true);
    const params = encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    const start = performance.now();
    decodeNavigationContext(params);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });

  it('handles 100 sequential decode operations in under 200ms total', () => {
    const context = buildContext(20);
    const params = encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      decodeNavigationContext(params);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// URL length validation
// ---------------------------------------------------------------------------

describe('URL length management', () => {
  it('keeps URL under 2000 characters for small contexts', () => {
    const context = buildContext(10);
    const baseUrl = 'http://localhost:3000/admin/question/x';
    const params = encodeNavigationContext(context, baseUrl);

    const fullUrl = `${baseUrl}?${params.toString()}`;
    expect(fullUrl.length).toBeLessThan(2000);
  });

  it('uses sessionStorage for contexts that would exceed 2000 characters', () => {
    const context = buildContext(200);
    const baseUrl = 'http://localhost:3000/admin/question/x';
    const params = encodeNavigationContext(context, baseUrl);

    // Should use navRef instead of ids
    expect(params.has('navRef')).toBe(true);
    expect(params.has('ids')).toBe(false);

    // Resulting URL should be short
    const fullUrl = `${baseUrl}?${params.toString()}`;
    expect(fullUrl.length).toBeLessThan(2000);
  });

  it('round-trips correctly for large contexts via sessionStorage', () => {
    const context = buildContext(250, true);
    const baseUrl = 'http://localhost:3000/admin/question/x';
    const params = encodeNavigationContext(context, baseUrl);
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    expect(decoded!.ids).toHaveLength(250);
    expect(decoded!.ids[0]).toBe(context.ids[0]);
    expect(decoded!.currentId).toBe(context.currentId);
    expect(decoded!.filters?.search).toBe('aws');
  });

  it('records URL length in performance metrics', () => {
    const context = buildContext(10);
    const baseUrl = 'http://localhost:3000/admin/question/x';
    encodeNavigationContext(context, baseUrl);

    const metrics = getPerformanceMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.urlLength).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Memory usage (< 10MB target)
// ---------------------------------------------------------------------------

describe('Memory usage', () => {
  it('sessionStorage entries for large contexts are under 100KB each', () => {
    const context = buildContext(500, true);
    encodeNavigationContext(context, 'http://localhost:3000/admin/question/x');

    // Check the size of the stored entry
    let totalBytes = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) ?? '';
        totalBytes += value.length * 2; // UTF-16 bytes
      }
    }

    // 500 UUIDs × ~40 chars × 2 bytes = ~40KB, well under 100KB
    expect(totalBytes).toBeLessThan(100 * 1024);
  });

  it('cleanupExpiredContexts keeps sessionStorage lean', () => {
    // Store several expired entries
    for (let i = 0; i < 10; i++) {
      sessionStorage.setItem(
        `admin-nav-context-expired-${i}`,
        JSON.stringify({
          ids: generateIds(50),
          currentId: 'id-0',
          timestamp: Date.now() - 7200000,
          expiresAt: Date.now() - 3600000,
        }),
      );
    }

    expect(sessionStorage.length).toBe(10);
    cleanupExpiredContexts();
    expect(sessionStorage.length).toBe(0);
  });

  it('multiple large contexts stay within reasonable sessionStorage bounds', () => {
    // Simulate navigating through 5 different large question sets
    for (let i = 0; i < 5; i++) {
      const context = buildContext(200);
      context.currentId = context.ids[i];
      encodeNavigationContext(context, `http://localhost:3000/admin/question/${context.currentId}`);
    }

    // Each entry is ~200 UUIDs × 40 chars × 2 bytes ≈ 16KB
    // 5 entries ≈ 80KB, well under 10MB
    let totalBytes = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) ?? '';
        totalBytes += value.length * 2;
      }
    }

    expect(totalBytes).toBeLessThan(10 * 1024 * 1024); // 10MB
  });
});
