/**
 * Property-Based Tests for useAdminNavigation hook
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * These tests verify universal correctness properties of the navigation hook
 * across all valid inputs using fast-check.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import { useAdminNavigation } from './useAdminNavigation';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Router mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  mockNavigate.mockClear();
  mockSetSearchParams.mockClear();
  Object.defineProperty(window, 'location', {
    value: { pathname: '/admin/certifications/cert-1' },
    writable: true,
  });
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generates a valid record ID string (alphanumeric and hyphens).
 */
function arbitraryRecordId(): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
      minLength: 1,
      maxLength: 20,
    })
    .map((chars) => chars.join(''));
}

/**
 * Generates a list of unique record IDs with at least `minLength` entries.
 */
function arbitraryUniqueIds(minLength: number, maxLength: number): fc.Arbitrary<string[]> {
  return fc
    .array(arbitraryRecordId(), { minLength: minLength * 2, maxLength: maxLength * 2 })
    .map((ids) => [...new Set(ids)])
    .filter((ids) => ids.length >= minLength)
    .map((ids) => ids.slice(0, maxLength));
}

/**
 * Generates a navigation context: a list of unique IDs and a currentId that is
 * the first element (for boundary tests) or any element.
 */
function arbitraryContextWithFirstAsCurrent(): fc.Arbitrary<{ ids: string[]; currentId: string }> {
  return arbitraryUniqueIds(1, 50).map((ids) => ({
    ids,
    currentId: ids[0],
  }));
}

/**
 * Generates a navigation context where currentId is the last element.
 */
function arbitraryContextWithLastAsCurrent(): fc.Arbitrary<{ ids: string[]; currentId: string }> {
  return arbitraryUniqueIds(1, 50).map((ids) => ({
    ids,
    currentId: ids[ids.length - 1],
  }));
}

/**
 * Generates a navigation context where currentId is NOT the first element
 * (requires at least 2 IDs).
 */
function arbitraryContextWithNonFirstCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  currentIndex: number;
}> {
  return arbitraryUniqueIds(2, 50).chain((ids) => {
    // Pick an index that is NOT 0
    return fc.integer({ min: 1, max: ids.length - 1 }).map((idx) => ({
      ids,
      currentId: ids[idx],
      currentIndex: idx,
    }));
  });
}

/**
 * Generates a navigation context where currentId is NOT the last element
 * (requires at least 2 IDs).
 */
function arbitraryContextWithNonLastCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  currentIndex: number;
}> {
  return arbitraryUniqueIds(2, 50).chain((ids) => {
    // Pick an index that is NOT the last
    return fc.integer({ min: 0, max: ids.length - 2 }).map((idx) => ({
      ids,
      currentId: ids[idx],
      currentIndex: idx,
    }));
  });
}

/**
 * Generates a navigation context with any valid current position.
 */
function arbitraryContextWithAnyCurrent(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  currentIndex: number;
}> {
  return arbitraryUniqueIds(1, 50).chain((ids) => {
    return fc.integer({ min: 0, max: ids.length - 1 }).map((idx) => ({
      ids,
      currentId: ids[idx],
      currentIndex: idx,
    }));
  });
}

// ---------------------------------------------------------------------------
// Helper: render hook with a given navigation context in URL params
// ---------------------------------------------------------------------------

function renderWithContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);

  return renderHook(() => useAdminNavigation('certifications', currentId), { wrapper });
}

// ---------------------------------------------------------------------------
// Property 1: Previous Button Disabled at First Record
// ---------------------------------------------------------------------------

describe('Property 1: Previous Button Disabled at First Record', () => {
  // Feature: admin-detail-navigation, Property 1: Previous Button Disabled at First Record
  // Validates: Requirements 1.2
  it('canGoPrevious is false when current record is the first in the sequence', () => {
    fc.assert(
      fc.property(arbitraryContextWithFirstAsCurrent(), ({ ids, currentId }) => {
        const { result } = renderWithContext(ids, currentId);
        expect(result.current.canGoPrevious).toBe(false);
      }),
      { numRuns: 25 },
    );
  });

  it('goPrevious does not navigate when current record is the first', () => {
    fc.assert(
      fc.property(arbitraryContextWithFirstAsCurrent(), ({ ids, currentId }) => {
        mockNavigate.mockClear();
        const { result } = renderWithContext(ids, currentId);

        act(() => {
          result.current.goPrevious();
        });

        expect(mockNavigate).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Next Button Disabled at Last Record
// ---------------------------------------------------------------------------

describe('Property 2: Next Button Disabled at Last Record', () => {
  // Feature: admin-detail-navigation, Property 2: Next Button Disabled at Last Record
  // Validates: Requirements 1.3
  it('canGoNext is false when current record is the last in the sequence', () => {
    fc.assert(
      fc.property(arbitraryContextWithLastAsCurrent(), ({ ids, currentId }) => {
        const { result } = renderWithContext(ids, currentId);
        expect(result.current.canGoNext).toBe(false);
      }),
      { numRuns: 25 },
    );
  });

  it('goNext does not navigate when current record is the last', () => {
    fc.assert(
      fc.property(arbitraryContextWithLastAsCurrent(), ({ ids, currentId }) => {
        mockNavigate.mockClear();
        const { result } = renderWithContext(ids, currentId);

        act(() => {
          result.current.goNext();
        });

        expect(mockNavigate).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Previous Navigation Moves to Prior Record
// ---------------------------------------------------------------------------

describe('Property 3: Previous Navigation Moves to Prior Record', () => {
  // Feature: admin-detail-navigation, Property 3: Previous Navigation Moves to Prior Record
  // Validates: Requirements 1.4
  it('goPrevious navigates to the record at the previous index', () => {
    fc.assert(
      fc.property(arbitraryContextWithNonFirstCurrent(), ({ ids, currentId, currentIndex }) => {
        mockNavigate.mockClear();
        const { result } = renderWithContext(ids, currentId);

        expect(result.current.canGoPrevious).toBe(true);

        act(() => {
          result.current.goPrevious();
        });

        const expectedPrevId = ids[currentIndex - 1];
        expect(mockNavigate).toHaveBeenCalledOnce();
        const navigateArg = mockNavigate.mock.calls[0][0] as string;
        expect(navigateArg).toContain(expectedPrevId);
      }),
      { numRuns: 25 },
    );
  });

  it('canGoPrevious is true when current record is not the first', () => {
    fc.assert(
      fc.property(arbitraryContextWithNonFirstCurrent(), ({ ids, currentId }) => {
        const { result } = renderWithContext(ids, currentId);
        expect(result.current.canGoPrevious).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Next Navigation Moves to Subsequent Record
// ---------------------------------------------------------------------------

describe('Property 4: Next Navigation Moves to Subsequent Record', () => {
  // Feature: admin-detail-navigation, Property 4: Next Navigation Moves to Subsequent Record
  // Validates: Requirements 1.5
  it('goNext navigates to the record at the next index', () => {
    fc.assert(
      fc.property(arbitraryContextWithNonLastCurrent(), ({ ids, currentId, currentIndex }) => {
        mockNavigate.mockClear();
        const { result } = renderWithContext(ids, currentId);

        expect(result.current.canGoNext).toBe(true);

        act(() => {
          result.current.goNext();
        });

        const expectedNextId = ids[currentIndex + 1];
        expect(mockNavigate).toHaveBeenCalledOnce();
        const navigateArg = mockNavigate.mock.calls[0][0] as string;
        expect(navigateArg).toContain(expectedNextId);
      }),
      { numRuns: 25 },
    );
  });

  it('canGoNext is true when current record is not the last', () => {
    fc.assert(
      fc.property(arbitraryContextWithNonLastCurrent(), ({ ids, currentId }) => {
        const { result } = renderWithContext(ids, currentId);
        expect(result.current.canGoNext).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Position Indicator Accuracy
// ---------------------------------------------------------------------------

describe('Property 5: Position Indicator Accuracy', () => {
  // Feature: admin-detail-navigation, Property 5: Position Indicator Accuracy
  // Validates: Requirements 1.6
  it('currentIndex is the 0-based position of currentId in the ids array', () => {
    fc.assert(
      fc.property(arbitraryContextWithAnyCurrent(), ({ ids, currentId, currentIndex }) => {
        const { result } = renderWithContext(ids, currentId);
        expect(result.current.currentIndex).toBe(currentIndex);
      }),
      { numRuns: 25 },
    );
  });

  it('total equals the number of IDs in the navigation context', () => {
    fc.assert(
      fc.property(arbitraryContextWithAnyCurrent(), ({ ids, currentId }) => {
        const { result } = renderWithContext(ids, currentId);
        expect(result.current.total).toBe(ids.length);
      }),
      { numRuns: 25 },
    );
  });

  it('1-based position (currentIndex + 1) and total are correct for any position', () => {
    fc.assert(
      fc.property(arbitraryContextWithAnyCurrent(), ({ ids, currentId, currentIndex }) => {
        const { result } = renderWithContext(ids, currentId);

        // The position indicator "X of Y" uses 1-based index
        const oneBasedPosition = result.current.currentIndex + 1;
        expect(oneBasedPosition).toBe(currentIndex + 1);
        expect(result.current.total).toBe(ids.length);
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Generators for context management properties (Properties 6-9)
// ---------------------------------------------------------------------------

/**
 * Generates a FilterState with optional search/vendor/certId fields.
 */
function arbitraryFilterState(): fc.Arbitrary<Record<string, string>> {
  return fc
    .record(
      {
        search: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        vendor: fc.option(fc.constantFrom('Amazon', 'Google', 'Microsoft', 'HashiCorp'), {
          nil: undefined,
        }),
        certId: fc.option(arbitraryRecordId(), { nil: undefined }),
      },
      { requiredKeys: [] },
    )
    .map((obj) => {
      // Remove undefined values
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) result[k] = v as string;
      }
      return result;
    });
}

/**
 * Generates a set of "all records" and a subset of "filtered records" that is
 * a non-empty sub-sequence of the full list (preserving order).
 */
function arbitraryFilteredSubset(): fc.Arbitrary<{ allIds: string[]; filteredIds: string[] }> {
  return arbitraryUniqueIds(2, 30).chain((allIds) => {
    // Pick a non-empty subset of indices (preserving order)
    return fc
      .array(fc.integer({ min: 0, max: allIds.length - 1 }), {
        minLength: 1,
        maxLength: allIds.length,
      })
      .map((indices) => [...new Set(indices)].sort((a, b) => a - b))
      .map((sortedIndices) => ({
        allIds,
        filteredIds: sortedIndices.map((i) => allIds[i]),
      }));
  });
}

/**
 * Generates two different non-empty ID lists (simulating a filter change).
 */
function arbitraryTwoFilteredSets(): fc.Arbitrary<{
  initialIds: string[];
  updatedIds: string[];
  currentId: string;
}> {
  return arbitraryUniqueIds(4, 40).chain((pool) => {
    const half = Math.floor(pool.length / 2);
    const initialIds = pool.slice(0, half + 1);
    const updatedIds = pool.slice(1, half + 2); // overlapping but different
    const currentId = initialIds[0];
    return fc.constant({ initialIds, updatedIds, currentId });
  });
}

/**
 * Generates a sorted list of IDs (simulating a sort order from the list view).
 */
function arbitrarySortedIds(): fc.Arbitrary<string[]> {
  return arbitraryUniqueIds(2, 30).map((ids) => [...ids].sort());
}

/**
 * Generates a context where one ID will be "deleted" and the current record
 * is NOT the deleted one (so we can test position adjustment).
 */
function arbitraryContextWithDeletion(): fc.Arbitrary<{
  ids: string[];
  currentId: string;
  deletedId: string;
  expectedIdsAfterDeletion: string[];
}> {
  return arbitraryUniqueIds(3, 30).chain((ids) => {
    // Pick a currentId index and a different deletedId index
    return fc
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
      }));
  });
}

// ---------------------------------------------------------------------------
// Property 6: Filtered Navigation Context
// ---------------------------------------------------------------------------

describe('Property 6: Filtered Navigation Context', () => {
  // Feature: admin-detail-navigation, Property 6: Filtered Navigation Context
  // Validates: Requirements 2.1
  it('initializeFromList stores only the provided filtered IDs in context', () => {
    fc.assert(
      fc.property(arbitraryFilteredSubset(), arbitraryFilterState(), ({ filteredIds }, filters) => {
        mockSearchParams = new URLSearchParams();
        const currentId = filteredIds[0];

        const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
          wrapper,
        });

        act(() => {
          result.current.initializeFromList(filteredIds, currentId, filters);
        });

        // Context must contain exactly the filtered IDs
        expect(result.current.context).not.toBeNull();
        expect(result.current.context?.ids).toEqual(filteredIds);
      }),
      { numRuns: 25 },
    );
  });

  it('context IDs after initializeFromList are a subset of any superset list', () => {
    fc.assert(
      fc.property(arbitraryFilteredSubset(), ({ filteredIds }) => {
        mockSearchParams = new URLSearchParams();
        const currentId = filteredIds[0];

        const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
          wrapper,
        });

        act(() => {
          result.current.initializeFromList(filteredIds, currentId);
        });

        const contextIds = result.current.context?.ids;
        // Every ID in context must be from the filtered set
        expect(contextIds.every((id) => filteredIds.includes(id))).toBe(true);
        // No extra IDs from allIds that weren't in filteredIds
        const extraIds = contextIds.filter((id) => !filteredIds.includes(id));
        expect(extraIds).toHaveLength(0);
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Navigation Context Updates with Filters
// ---------------------------------------------------------------------------

describe('Property 7: Navigation Context Updates with Filters', () => {
  // Feature: admin-detail-navigation, Property 7: Navigation Context Updates with Filters
  // Validates: Requirements 2.2
  it('updateContext replaces the IDs in context with the new filtered set', () => {
    fc.assert(
      fc.property(arbitraryTwoFilteredSets(), ({ initialIds, updatedIds, currentId }) => {
        mockSearchParams = new URLSearchParams();
        mockSearchParams.set('ids', initialIds.join(','));
        mockSearchParams.set('current', currentId);
        mockNavigate.mockClear();
        mockSetSearchParams.mockClear();

        const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
          wrapper,
        });

        // Verify initial context is set from URL
        expect(result.current.context).not.toBeNull();
        expect(result.current.context?.ids).toEqual(initialIds);

        act(() => {
          result.current.updateContext(updatedIds);
        });

        // After update, context IDs should reflect the new set
        // (if currentId is still in updatedIds, context.ids === updatedIds)
        if (updatedIds.includes(currentId)) {
          expect(result.current.context?.ids).toEqual(updatedIds);
        } else {
          // currentId was removed; hook navigates to nearest record
          // context is updated to new IDs
          expect(result.current.context?.ids).toEqual(updatedIds);
        }
      }),
      { numRuns: 25 },
    );
  });

  it('updateContext with IDs containing currentId preserves currentId in context', () => {
    fc.assert(
      fc.property(
        arbitraryUniqueIds(2, 20).chain((ids) =>
          fc.integer({ min: 0, max: ids.length - 1 }).map((idx) => ({
            ids,
            currentId: ids[idx],
          })),
        ),
        arbitraryUniqueIds(2, 20),
        ({ ids: initialIds, currentId }, extraIds) => {
          // Build updatedIds that definitely contains currentId
          const updatedIds = [...new Set([currentId, ...extraIds])];

          mockSearchParams = new URLSearchParams();
          mockSearchParams.set('ids', initialIds.join(','));
          mockSearchParams.set('current', currentId);
          mockNavigate.mockClear();
          mockSetSearchParams.mockClear();

          const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
            wrapper,
          });

          act(() => {
            result.current.updateContext(updatedIds);
          });

          // currentId should still be in the updated context
          expect(result.current.context?.ids).toContain(currentId);
          expect(result.current.context?.ids).toEqual(updatedIds);
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Sort Order Preservation
// ---------------------------------------------------------------------------

describe('Property 8: Sort Order Preservation', () => {
  // Feature: admin-detail-navigation, Property 8: Sort Order Preservation
  // Validates: Requirements 2.4
  it('initializeFromList preserves the exact order of IDs as provided', () => {
    fc.assert(
      fc.property(arbitrarySortedIds(), (sortedIds) => {
        mockSearchParams = new URLSearchParams();
        const currentId = sortedIds[0];

        const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
          wrapper,
        });

        act(() => {
          result.current.initializeFromList(sortedIds, currentId);
        });

        // The context IDs must be in the exact same order as provided
        expect(result.current.context?.ids).toEqual(sortedIds);
      }),
      { numRuns: 25 },
    );
  });

  it('updateContext preserves the exact order of the new IDs', () => {
    fc.assert(
      fc.property(
        arbitraryUniqueIds(2, 20).chain((ids) =>
          fc.constant({ initialIds: ids, currentId: ids[0] }),
        ),
        arbitrarySortedIds(),
        ({ initialIds, currentId }, sortedUpdatedIds) => {
          mockSearchParams = new URLSearchParams();
          mockSearchParams.set('ids', initialIds.join(','));
          mockSearchParams.set('current', currentId);
          mockNavigate.mockClear();
          mockSetSearchParams.mockClear();

          // Ensure currentId is in the updated list to avoid navigation side-effects
          const updatedIds = sortedUpdatedIds.includes(currentId)
            ? sortedUpdatedIds
            : [currentId, ...sortedUpdatedIds];

          const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
            wrapper,
          });

          act(() => {
            result.current.updateContext(updatedIds);
          });

          expect(result.current.context?.ids).toEqual(updatedIds);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('navigation sequence follows the sort order: goNext moves to the next ID in the provided order', () => {
    fc.assert(
      fc.property(
        arbitrarySortedIds().filter((ids) => ids.length >= 2),
        (sortedIds) => {
          mockSearchParams = new URLSearchParams();
          // Start at first record so we can go next
          const currentId = sortedIds[0];
          mockSearchParams.set('ids', sortedIds.join(','));
          mockSearchParams.set('current', currentId);
          mockNavigate.mockClear();

          const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
            wrapper,
          });

          act(() => {
            result.current.goNext();
          });

          const expectedNextId = sortedIds[1];
          expect(mockNavigate).toHaveBeenCalledOnce();
          const navigateArg = mockNavigate.mock.calls[0][0] as string;
          expect(navigateArg).toContain(expectedNextId);
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Deleted Record Exclusion
// ---------------------------------------------------------------------------

describe('Property 9: Deleted Record Exclusion', () => {
  // Feature: admin-detail-navigation, Property 9: Deleted Record Exclusion
  // Validates: Requirements 2.5
  it('updateContext with deleted record excluded removes that ID from context', () => {
    fc.assert(
      fc.property(
        arbitraryContextWithDeletion(),
        ({ ids, currentId, deletedId, expectedIdsAfterDeletion }) => {
          mockSearchParams = new URLSearchParams();
          mockSearchParams.set('ids', ids.join(','));
          mockSearchParams.set('current', currentId);
          mockNavigate.mockClear();
          mockSetSearchParams.mockClear();

          const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
            wrapper,
          });

          // Simulate deletion: pass IDs without the deleted record
          act(() => {
            result.current.updateContext(expectedIdsAfterDeletion);
          });

          // Deleted ID must not appear in the updated context
          expect(result.current.context?.ids).not.toContain(deletedId);
          expect(result.current.context?.ids).toEqual(expectedIdsAfterDeletion);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('updateContext adjusts position when current record is deleted (navigates to nearest)', () => {
    fc.assert(
      fc.property(
        arbitraryUniqueIds(3, 30).chain((ids) =>
          fc.integer({ min: 0, max: ids.length - 1 }).map((deletedIdx) => ({
            ids,
            currentId: ids[deletedIdx], // current IS the deleted record
            deletedIdx,
            idsAfterDeletion: ids.filter((_, i) => i !== deletedIdx),
          })),
        ),
        ({ ids, currentId, idsAfterDeletion }) => {
          mockSearchParams = new URLSearchParams();
          mockSearchParams.set('ids', ids.join(','));
          mockSearchParams.set('current', currentId);
          mockNavigate.mockClear();
          mockSetSearchParams.mockClear();

          const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
            wrapper,
          });

          act(() => {
            result.current.updateContext(idsAfterDeletion);
          });

          // The deleted currentId must not be in the new context
          expect(result.current.context?.ids).not.toContain(currentId);
          // Hook should navigate to the nearest record (first in new list)
          expect(mockNavigate).toHaveBeenCalled();
          const navigateArg = mockNavigate.mock.calls[0][0] as string;
          expect(navigateArg).toContain(idsAfterDeletion[0]);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('total decreases by 1 after a record is excluded via updateContext', () => {
    fc.assert(
      fc.property(
        arbitraryContextWithDeletion(),
        ({ ids, currentId, expectedIdsAfterDeletion }) => {
          mockSearchParams = new URLSearchParams();
          mockSearchParams.set('ids', ids.join(','));
          mockSearchParams.set('current', currentId);
          mockNavigate.mockClear();
          mockSetSearchParams.mockClear();

          const { result } = renderHook(() => useAdminNavigation('certifications', currentId), {
            wrapper,
          });

          const totalBefore = result.current.total;

          act(() => {
            result.current.updateContext(expectedIdsAfterDeletion);
          });

          expect(result.current.total).toBe(totalBefore - 1);
        },
      ),
      { numRuns: 25 },
    );
  });
});
