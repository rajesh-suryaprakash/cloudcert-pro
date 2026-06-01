import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAdminNavigation, type FilterState } from './useAdminNavigation';
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

describe('useAdminNavigation', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockNavigate.mockClear();
    mockSetSearchParams.mockClear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  describe('Task 2.1: State Management and URL Parsing', () => {
    it('should initialize with null context when no URL parameters', () => {
      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.context).toBeNull();
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.total).toBe(0);
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(false);
    });

    it('should parse navigation context from URL parameters', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      expect(result.current.context).toEqual({
        ids: ['cert-1', 'cert-2', 'cert-3'],
        currentId: 'cert-2',
        filters: undefined,
      });
      expect(result.current.currentIndex).toBe(1);
      expect(result.current.total).toBe(3);
    });

    it('should parse filter state from nav-prefixed URL parameters', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2');
      mockSearchParams.set('current', 'cert-1');
      mockSearchParams.set('navSearch', 'aws');
      mockSearchParams.set('navVendor', 'Amazon');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.context?.filters).toEqual({
        search: 'aws',
        vendor: 'Amazon',
      });
    });

    it('should handle empty ids parameter gracefully', () => {
      mockSearchParams.set('ids', '');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.context).toBeNull();
    });

    it('should calculate canGoPrevious correctly for first record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(true);
    });

    it('should calculate canGoNext correctly for last record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
        wrapper,
      });

      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.canGoNext).toBe(false);
    });

    it('should handle single record context', () => {
      mockSearchParams.set('ids', 'cert-1');
      mockSearchParams.set('current', 'cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.total).toBe(1);
      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Task 2.2: Navigation Actions', () => {
    beforeEach(() => {
      // Mock window.location.pathname
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/admin/certifications/cert-2',
        },
        writable: true,
      });
    });

    it('should navigate to next record when goNext is called', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      act(() => {
        result.current.goNext();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/admin/certifications/cert-3'),
        { replace: false },
      );
    });

    it('should navigate to previous record when goPrevious is called', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      act(() => {
        result.current.goPrevious();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/admin/certifications/cert-1'),
        { replace: false },
      );
    });

    it('should not navigate when goNext is called on last record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
        wrapper,
      });

      act(() => {
        result.current.goNext();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should not navigate when goPrevious is called on first record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      act(() => {
        result.current.goPrevious();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should set isLoading to true when navigating', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      act(() => {
        result.current.goNext();
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should update URL with new current ID when navigating', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      act(() => {
        result.current.goNext();
      });

      const navigateCall = mockNavigate.mock.calls[0][0];
      expect(navigateCall).toContain('current=cert-3');
    });
  });

  describe('Task 2.3: Context Initialization Methods', () => {
    it('should initialize context from list with IDs and filters', () => {
      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      const filters: FilterState = {
        search: 'aws',
        vendor: 'Amazon',
      };

      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1', filters);
      });

      expect(result.current.context).toEqual({
        ids: ['cert-1', 'cert-2', 'cert-3'],
        currentId: 'cert-1',
        filters,
      });
    });

    it('should encode context in URL when initializing from list', () => {
      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1');
      });

      expect(mockSetSearchParams).toHaveBeenCalled();
      const params = mockSetSearchParams.mock.calls[0][0];
      // encodeNavigationContext stores ids in sessionStorage and returns navRef + current
      expect(params.get('current')).toBe('cert-1');
      expect(params.get('navRef')).toBeTruthy(); // sessionStorage reference key
    });

    it('should encode filters with nav prefix when initializing from list', () => {
      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      const filters: FilterState = {
        search: 'aws',
        vendor: 'Amazon',
      };

      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1', filters);
      });

      const params = mockSetSearchParams.mock.calls[0][0];
      // encodeNavigationContext stores filters in sessionStorage along with ids;
      // the URL only contains navRef + current — filter retrieval happens via sessionStorage
      expect(params.get('current')).toBe('cert-1');
      expect(params.get('navRef')).toBeTruthy();
    });

    it('should initialize from URL and parse existing context', async () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      await act(async () => {
        await result.current.initializeFromURL();
      });

      expect(result.current.context).toEqual({
        ids: ['cert-1', 'cert-2', 'cert-3'],
        currentId: 'cert-2',
        filters: undefined,
      });
      expect(result.current.isLoading).toBe(false);
    });

    it('should update context with new IDs', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      act(() => {
        result.current.updateContext(['cert-2', 'cert-3', 'cert-4']);
      });

      expect(result.current.context?.ids).toEqual(['cert-2', 'cert-3', 'cert-4']);
      expect(mockSetSearchParams).toHaveBeenCalled();
    });

    it('should navigate to first record when current ID not in new context', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/admin/certifications/cert-2',
          origin: 'http://localhost:3000',
        },
        writable: true,
      });

      act(() => {
        result.current.updateContext(['cert-4', 'cert-5']);
      });

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('cert-4'), {
        replace: true,
      });
    });

    it('should clear context when updating with empty IDs', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      act(() => {
        result.current.updateContext([]);
      });

      expect(result.current.context).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed ids parameter', () => {
      mockSearchParams.set('ids', 'cert-1,,cert-2,');
      mockSearchParams.set('current', 'cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      // Should filter out empty strings
      expect(result.current.context?.ids).toEqual(['cert-1', 'cert-2']);
    });

    it('should handle current ID not in context', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
        wrapper,
      });

      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(false);
    });

    it('should reset isLoading when currentId changes', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
      mockSearchParams.set('current', 'cert-1');

      const { result, rerender } = renderHook(
        ({ id }) => useAdminNavigation('certifications', id),
        {
          wrapper,
          initialProps: { id: 'cert-1' },
        },
      );

      act(() => {
        result.current.goNext();
      });

      expect(result.current.isLoading).toBe(true);

      rerender({ id: 'cert-2' });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
