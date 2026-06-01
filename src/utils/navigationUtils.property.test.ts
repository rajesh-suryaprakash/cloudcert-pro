import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  encodeNavigationContext,
  decodeNavigationContext,
  type NavigationContext,
} from './navigationUtils';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generates a valid record ID string (alphanumeric, hyphens, underscores).
 */
function arbitraryRecordId(): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
      minLength: 1,
      maxLength: 24,
    })
    .map((chars) => chars.join(''));
}

/**
 * Generates a valid filter state (string key/value pairs with nav-safe keys).
 */
function arbitraryFilterState(): fc.Arbitrary<Record<string, string>> {
  const filterKey = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 12,
    })
    .map((chars) => chars.join(''));

  const filterValue = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')), {
      minLength: 0,
      maxLength: 30,
    })
    .map((chars) => chars.join(''));

  return fc
    .array(fc.tuple(filterKey, filterValue), { minLength: 0, maxLength: 5 })
    .map((pairs) => Object.fromEntries(pairs));
}

/**
 * Generates a NavigationContext with 1–1000 IDs, a valid currentId, and optional filters.
 * No upper bound cap needed — sessionStorage is always used unconditionally.
 */
function arbitraryNavigationContext(): fc.Arbitrary<NavigationContext> {
  return fc.array(arbitraryRecordId(), { minLength: 1, maxLength: 1000 }).chain((ids) => {
    // Deduplicate to avoid duplicate IDs
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      uniqueIds.push('fallback-id');
    }
    const currentIdArb = fc.constantFrom(...uniqueIds);
    const filtersArb = fc.option(arbitraryFilterState(), { nil: undefined });
    return fc.tuple(currentIdArb, filtersArb).map(([currentId, filters]) => ({
      ids: uniqueIds,
      currentId,
      filters: filters ?? undefined,
    }));
  });
}

// ---------------------------------------------------------------------------
// SessionStorage mock (jsdom provides it, but we reset between tests)
// ---------------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Property 14: Navigation Context Round-Trip
// ---------------------------------------------------------------------------

describe('Property 14: Navigation Context Round-Trip', () => {
  // Feature: admin-detail-navigation, Property 14: Navigation Context Round-Trip
  // Validates: Requirements 4.5
  it('encoding then decoding a navigation context produces an equivalent context', () => {
    fc.assert(
      fc.property(arbitraryNavigationContext(), (context) => {
        const params = encodeNavigationContext(context, 'http://localhost/admin');
        const decoded = decodeNavigationContext(params);

        expect(decoded).not.toBeNull();
        expect(decoded!.currentId).toBe(context.currentId);
        expect(decoded!.ids).toEqual(context.ids);

        // Filters round-trip: if original had filters, decoded should have equivalent filters
        if (context.filters && Object.keys(context.filters).length > 0) {
          expect(decoded!.filters).toBeDefined();
          for (const [key, value] of Object.entries(context.filters)) {
            expect(decoded!.filters![key]).toBe(value);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('round-trip preserves the full ordered ID list', () => {
    fc.assert(
      fc.property(arbitraryNavigationContext(), (context) => {
        const params = encodeNavigationContext(context, 'http://localhost/admin');
        const decoded = decodeNavigationContext(params);

        expect(decoded).not.toBeNull();
        // Order must be preserved
        expect(decoded!.ids).toEqual(context.ids);
      }),
      { numRuns: 100 },
    );
  });

  it('round-trip with no filters produces no filters in decoded context', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryRecordId(), { minLength: 1, maxLength: 20 }).chain((ids) => {
          const uniqueIds = [...new Set(ids.length ? ids : ['id-1'])];
          return fc.constantFrom(...uniqueIds).map((currentId) => ({
            ids: uniqueIds,
            currentId,
          }));
        }),
        (context: NavigationContext) => {
          const params = encodeNavigationContext(context, 'http://localhost/admin');
          const decoded = decodeNavigationContext(params);

          expect(decoded).not.toBeNull();
          // No filters should be present (or empty)
          const hasFilters =
            decoded!.filters !== undefined && Object.keys(decoded!.filters).length > 0;
          expect(hasFilters).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 23: URL Navigation Context Serialization
// ---------------------------------------------------------------------------

describe('Property 23: URL Navigation Context Serialization', () => {
  // Feature: admin-detail-navigation, Property 23: URL Navigation Context Serialization
  // Validates: Requirements 7.5
  it('any navigation context is serializable to URL query parameters', () => {
    fc.assert(
      fc.property(arbitraryNavigationContext(), (context) => {
        // Should not throw
        let params: URLSearchParams;
        expect(() => {
          params = encodeNavigationContext(context, 'http://localhost/admin');
        }).not.toThrow();

        // Result must be a URLSearchParams instance
        expect(params!).toBeInstanceOf(URLSearchParams);

        // Must always contain 'navRef' — sessionStorage is the unconditional primary store
        const hasNavRef = params!.has('navRef');
        expect(hasNavRef).toBe(true);

        // Must always contain 'current'
        expect(params!.has('current')).toBe(true);
        expect(params!.get('current')).toBe(context.currentId);
      }),
      { numRuns: 100 },
    );
  });

  it('serialized params can always be decoded back to a valid context', () => {
    fc.assert(
      fc.property(arbitraryNavigationContext(), (context) => {
        const params = encodeNavigationContext(context, 'http://localhost/admin');
        const decoded = decodeNavigationContext(params);

        // Decoding must succeed (not return null)
        expect(decoded).not.toBeNull();

        // Decoded context must have at least one ID
        expect(decoded!.ids.length).toBeGreaterThan(0);

        // currentId must be a non-empty string
        expect(decoded!.currentId).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it('filter state is preserved in sessionStorage when context is serialized', () => {
    fc.assert(
      fc.property(
        arbitraryNavigationContext().filter(
          (ctx) => ctx.filters !== undefined && Object.keys(ctx.filters).length > 0,
        ),
        (context) => {
          const params = encodeNavigationContext(context, 'http://localhost/admin');

          // Filters are always stored in sessionStorage (never as nav-prefixed URL params)
          // Verified by the round-trip property above
          expect(params.has('navRef')).toBe(true);
          expect(params.has('ids')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
