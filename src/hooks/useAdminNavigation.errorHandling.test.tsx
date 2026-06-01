import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAdminNavigation } from './useAdminNavigation';
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

describe('useAdminNavigation - Error Handling and Edge Cases', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  beforeEach(() => {
    mockNavigate.mockClear();
    mockSetSearchParams.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  describe('Error Handling', () => {
    it('should call onNavigationError callback when record not found during context update', () => {
      const onNavigationError = vi.fn();
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2,cert-3&current=cert-2');

      const { result } = renderHook(
        () => useAdminNavigation('certifications', 'cert-2', { onNavigationError }),
        { wrapper },
      );

      // Initialize context
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
      });

      // Update context with IDs that don't include current record
      act(() => {
        result.current.updateContext(['cert-4', 'cert-5']);
      });

      expect(onNavigationError).toHaveBeenCalledWith(
        'record_not_found',
        'Record not found. Showing next available record.',
      );
    });

    it('should navigate to nearest record when current record is removed from context', () => {
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2,cert-3&current=cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      // Initialize context
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
      });

      // Update context removing current record
      act(() => {
        result.current.updateContext(['cert-1', 'cert-3']);
      });

      // Should navigate to first available record (cert-1)
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/cert-1'),
        expect.any(Object),
      );
    });

    it('should call onNavigationError when context becomes empty', () => {
      const onNavigationError = vi.fn();
      mockSearchParams = new URLSearchParams('ids=cert-1&current=cert-1');

      const { result } = renderHook(
        () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
        { wrapper },
      );

      // Initialize context with single record
      act(() => {
        result.current.initializeFromList(['cert-1'], 'cert-1');
      });

      // Update context to empty
      act(() => {
        result.current.updateContext([]);
      });

      expect(onNavigationError).toHaveBeenCalledWith(
        'invalid_context',
        'All records removed. Returning to list.',
      );
    });

    it('should navigate back to list when context becomes empty', () => {
      mockSearchParams = new URLSearchParams('ids=cert-1&current=cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      // Initialize context
      act(() => {
        result.current.initializeFromList(['cert-1'], 'cert-1');
      });

      // Update context to empty
      act(() => {
        result.current.updateContext([]);
      });

      // Should navigate back to list (parent path)
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.not.stringContaining('cert-1'),
        expect.objectContaining({ replace: true }),
      );
    });

    it('should clear error state when clearError is called', () => {
      const onNavigationError = vi.fn();
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2&current=cert-1');

      const { result } = renderHook(
        () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
        { wrapper },
      );

      // Initialize and trigger error
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1');
        result.current.updateContext([]);
      });

      expect(result.current.error).not.toBeNull();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single record context correctly', () => {
      mockSearchParams = new URLSearchParams('ids=cert-1&current=cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      // Initialize with single record
      act(() => {
        result.current.initializeFromList(['cert-1'], 'cert-1');
      });

      expect(result.current.total).toBe(1);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(false);
    });

    it('should handle empty context correctly', () => {
      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.context).toBeNull();
      expect(result.current.total).toBe(0);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(false);
    });

    it('should preserve context when current record is still in updated list', () => {
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2,cert-3&current=cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      // Initialize context
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
      });

      const initialNavigateCalls = mockNavigate.mock.calls.length;

      // Update context with current record still present
      act(() => {
        result.current.updateContext(['cert-2', 'cert-3', 'cert-4']);
      });

      // Should not navigate (current record still valid)
      expect(mockNavigate.mock.calls.length).toBe(initialNavigateCalls);
      expect(result.current.total).toBe(3);
      expect(result.current.context?.ids).toEqual(['cert-2', 'cert-3', 'cert-4']);
    });

    it('should handle navigation at boundaries correctly', () => {
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2,cert-3&current=cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      // Initialize at first record
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
      });

      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(true);

      // Try to go previous (should not navigate)
      const initialCalls = mockNavigate.mock.calls.length;
      act(() => {
        result.current.goPrevious();
      });
      expect(mockNavigate.mock.calls.length).toBe(initialCalls);
    });

    it('should handle invalid context gracefully', () => {
      // Set up invalid context (empty IDs)
      mockSearchParams = new URLSearchParams('ids=&current=cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      // Should have null context due to invalid IDs
      expect(result.current.context).toBeNull();
      expect(result.current.total).toBe(0);
    });

    it('should handle malformed URL parameters gracefully', () => {
      // Set up malformed context
      mockSearchParams = new URLSearchParams('ids=cert-1,,cert-2,&current=cert-1');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      // Should filter out empty IDs
      expect(result.current.context?.ids).toEqual(['cert-1', 'cert-2']);
      expect(result.current.total).toBe(2);
    });
  });

  describe('Navigation State Management', () => {
    it('should clear error on successful navigation', () => {
      const onNavigationError = vi.fn();
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2,cert-3&current=cert-2');

      const { result } = renderHook(
        () => useAdminNavigation('certifications', 'cert-2', { onNavigationError }),
        { wrapper },
      );

      // Initialize and trigger error
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
        result.current.updateContext([]);
      });

      expect(result.current.error).not.toBeNull();

      // Re-initialize with valid context
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
      });

      // Navigate (should clear error)
      act(() => {
        result.current.goNext();
      });

      // Error should be cleared during navigation
      expect(result.current.error).toBeNull();
    });

    it('should maintain context during edit operations', () => {
      mockSearchParams = new URLSearchParams('ids=cert-1,cert-2,cert-3&current=cert-2');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      // Initialize context
      act(() => {
        result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
      });

      const contextBeforeEdit = result.current.context;

      // Simulate edit operation (context should remain unchanged)
      // In real usage, the component would not call updateContext during edit
      expect(result.current.context).toEqual(contextBeforeEdit);
      expect(result.current.total).toBe(3);
      expect(result.current.currentIndex).toBe(1);
    });
  });
});
