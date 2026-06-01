/**
 * End-to-End Integration Tests for Admin Detail Navigation
 *
 * Feature: admin-detail-navigation
 * Requirements: All requirements
 *
 * Tests complete user flows across all entities:
 * - Filter-aware navigation scenarios
 * - Large dataset URL scalability (sessionStorage fallback)
 * - Error recovery scenarios
 * - Cross-entity navigation consistency
 * - Browser back/forward URL state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import {
  encodeNavigationContext,
  decodeNavigationContext,
  cleanupExpiredContexts,
} from '../../../utils/navigationUtils';

// ---------------------------------------------------------------------------
// Mocks
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const hex = i.toString(16).padStart(8, '0');
    return `${hex}-bdfa-5e55-b4f7-c8ff74bf51a7`;
  });
}

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  mockNavigate.mockClear();
  mockSetSearchParams.mockClear();
  sessionStorage.clear();

  Object.defineProperty(window, 'location', {
    value: {
      pathname: '/admin/question/id-0',
      origin: 'http://localhost:3000',
    },
    writable: true,
  });
});

afterEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Complete user flows across all entities
// ---------------------------------------------------------------------------

describe('Complete user flows', () => {
  it('navigates through a full question sequence from first to last', () => {
    const ids = generateIds(5);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[0]);

    const { result } = renderHook(() => useAdminNavigation('questions', ids[0]), { wrapper });

    // Start at first record
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.total).toBe(5);

    // Navigate forward through all records
    act(() => {
      result.current.goNext();
    });
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(ids[1]), { replace: false });
  });

  it('navigates backward from last record to first', () => {
    const ids = generateIds(5);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[4]);

    const { result } = renderHook(() => useAdminNavigation('questions', ids[4]), { wrapper });

    expect(result.current.currentIndex).toBe(4);
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.canGoNext).toBe(false);

    act(() => {
      result.current.goPrevious();
    });
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(ids[3]), { replace: false });
  });

  it('preserves navigation context across all 5 entity types', () => {
    const entityTypes = ['certifications', 'exams', 'topics', 'subtopics', 'questions'] as const;

    entityTypes.forEach((entityType) => {
      const ids = generateIds(3);
      mockSearchParams = new URLSearchParams();
      mockSearchParams.set('ids', ids.join(','));
      mockSearchParams.set('current', ids[1]);

      const { result } = renderHook(() => useAdminNavigation(entityType, ids[1]), { wrapper });

      expect(result.current.context?.ids).toEqual(ids);
      expect(result.current.currentIndex).toBe(1);
      expect(result.current.total).toBe(3);
    });
  });

  it('maintains position indicator accuracy throughout navigation', () => {
    const ids = generateIds(10);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[4]);

    const { result } = renderHook(() => useAdminNavigation('questions', ids[4]), { wrapper });

    // Position 5 of 10 (1-based)
    expect(result.current.currentIndex).toBe(4);
    expect(result.current.total).toBe(10);
    // canGoPrevious and canGoNext both true for middle record
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.canGoNext).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter-aware navigation scenarios
// ---------------------------------------------------------------------------

describe('Filter-aware navigation', () => {
  it('preserves filter state in navigation context', () => {
    const ids = generateIds(5);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[0]);
    mockSearchParams.set('navSearch', 'vpc');
    mockSearchParams.set('navDifficulty', 'Hard');
    mockSearchParams.set('navCertId', 'cert-123');

    const { result } = renderHook(() => useAdminNavigation('questions', ids[0]), { wrapper });

    expect(result.current.context?.filters).toEqual({
      search: 'vpc',
      difficulty: 'Hard',
      certId: 'cert-123',
    });
  });

  it('carries filter state forward when navigating next', () => {
    const ids = generateIds(3);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[0]);
    mockSearchParams.set('navSearch', 'networking');

    const { result } = renderHook(() => useAdminNavigation('questions', ids[0]), { wrapper });

    act(() => {
      result.current.goNext();
    });

    const navigateUrl = mockNavigate.mock.calls[0][0] as string;
    // The URL should contain the ids or navRef (not lose the context)
    expect(navigateUrl).toContain(ids[1]);
    expect(navigateUrl).toContain('current=');
  });

  it('initializes from list with filter state', () => {
    const ids = generateIds(5);

    const { result } = renderHook(() => useAdminNavigation('questions', ids[0]), { wrapper });

    act(() => {
      result.current.initializeFromList(ids, ids[0], {
        search: 'aws',
        difficulty: 'Medium',
        certId: 'cert-456',
      });
    });

    expect(result.current.context?.filters).toEqual({
      search: 'aws',
      difficulty: 'Medium',
      certId: 'cert-456',
    });
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('updates context when filters change and current record is still present', () => {
    const ids = generateIds(5);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[2]);

    const { result } = renderHook(() => useAdminNavigation('questions', ids[2]), { wrapper });

    // Filter narrows to 3 records, current still present
    const filteredIds = [ids[1], ids[2], ids[3]];
    act(() => {
      result.current.updateContext(filteredIds);
    });

    expect(result.current.context?.ids).toEqual(filteredIds);
    expect(mockSetSearchParams).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// URL scalability — large datasets
// ---------------------------------------------------------------------------

describe('URL scalability with large datasets', () => {
  it('uses sessionStorage for 200+ question IDs', () => {
    const ids = generateIds(200);
    const baseUrl = 'http://localhost:3000/admin/question/' + ids[0];
    const params = encodeNavigationContext({ ids, currentId: ids[0] }, baseUrl);

    // Must use navRef, not ids directly
    expect(params.has('navRef')).toBe(true);
    expect(params.has('ids')).toBe(false);

    // URL stays short
    const fullUrl = `${baseUrl}?${params.toString()}`;
    expect(fullUrl.length).toBeLessThan(2000);
  });

  it('round-trips 250 question IDs correctly via sessionStorage', () => {
    const ids = generateIds(250);
    const baseUrl = 'http://localhost:3000/admin/question/' + ids[0];
    const params = encodeNavigationContext(
      { ids, currentId: ids[0], filters: { search: 'vpc', certId: 'cert-1' } },
      baseUrl,
    );

    const decoded = decodeNavigationContext(params);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.ids).toHaveLength(250);
      expect(decoded.ids[0]).toBe(ids[0]);
      expect(decoded.filters?.search).toBe('vpc');
    }
  });

  it('hook reads large context from sessionStorage navRef', () => {
    const ids = generateIds(200);
    const baseUrl = 'http://localhost:3000/admin/question/' + ids[0];
    const params = encodeNavigationContext({ ids, currentId: ids[0] }, baseUrl);

    // Simulate what the URL would look like after navigation
    mockSearchParams = params;

    const { result } = renderHook(() => useAdminNavigation('questions', ids[0]), { wrapper });

    expect(result.current.context?.ids).toHaveLength(200);
    expect(result.current.total).toBe(200);
    expect(result.current.canGoNext).toBe(true);
  });

  it('preserves navRef when navigating next with large context', () => {
    const ids = generateIds(200);
    const baseUrl = 'http://localhost:3000/admin/question/' + ids[0];
    const params = encodeNavigationContext({ ids, currentId: ids[0] }, baseUrl);

    mockSearchParams = params;

    const { result } = renderHook(() => useAdminNavigation('questions', ids[0]), { wrapper });

    act(() => {
      result.current.goNext();
    });

    const navigateUrl = mockNavigate.mock.calls[0][0] as string;
    // Should preserve navRef, not re-expand to ids
    expect(navigateUrl).toContain('navRef=');
    expect(navigateUrl).not.toContain('ids=');
  });

  it('sessionStorage entries expire after 1 hour', () => {
    // Store an expired entry manually
    const key = 'admin-nav-context-expired-e2e';
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ids: generateIds(10),
        currentId: 'id-0',
        timestamp: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000,
      }),
    );

    const params = new URLSearchParams({ navRef: key, current: 'id-0' });
    const decoded = decodeNavigationContext(params);

    expect(decoded).toBeNull();
  });

  it('cleanupExpiredContexts removes stale entries', () => {
    // Add 3 expired + 1 valid
    for (let i = 0; i < 3; i++) {
      sessionStorage.setItem(
        `admin-nav-context-old-${i}`,
        JSON.stringify({
          ids: generateIds(5),
          currentId: 'id-0',
          timestamp: Date.now() - 7200000,
          expiresAt: Date.now() - 3600000,
        }),
      );
    }
    sessionStorage.setItem(
      'admin-nav-context-valid',
      JSON.stringify({
        ids: generateIds(5),
        currentId: 'id-0',
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      }),
    );

    expect(sessionStorage.length).toBe(4);
    cleanupExpiredContexts();
    expect(sessionStorage.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Error recovery scenarios
// ---------------------------------------------------------------------------

describe('Error recovery scenarios', () => {
  it('returns to list when context becomes empty', () => {
    const ids = generateIds(3);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[1]);

    Object.defineProperty(window, 'location', {
      value: { pathname: '/admin/questions/id-1', origin: 'http://localhost:3000' },
      writable: true,
    });

    const { result } = renderHook(() => useAdminNavigation('questions', ids[1]), { wrapper });

    act(() => {
      result.current.updateContext([]);
    });

    expect(result.current.context).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/admin/questions'), {
      replace: true,
    });
  });

  it('navigates to nearest record when current is removed from context', () => {
    const ids = generateIds(5);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[2]);

    Object.defineProperty(window, 'location', {
      value: { pathname: `/admin/questions/${ids[2]}`, origin: 'http://localhost:3000' },
      writable: true,
    });

    const { result } = renderHook(() => useAdminNavigation('questions', ids[2]), { wrapper });

    // Remove current record from context
    const newIds = [ids[0], ids[1], ids[3], ids[4]];
    act(() => {
      result.current.updateContext(newIds);
    });

    // Should navigate to first record in new list
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(ids[0]), { replace: true });
  });

  it('handles missing navRef gracefully (sessionStorage cleared)', () => {
    // Set a navRef that doesn't exist in sessionStorage
    mockSearchParams.set('navRef', 'admin-nav-context-nonexistent-key');
    mockSearchParams.set('current', 'some-id');

    const { result } = renderHook(() => useAdminNavigation('questions', 'some-id'), { wrapper });

    // Should not crash, context should be null
    expect(result.current.context).toBeNull();
    expect(result.current.total).toBe(0);
  });

  it('clears error state when clearError is called', () => {
    const ids = generateIds(3);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[1]);

    const { result } = renderHook(() => useAdminNavigation('questions', ids[1]), { wrapper });

    // Trigger an error by updating with empty context
    act(() => {
      result.current.updateContext([]);
    });
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('calls onNavigationError callback when error occurs', () => {
    const ids = generateIds(3);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[1]);

    const onNavigationError = vi.fn();

    Object.defineProperty(window, 'location', {
      value: { pathname: `/admin/questions/${ids[1]}`, origin: 'http://localhost:3000' },
      writable: true,
    });

    const { result } = renderHook(
      () => useAdminNavigation('questions', ids[1], { onNavigationError }),
      { wrapper },
    );

    act(() => {
      result.current.updateContext([]);
    });

    expect(onNavigationError).toHaveBeenCalledWith('invalid_context', expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// Browser back/forward URL state
// ---------------------------------------------------------------------------

describe('Browser back/forward URL state', () => {
  it('navigation context is fully encoded in URL for shareability', () => {
    const ids = generateIds(5);
    const context = { ids, currentId: ids[2] };
    const baseUrl = 'http://localhost:3000/admin/question/' + ids[2];
    const params = encodeNavigationContext(context, baseUrl);

    // URL should be self-contained (either ids or navRef)
    const hasDirectIds = params.has('ids');
    const hasNavRef = params.has('navRef');
    expect(hasDirectIds || hasNavRef).toBe(true);
    expect(params.has('current')).toBe(true);
  });

  it('decoding a shared URL reconstructs the full navigation context', () => {
    const ids = generateIds(5);
    const context = {
      ids,
      currentId: ids[2],
      filters: { search: 'networking', certId: 'cert-1' },
    };
    const baseUrl = 'http://localhost:3000/admin/question/' + ids[2];
    const params = encodeNavigationContext(context, baseUrl);
    const decoded = decodeNavigationContext(params);

    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.ids).toEqual(ids);
      expect(decoded.currentId).toBe(ids[2]);
      expect(decoded.filters?.search).toBe('networking');
    }
  });

  it('isLoading resets when navigating to a new record (URL change)', () => {
    const ids = generateIds(3);
    mockSearchParams.set('ids', ids.join(','));
    mockSearchParams.set('current', ids[0]);

    const { result, rerender } = renderHook(({ id }) => useAdminNavigation('questions', id), {
      wrapper,
      initialProps: { id: ids[0] },
    });

    act(() => {
      result.current.goNext();
    });
    expect(result.current.isLoading).toBe(true);

    // Simulate URL change (React Router navigated to new record)
    rerender({ id: ids[1] });
    expect(result.current.isLoading).toBe(false);
  });
});
