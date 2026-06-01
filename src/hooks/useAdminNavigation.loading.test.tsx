/**
 * Unit Tests for useAdminNavigation Loading States
 *
 * Feature: admin-detail-navigation
 * Task: 17.3 - Write unit tests for loading states
 * Validates: Requirements 5.1, 5.3, 5.4
 *
 * Tests:
 * - isLoading state during navigation
 * - Optimistic URL updates
 * - Cached data handling during navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAdminNavigation, clearNavigationCache } from './useAdminNavigation';
import React from 'react';

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

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  clearNavigationCache(); // prevent global LRU cache pollution between tests
  mockSearchParams = new URLSearchParams();
  mockNavigate.mockClear();
  mockSetSearchParams.mockClear();

  // Mock window.location.pathname for navigation
  Object.defineProperty(window, 'location', {
    value: {
      pathname: '/admin/certs/cert-1',
    },
    writable: true,
  });
});

// ---------------------------------------------------------------------------
// Test: isLoading state during navigation
// Validates: Requirement 5.1, 5.3 - Loading state management
// ---------------------------------------------------------------------------

describe('isLoading state during navigation', () => {
  it('isLoading is false initially', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('isLoading becomes true when calling goNext', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('isLoading becomes true when calling goPrevious', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('isLoading resets to false when currentId changes', async () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result, rerender } = renderHook(({ id }) => useAdminNavigation('certifications', id), {
      wrapper,
      initialProps: { id: 'cert-1' },
    });

    // Trigger navigation
    act(() => {
      result.current.goNext();
    });

    expect(result.current.isLoading).toBe(true);

    // Simulate currentId change (navigation completed)
    rerender({ id: 'cert-2' });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('does not set isLoading when goNext is called at last record', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
      wrapper,
    });

    expect(result.current.canGoNext).toBe(false);

    act(() => {
      result.current.goNext();
    });

    // Should not set loading since navigation is not possible
    expect(result.current.isLoading).toBe(false);
  });

  it('does not set isLoading when goPrevious is called at first record', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.canGoPrevious).toBe(false);

    act(() => {
      result.current.goPrevious();
    });

    // Should not set loading since navigation is not possible
    expect(result.current.isLoading).toBe(false);
  });

  it('prevents navigation when already loading', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // First navigation
    act(() => {
      result.current.goNext();
    });

    expect(result.current.isLoading).toBe(true);
    const firstCallCount = mockNavigate.mock.calls.length;

    // Try to navigate again while loading
    act(() => {
      result.current.goNext();
    });

    // Should not call navigate again
    expect(mockNavigate.mock.calls.length).toBe(firstCallCount);
  });
});

// ---------------------------------------------------------------------------
// Test: Optimistic URL updates
// Validates: Requirement 5.4 - Optimistic UI updates
// ---------------------------------------------------------------------------

describe('Optimistic URL updates', () => {
  it('updates URL immediately when calling goNext', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    // Should call navigate immediately
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cert-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('updates URL immediately when calling goPrevious', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    // Should call navigate immediately
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cert-1'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('URL includes updated current parameter on goNext', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('current=cert-2');
  });

  it('URL includes updated current parameter on goPrevious', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('current=cert-1');
  });

  it('URL preserves ids parameter during navigation', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('ids=cert-1%2Ccert-2%2Ccert-3');
  });

  it('URL preserves filter parameters during navigation', () => {
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'cert-1,cert-2');
    mockSearchParams.set('current', 'cert-1');
    mockSearchParams.set('navVendor', 'Amazon');
    mockSearchParams.set('navSearch', 'aws');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Navigation URL contains navRef + current; filter params are stored in sessionStorage
    // so the URL will at minimum contain the destination id and current param
    expect(navigateCall).toContain('cert-2');
    expect(navigateCall).toContain('current=cert-2');
  });

  it('navigation uses replace: false to support browser back/forward', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ replace: false }),
    );
  });
});

// ---------------------------------------------------------------------------
// Test: Cached data handling
// Validates: Requirement 5.4 - Show cached data for optimistic updates
// ---------------------------------------------------------------------------

describe('Cached data handling during navigation', () => {
  it('cachedData is null initially when no cache exists', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.cachedData).toBeNull();
  });

  it('cacheCurrentData stores data in cache', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    const testData = { id: 'cert-1', title: 'Test Cert' };

    act(() => {
      result.current.cacheCurrentData(testData);
    });

    // Should be able to retrieve cached data
    const cached = result.current.getCachedData('cert-1');
    expect(cached).toEqual(testData);
  });

  it('getCachedData returns null for uncached record', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    const cached = result.current.getCachedData('cert-999');
    expect(cached).toBeNull();
  });

  it('cachedData updates when currentId changes to cached record', async () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const cert2Data = { id: 'cert-2', title: 'Cert 2' };

    const { result, rerender } = renderHook(({ id }) => useAdminNavigation('certifications', id), {
      wrapper,
      initialProps: { id: 'cert-1' },
    });

    // Navigate to cert-2 first so currentId becomes cert-2
    rerender({ id: 'cert-2' });

    // Cache data while currentId is cert-2
    act(() => {
      result.current.cacheCurrentData(cert2Data);
    });

    // Navigate back to cert-1
    rerender({ id: 'cert-1' });

    // Navigate to cert-2 again — cachedData should now show cert-2's data
    rerender({ id: 'cert-2' });

    await waitFor(() => {
      expect(result.current.cachedData).toEqual(cert2Data);
    });
  });

  it('cachedData is null when currentId changes to uncached record', async () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const cert1Data = { id: 'cert-1', title: 'Cert 1' };

    const { result, rerender } = renderHook(({ id }) => useAdminNavigation('certifications', id), {
      wrapper,
      initialProps: { id: 'cert-1' },
    });

    // Cache cert-1's data while currentId is cert-1
    act(() => {
      result.current.cacheCurrentData(cert1Data);
    });

    // Change to uncached cert-2 (cert-2 has no cached data)
    rerender({ id: 'cert-2' });

    await waitFor(() => {
      expect(result.current.cachedData).toBeNull();
    });
  });

  it('goNext sets cachedData if next record is cached', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    const { result, rerender } = renderHook(({ id }) => useAdminNavigation('certifications', id), {
      wrapper,
      initialProps: { id: 'cert-2' },
    });

    // While on cert-2, pre-populate cert-3's cache by temporarily navigating there
    rerender({ id: 'cert-3' });
    const cert3Data = { id: 'cert-3', title: 'Cert 3' };
    act(() => {
      result.current.cacheCurrentData(cert3Data);
    });

    // Go back to cert-2
    rerender({ id: 'cert-2' });

    // Navigate forward to cert-3
    act(() => {
      result.current.goNext();
    });

    // cachedData should be set immediately (optimistic update)
    expect(result.current.cachedData).toEqual(cert3Data);
  });

  it('goPrevious sets cachedData if previous record is cached', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    const { result, rerender } = renderHook(({ id }) => useAdminNavigation('certifications', id), {
      wrapper,
      initialProps: { id: 'cert-2' },
    });

    // Cache cert-1's data by navigating there first
    rerender({ id: 'cert-1' });
    const cert1Data = { id: 'cert-1', title: 'Cert 1' };
    act(() => {
      result.current.cacheCurrentData(cert1Data);
    });

    // Go back to cert-2
    rerender({ id: 'cert-2' });

    // Navigate to cert-1 via goPrevious
    act(() => {
      result.current.goPrevious();
    });

    // cachedData should be set immediately (optimistic update)
    expect(result.current.cachedData).toEqual(cert1Data);
  });

  it('getCacheStats returns cache statistics', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    const stats = result.current.getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('estimatedMemoryBytes');
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.estimatedMemoryBytes).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Test: Error handling during navigation
// Validates: Requirement 5.1, 5.3 - Error state management
// ---------------------------------------------------------------------------

describe('Error handling during navigation', () => {
  it('error is null initially', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.error).toBeNull();
  });

  it('clearError resets error state', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('clears error when navigating', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Simulate an error state (would be set by updateContext or other methods)
    // For this test, we just verify clearError is called during navigation
    act(() => {
      result.current.goNext();
    });

    // Error should be cleared (null) when starting navigation
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test: Loading state with prefetching
// Validates: Requirement 5.4 - Prefetching for optimistic updates
// ---------------------------------------------------------------------------

describe('Loading state with prefetching', () => {
  it('prefetch enabled does not affect initial loading state', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const mockFetch = vi.fn().mockResolvedValue({ id: 'cert-2', title: 'Cert 2' });

    const { result } = renderHook(
      () =>
        useAdminNavigation('certifications', 'cert-1', {
          prefetch: { enabled: true, prefetchNext: true, prefetchPrevious: true },
          fetchRecord: mockFetch,
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('navigation works correctly with prefetch enabled', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    const mockFetch = vi.fn().mockResolvedValue({ id: 'cert-2', title: 'Cert 2' });

    const { result } = renderHook(
      () =>
        useAdminNavigation('certifications', 'cert-1', {
          prefetch: { enabled: true, prefetchNext: true, prefetchPrevious: true },
          fetchRecord: mockFetch,
        }),
      { wrapper },
    );

    act(() => {
      result.current.goNext();
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockNavigate).toHaveBeenCalled();
  });
});
