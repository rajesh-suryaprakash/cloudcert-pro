import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAdminNavigation, clearNavigationCache } from './useAdminNavigation';
import type { ReactNode } from 'react';

// Mock react-router-dom hooks
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

describe('useAdminNavigation - Prefetching (Task 21.2)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockNavigate.mockClear();
    mockSetSearchParams.mockClear();
    // Clear global navigation cache to prevent state bleed between tests
    clearNavigationCache();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  describe('Prefetch Configuration', () => {
    it('should not prefetch when prefetch is disabled (default)', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-2', name: 'Test' });

      const { result: _result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-1', {
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Wait a bit to ensure no prefetch happens
      await waitFor(
        () => {
          expect(mockFetchRecord).not.toHaveBeenCalled();
        },
        { timeout: 200 },
      );
    });

    it('should prefetch next record when enabled', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-2', name: 'Test' });

      const { result: _result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-1', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: false,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Wait for prefetch to complete
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-2');
        },
        { timeout: 500 },
      );
    });

    it('should prefetch previous record when enabled', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-1', name: 'Test' });

      const { result: _result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-2', {
            prefetch: {
              enabled: true,
              prefetchNext: false,
              prefetchPrevious: true,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Wait for prefetch to complete
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-1');
        },
        { timeout: 500 },
      );
    });

    it('should prefetch both next and previous records when enabled', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const mockFetchRecord = vi
        .fn()
        .mockResolvedValueOnce({ id: 'cert-3', name: 'Next' })
        .mockResolvedValueOnce({ id: 'cert-1', name: 'Previous' });

      const { result: _result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-2', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: true,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Wait for both prefetches to complete
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledTimes(2);
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-3');
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-1');
        },
        { timeout: 1000 },
      );
    });

    it('should not prefetch when at first record and prefetchPrevious is true', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-1');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-2', name: 'Test' });

      const { result: _result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-1', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: true,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Should only prefetch next (cert-2), not previous (doesn't exist)
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledTimes(1);
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-2');
        },
        { timeout: 1000 },
      );
    });

    it('should not prefetch when at last record and prefetchNext is true', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-3');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-2', name: 'Test' });

      const { result: _result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-3', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: true,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Should only prefetch previous (cert-2), not next (doesn't exist)
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledTimes(1);
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-2');
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Prefetch Caching', () => {
    it('should cache prefetched data for instant navigation', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-1');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-2', name: 'Test Cert' });

      const { result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-1', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: false,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Wait for prefetch to complete
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-2');
        },
        { timeout: 1000 },
      );

      // Check if data is cached
      const cachedData = result.current.getCachedData('cert-2');
      expect(cachedData).toEqual({ id: 'cert-2', name: 'Test Cert' });
    });

    it('should not prefetch already cached records', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const mockFetchRecord = vi.fn().mockResolvedValue({ id: 'cert-2', name: 'Test' });

      const { result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-1', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: false,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Manually cache cert-2
      act(() => {
        result.current.cacheCurrentData({ id: 'cert-2', name: 'Cached' });
      });

      // Wait to ensure no additional fetch happens
      await waitFor(
        () => {
          // Should not call fetchRecord since cert-2 is already cached
          expect(mockFetchRecord).not.toHaveBeenCalled();
        },
        { timeout: 200 },
      );
    });

    it('should handle prefetch failures gracefully', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-1');

      const mockFetchRecord = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () =>
          useAdminNavigation('certifications', 'cert-1', {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: false,
            },
            fetchRecord: mockFetchRecord,
          }),
        { wrapper },
      );

      // Wait for prefetch attempt
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-2');
        },
        { timeout: 1000 },
      );

      // Should not crash, and navigation should still work
      expect(result.current.canGoNext).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      const stats = result.current.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('estimatedMemoryBytes');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.estimatedMemoryBytes).toBe('number');
    });

    it('should update cache statistics when data is cached', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      const statsBefore = result.current.getCacheStats();

      act(() => {
        result.current.cacheCurrentData({ id: 'cert-1', name: 'Test', data: 'Some data' });
      });

      const statsAfter = result.current.getCacheStats();

      // Cache size should increase
      expect(statsAfter.size).toBeGreaterThanOrEqual(statsBefore.size);
      expect(statsAfter.estimatedMemoryBytes).toBeGreaterThan(statsBefore.estimatedMemoryBytes);
    });
  });

  describe('Prefetch on Navigation', () => {
    it('should trigger prefetch when navigating to a new record', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3,cert-4');
      mockSearchParams.set('current', 'cert-1');

      const mockFetchRecord = vi
        .fn()
        .mockResolvedValueOnce({ id: 'cert-2', name: 'Next' })
        .mockResolvedValueOnce({ id: 'cert-4', name: 'Next Next' });

      const { result, rerender } = renderHook(
        ({ id }) =>
          useAdminNavigation('certifications', id, {
            prefetch: {
              enabled: true,
              prefetchNext: true,
              prefetchPrevious: false,
            },
            fetchRecord: mockFetchRecord,
          }),
        {
          wrapper,
          initialProps: { id: 'cert-1' },
        },
      );

      // Wait for initial prefetch
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-2');
        },
        { timeout: 1000 },
      );

      mockFetchRecord.mockClear();

      // Update search params for cert-3
      mockSearchParams.set('current', 'cert-3');

      // Navigate to cert-3
      rerender({ id: 'cert-3' });

      // Should prefetch cert-4
      await waitFor(
        () => {
          expect(mockFetchRecord).toHaveBeenCalledWith('cert-4');
        },
        { timeout: 1000 },
      );
    });
  });
});
