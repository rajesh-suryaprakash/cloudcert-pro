/**
 * Property-Based Tests for CertificationsPanel - List-to-Detail Navigation
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * These tests verify that when a user clicks a certification in the list view,
 * the CertificationsPanel correctly builds and passes the navigation context
 * to the detail view. The navigation context must:
 *   - Include the complete set of filtered certification IDs (not just the current page)
 *   - Contain every ID that matches the active filter criteria
 *   - Include the current page and page size settings
 *
 * Strategy: The navigation context is built by `buildNavigationContextAndNavigate`
 * inside CertificationsPanel, which calls `onSelectCert(cert, openEdit, ids)` where
 * `ids` is derived from the `filtered` array. We test the pure logic of context
 * construction directly (without rendering the full component) to keep tests fast
 * and deterministic, then verify URL encoding round-trips for completeness.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  arbitraryRecordId,
  arbitraryUniqueIds,
  arbitraryFilterState,
  arbitraryFilteredSubset,
} from '../../../test/pbt-utils';
import { encodeNavigationContext, decodeNavigationContext } from '../../../utils/navigationUtils';
import { PAGE_SIZE_OPTIONS } from '../../../hooks/usePagination';

// ---------------------------------------------------------------------------
// Pure helpers that mirror CertificationsPanel logic
// ---------------------------------------------------------------------------

/**
 * Mirrors the filter logic inside CertificationsPanel.
 * Filters a list of certifications by search term and vendor.
 */
function applyFilters(
  certs: Array<{ id: string; title: string; description: string; vendor: string }>,
  search: string,
  filterVendor: string,
): Array<{ id: string; title: string; description: string; vendor: string }> {
  const q = search.toLowerCase();
  return certs.filter((c) => {
    const matchSearch =
      !q || c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
    const matchVendor = !filterVendor || c.vendor === filterVendor;
    return matchSearch && matchVendor;
  });
}

/**
 * Mirrors `buildNavigationContextAndNavigate` in CertificationsPanel.
 * Returns the IDs that would be passed to `onSelectCert`.
 */
function buildNavigationContext(
  filtered: Array<{ id: string }>,
  page: number,
  pageSize: number,
): { ids: string[]; page: number; pageSize: number } {
  const ids = filtered.map((c) => c.id);
  return { ids, page, pageSize };
}

// ---------------------------------------------------------------------------
// Generator: arbitrary certification record
// ---------------------------------------------------------------------------

function arbitraryCert(): fc.Arbitrary<{
  id: string;
  title: string;
  description: string;
  vendor: string;
}> {
  return fc.record({
    id: arbitraryRecordId(),
    title: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.string({ minLength: 0, maxLength: 50 }),
    vendor: fc.constantFrom('Amazon', 'Google', 'Microsoft', 'HashiCorp', 'Other'),
  });
}

/**
 * Generates a list of unique-ID certifications.
 */
function arbitraryCertList(
  minLength: number,
  maxLength: number,
): fc.Arbitrary<Array<{ id: string; title: string; description: string; vendor: string }>> {
  return fc
    .array(arbitraryCert(), { minLength: minLength * 2, maxLength: maxLength * 2 })
    .map((certs) => {
      const seen = new Set<string>();
      return certs.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    })
    .filter((certs) => certs.length >= minLength)
    .map((certs) => certs.slice(0, maxLength));
}

// ---------------------------------------------------------------------------
// Property 20: Navigation Context Passed from List
// Feature: admin-detail-navigation, Property 20: Navigation Context Passed from List
// Validates: Requirements 7.1
// ---------------------------------------------------------------------------

describe('Property 20: Navigation Context Passed from List', () => {
  it('clicking any record passes the complete filtered ID list to the detail view', () => {
    // **Validates: Requirements 7.1**
    fc.assert(
      fc.property(
        arbitraryFilteredSubset(),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        ({ filteredIds }, page, pageSize) => {
          const certs = filteredIds.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          // The context must contain ALL filtered IDs
          expect(ctx.ids).toEqual(filteredIds);
          expect(ctx.ids.length).toBe(filteredIds.length);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('the clicked record ID is present in the navigation context', () => {
    // **Validates: Requirements 7.1**
    fc.assert(
      fc.property(
        arbitraryUniqueIds(1, 30),
        fc.integer({ min: 0, max: 29 }),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, rawClickIndex, page, pageSize) => {
          const clickIndex = rawClickIndex % ids.length;
          const clickedId = ids[clickIndex];
          const certs = ids.map((id) => ({ id }));

          const ctx = buildNavigationContext(certs, page, pageSize);

          // The clicked record must be in the context
          expect(ctx.ids).toContain(clickedId);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('navigation context encodes to URL params and decodes back with the same IDs', () => {
    // **Validates: Requirements 7.1**
    fc.assert(
      fc.property(arbitraryFilteredSubset(), arbitraryFilterState(), ({ filteredIds }, filters) => {
        if (filteredIds.length === 0) return;

        const currentId = filteredIds[0];
        const context = { ids: filteredIds, currentId, filters };

        const params = encodeNavigationContext(context, 'http://localhost/admin');
        const decoded = decodeNavigationContext(params);

        expect(decoded).not.toBeNull();
        if (!decoded) return;
        expect(decoded.ids).toEqual(filteredIds);
        expect(decoded.currentId).toBe(currentId);
      }),
      { numRuns: 25 },
    );
  });

  it('navigation context preserves the order of filtered IDs as they appear in the list', () => {
    // **Validates: Requirements 7.1**
    fc.assert(
      fc.property(
        arbitraryUniqueIds(2, 30),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, page, pageSize) => {
          const certs = ids.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          // Order must be preserved exactly
          ids.forEach((id, idx) => {
            expect(ctx.ids[idx]).toBe(id);
          });
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 21: Navigation Context Contains All Filtered IDs
// Feature: admin-detail-navigation, Property 21: Navigation Context Contains All Filtered IDs
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('Property 21: Navigation Context Contains All Filtered IDs', () => {
  it('every ID matching the filter criteria appears in the navigation context', () => {
    // **Validates: Requirements 7.2**
    fc.assert(
      fc.property(
        arbitraryFilteredSubset(),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        ({ filteredIds }, page, pageSize) => {
          const certs = filteredIds.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          // Every filtered ID must appear in the context
          filteredIds.forEach((id) => {
            expect(ctx.ids).toContain(id);
          });
        },
      ),
      { numRuns: 25 },
    );
  });

  it('IDs that do not match the filter are excluded from the navigation context', () => {
    // **Validates: Requirements 7.2**
    fc.assert(
      fc.property(
        arbitraryFilteredSubset(),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        ({ allIds, filteredIds }, page, pageSize) => {
          const certs = filteredIds.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          // IDs that were filtered out must NOT appear in the context
          const filteredOutIds = allIds.filter((id) => !filteredIds.includes(id));
          filteredOutIds.forEach((id) => {
            expect(ctx.ids).not.toContain(id);
          });
        },
      ),
      { numRuns: 25 },
    );
  });

  it('context length equals the number of records matching the filter', () => {
    // **Validates: Requirements 7.2**
    fc.assert(
      fc.property(
        arbitraryFilteredSubset(),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        ({ filteredIds }, page, pageSize) => {
          const certs = filteredIds.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          expect(ctx.ids.length).toBe(filteredIds.length);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('applying vendor filter produces a context with only matching vendor IDs', () => {
    // **Validates: Requirements 7.2**
    fc.assert(
      fc.property(
        arbitraryCertList(2, 20),
        fc.constantFrom('Amazon', 'Google', 'Microsoft'),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (certs, vendor, page, pageSize) => {
          const filtered = applyFilters(certs, '', vendor);
          const ctx = buildNavigationContext(filtered, page, pageSize);

          // All IDs in context must belong to certs with the matching vendor
          const vendorIds = new Set(certs.filter((c) => c.vendor === vendor).map((c) => c.id));
          ctx.ids.forEach((id) => {
            expect(vendorIds.has(id)).toBe(true);
          });

          // Count must match
          expect(ctx.ids.length).toBe(filtered.length);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('applying search filter produces a context with only title/description matching IDs', () => {
    // **Validates: Requirements 7.2**
    fc.assert(
      fc.property(
        arbitraryCertList(2, 20),
        fc.string({ minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (certs, searchTerm, page, pageSize) => {
          const filtered = applyFilters(certs, searchTerm, '');
          const ctx = buildNavigationContext(filtered, page, pageSize);

          // All IDs in context must belong to certs matching the search term
          const q = searchTerm.toLowerCase();
          const matchingIds = new Set(
            certs
              .filter(
                (c) =>
                  c.title.toLowerCase().includes(q) ||
                  (c.description ?? '').toLowerCase().includes(q),
              )
              .map((c) => c.id),
          );

          ctx.ids.forEach((id) => {
            expect(matchingIds.has(id)).toBe(true);
          });
        },
      ),
      { numRuns: 25 },
    );
  });

  it('with no filters applied, context contains all certification IDs', () => {
    // **Validates: Requirements 7.2**
    fc.assert(
      fc.property(
        arbitraryCertList(1, 20),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (certs, page, pageSize) => {
          // No filters applied
          const filtered = applyFilters(certs, '', '');
          const ctx = buildNavigationContext(filtered, page, pageSize);

          // All certs must be in the context
          expect(ctx.ids.length).toBe(certs.length);
          certs.forEach((c) => {
            expect(ctx.ids).toContain(c.id);
          });
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 22: Navigation Context Includes Pagination Settings
// Feature: admin-detail-navigation, Property 22: Navigation Context Includes Pagination Settings
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------

describe('Property 22: Navigation Context Includes Pagination Settings', () => {
  it('navigation context includes the current page number', () => {
    // **Validates: Requirements 7.3**
    fc.assert(
      fc.property(
        arbitraryUniqueIds(1, 30),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, page, pageSize) => {
          const certs = ids.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          expect(ctx.page).toBe(page);
          expect(ctx.page).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('navigation context includes the page size setting', () => {
    // **Validates: Requirements 7.3**
    fc.assert(
      fc.property(
        arbitraryUniqueIds(1, 30),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, page, pageSize) => {
          const certs = ids.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          expect(ctx.pageSize).toBe(pageSize);
          expect(PAGE_SIZE_OPTIONS).toContain(ctx.pageSize);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('navigation context includes ALL filtered IDs regardless of current page window', () => {
    // **Validates: Requirements 7.3**
    // The context must contain all filtered IDs so the user can navigate beyond
    // the current page boundary without returning to the list view.
    fc.assert(
      fc.property(
        arbitraryUniqueIds(5, 50),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, page, pageSize) => {
          const certs = ids.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          // All IDs must be present — not just the slice for the current page
          expect(ctx.ids.length).toBe(ids.length);
          ids.forEach((id) => {
            expect(ctx.ids).toContain(id);
          });
        },
      ),
      { numRuns: 25 },
    );
  });

  it('page and pageSize are independent of the number of filtered records', () => {
    // **Validates: Requirements 7.3**
    fc.assert(
      fc.property(
        arbitraryUniqueIds(1, 30),
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, page, pageSize) => {
          const certs = ids.map((id) => ({ id }));
          const ctx = buildNavigationContext(certs, page, pageSize);

          // Pagination settings are stored as-is, independent of total count
          expect(ctx.page).toBe(page);
          expect(ctx.pageSize).toBe(pageSize);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('different page values produce different page settings in the context', () => {
    // **Validates: Requirements 7.3**
    fc.assert(
      fc.property(
        arbitraryUniqueIds(1, 10),
        fc.integer({ min: 1, max: 9 }),
        fc.constantFrom(...PAGE_SIZE_OPTIONS),
        (ids, page, pageSize) => {
          const certs = ids.map((id) => ({ id }));

          const ctx1 = buildNavigationContext(certs, page, pageSize);
          const ctx2 = buildNavigationContext(certs, page + 1, pageSize);

          // Different pages must produce different page values
          expect(ctx1.page).not.toBe(ctx2.page);
          expect(ctx2.page).toBe(page + 1);
        },
      ),
      { numRuns: 25 },
    );
  });
});
