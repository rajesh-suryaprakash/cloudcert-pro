/**
 * Shared Property-Based Testing Utilities
 *
 * Feature: admin-detail-navigation
 * Validates: All properties
 *
 * Provides reusable fast-check generators and helpers for property-based tests
 * across the admin detail navigation feature.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Entity types

// ---------------------------------------------------------------------------
// Generator: arbitraryRecordId
// ---------------------------------------------------------------------------

/**
 * Generates a valid record ID string (alphanumeric and hyphens, 1-20 chars).
 *
 * **Validates: All properties**
 */
export function arbitraryRecordId(): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
      minLength: 1,
      maxLength: 20,
    })
    .map((chars) => chars.join(''));
}

// ---------------------------------------------------------------------------
// Generator: arbitraryFilterState
// ---------------------------------------------------------------------------

/**
 * Generates a random filter state with optional search, vendor, and certId fields.
 *
 * **Validates: Requirements 2.1, 2.2, 7.1, 7.2**
 */
export function arbitraryFilterState(): fc.Arbitrary<Record<string, string>> {
  return fc.record(
    {
      search: fc.string(),
      vendor: fc.constantFrom('AWS', 'GCP', 'Azure'),
      certId: fc.uuid(),
    },
    { requiredKeys: [] },
  );
}

// ---------------------------------------------------------------------------
// Generator: arbitraryUniqueIds (internal helper)
// ---------------------------------------------------------------------------

/**
 * Generates a list of unique record IDs with at least `minLength` entries.
 */
export function arbitraryUniqueIds(minLength: number, maxLength: number): fc.Arbitrary<string[]> {
  return fc
    .array(arbitraryRecordId(), { minLength: minLength * 2, maxLength: maxLength * 2 })
    .map((ids) => [...new Set(ids)])
    .filter((ids) => ids.length >= minLength)
    .map((ids) => ids.slice(0, maxLength));
}

// ---------------------------------------------------------------------------
// Specialized context generators
// ---------------------------------------------------------------------------

/**
 * Generates a navigation context where currentId is the first record.
 * Used for Property 1: Previous Button Disabled at First Record.
 *
 * **Validates: Requirements 1.2**
 */
export function arbitraryContextWithFirstAsCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
}> {
  return arbitraryUniqueIds(1, 50).map((ids) => ({
    ids,
    currentId: ids[0],
  }));
}

/**
 * Generates a navigation context where currentId is the last record.
 * Used for Property 2: Next Button Disabled at Last Record.
 *
 * **Validates: Requirements 1.3**
 */
export function arbitraryContextWithLastAsCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
}> {
  return arbitraryUniqueIds(1, 50).map((ids) => ({
    ids,
    currentId: ids[ids.length - 1],
  }));
}

/**
 * Generates a navigation context where currentId is NOT the first record.
 * Requires at least 2 IDs. Used for Property 3: Previous Navigation.
 *
 * **Validates: Requirements 1.4**
 */
export function arbitraryContextWithNonFirstCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  currentIndex: number;
}> {
  return arbitraryUniqueIds(2, 50).chain((ids) =>
    fc.integer({ min: 1, max: ids.length - 1 }).map((idx) => ({
      ids,
      currentId: ids[idx],
      currentIndex: idx,
    })),
  );
}

/**
 * Generates a navigation context where currentId is NOT the last record.
 * Requires at least 2 IDs. Used for Property 4: Next Navigation.
 *
 * **Validates: Requirements 1.5**
 */
export function arbitraryContextWithNonLastCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  currentIndex: number;
}> {
  return arbitraryUniqueIds(2, 50).chain((ids) =>
    fc.integer({ min: 0, max: ids.length - 2 }).map((idx) => ({
      ids,
      currentId: ids[idx],
      currentIndex: idx,
    })),
  );
}

/**
 * Generates a navigation context with any valid current position.
 * Used for Property 5: Position Indicator Accuracy and Properties 10-12.
 *
 * **Validates: Requirements 1.6, 4.1, 4.2, 4.3**
 */
export function arbitraryContextWithAnyCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  currentIndex: number;
}> {
  return arbitraryUniqueIds(1, 50).chain((ids) =>
    fc.integer({ min: 0, max: ids.length - 1 }).map((idx) => ({
      ids,
      currentId: ids[idx],
      currentIndex: idx,
    })),
  );
}

/**
 * Generates a set of "all records" and a non-empty filtered subset preserving order.
 * Used for Property 6: Filtered Navigation Context.
 *
 * **Validates: Requirements 2.1**
 */
export function arbitraryFilteredSubset(): fc.Arbitrary<{
  allIds: string[];
  filteredIds: string[];
}> {
  return arbitraryUniqueIds(2, 30).chain((allIds) =>
    fc
      .array(fc.integer({ min: 0, max: allIds.length - 1 }), {
        minLength: 1,
        maxLength: allIds.length,
      })
      .map((indices) => [...new Set(indices)].sort((a, b) => a - b))
      .map((sortedIndices) => ({
        allIds,
        filteredIds: sortedIndices.map((i) => allIds[i]),
      })),
  );
}

/**
 * Generates two different non-empty ID lists simulating a filter change.
 * Used for Property 7: Navigation Context Updates with Filters.
 *
 * **Validates: Requirements 2.2**
 */
export function arbitraryTwoFilteredSets(): fc.Arbitrary<{
  initialIds: string[];
  updatedIds: string[];
  currentId: string;
}> {
  return arbitraryUniqueIds(4, 40).chain((pool) => {
    const half = Math.floor(pool.length / 2);
    const initialIds = pool.slice(0, half + 1);
    const updatedIds = pool.slice(1, half + 2);
    const currentId = initialIds[0];
    return fc.constant({ initialIds, updatedIds, currentId });
  });
}

/**
 * Generates a sorted list of IDs simulating a sort order from the list view.
 * Used for Property 8: Sort Order Preservation.
 *
 * **Validates: Requirements 2.4**
 */
export function arbitrarySortedIds(): fc.Arbitrary<string[]> {
  return arbitraryUniqueIds(2, 30).map((ids) => [...ids].sort());
}

/**
 * Generates a context where one ID will be "deleted" and the current record
 * is NOT the deleted one. Used for Property 9: Deleted Record Exclusion.
 *
 * **Validates: Requirements 2.5**
 */
export function arbitraryContextWithDeletion(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  deletedId: string;
  expectedIdsAfterDeletion: string[];
}> {
  return arbitraryUniqueIds(3, 30).chain((ids) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: ids.length - 1 }),
        fc.integer({ min: 0, max: ids.length - 1 }),
      )
      .filter(([ci, di]) => ci !== di)
      .map(([ci, di]) => ({
        ids,
        currentId: ids[ci],
        deletedId: ids[di],
        expectedIdsAfterDeletion: ids.filter((_, i) => i !== di),
      })),
  );
}
