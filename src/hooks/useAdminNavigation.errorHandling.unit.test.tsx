/**
 * Unit Tests for useAdminNavigation hook - Error Handling (Task 16.3)
 *
 * This test suite focuses specifically on error handling scenarios:
 * - Test record not found scenario
 * - Test network failure recovery
 * - Test invalid context handling
 * - Test single record context
 * - Test empty context
 *
 * Requirements: 5.5, 1.2, 1.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

  // Mock window.location.pathname for navigation
  Object.defineProperty(window, 'location', {
    value: { pathname: '/admin/certifications/cert-1' },
    writable: true,
  });
});

// ---------------------------------------------------------------------------
// 1. Record Not Found Scenario (Requirement 5.5)
// ---------------------------------------------------------------------------

describe('Record Not Found Scenario', () => {
  it('should trigger onNavigationError callback when current record is removed from context', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-2', { onNavigationError }),
      { wrapper },
    );

    // Initialize context with current record
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
    });

    // Update context removing the current record
    act(() => {
      result.current.updateContext(['cert-1', 'cert-3']);
    });

    expect(onNavigationError).toHaveBeenCalledWith(
      'record_not_found',
      'Record not found. Showing next available record.',
    );
  });

  it('should set error state to record_not_found when current record is removed', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
    });

    // Remove current record from context
    act(() => {
      result.current.updateContext(['cert-1', 'cert-3']);
    });

    expect(result.current.error).toBe('record_not_found');
  });

  it('should navigate to nearest available record when current record not found', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
    });

    // Remove current record, leaving cert-1 and cert-3
    act(() => {
      result.current.updateContext(['cert-1', 'cert-3']);
    });

    // Should navigate to first available record (cert-1)
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cert-1'),
      expect.objectContaining({ replace: true }),
    );
  });

  it('should update context with new current ID when navigating to nearest record', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
    });

    // Remove current record
    act(() => {
      result.current.updateContext(['cert-4', 'cert-5']);
    });

    // Context should be updated with new IDs and nearest current ID
    expect(result.current.context?.ids).toEqual(['cert-4', 'cert-5']);
    expect(result.current.context?.currentId).toBe('cert-4');
  });

  it('should clear error state when clearError is called after record not found', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    // Initialize and trigger record not found error
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
      result.current.updateContext(['cert-1', 'cert-3']);
    });

    expect(result.current.error).toBe('record_not_found');

    // Clear error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Network Failure Recovery (Requirement 5.5)
// ---------------------------------------------------------------------------

describe('Network Failure Recovery', () => {
  it('should handle navigation failure gracefully during goNext', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    // Mock navigate to throw an error
    mockNavigate.mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
      { wrapper },
    );

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
    });

    // Try to navigate next (should fail)
    act(() => {
      result.current.goNext();
    });

    expect(onNavigationError).toHaveBeenCalledWith(
      'network_failure',
      'Failed to navigate to next record. Please try again.',
    );
  });

  it('should handle navigation failure gracefully during goPrevious', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    // Mock navigate to throw an error
    mockNavigate.mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-2', { onNavigationError }),
      { wrapper },
    );

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-2');
    });

    // Try to navigate previous (should fail)
    act(() => {
      result.current.goPrevious();
    });

    expect(onNavigationError).toHaveBeenCalledWith(
      'network_failure',
      'Failed to navigate to previous record. Please try again.',
    );
  });

  it('should set error state to network_failure when navigation fails', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    // Mock navigate to throw an error
    mockNavigate.mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
    });

    // Try to navigate (should fail)
    act(() => {
      result.current.goNext();
    });

    expect(result.current.error).toBe('network_failure');
  });

  it('should reset isLoading to false when navigation fails', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    // Mock navigate to throw an error
    mockNavigate.mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
    });

    // Try to navigate (should fail)
    act(() => {
      result.current.goNext();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should remain on current record when navigation fails', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    // Mock navigate to throw an error
    mockNavigate.mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
    });

    const initialIndex = result.current.currentIndex;

    // Try to navigate (should fail)
    act(() => {
      result.current.goNext();
    });

    // Should remain on same record
    expect(result.current.currentIndex).toBe(initialIndex);
    expect(result.current.context?.currentId).toBe('cert-1');
  });

  it('should re-enable navigation buttons after network failure', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    // Mock navigate to throw an error once
    mockNavigate.mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
    });

    // Try to navigate (should fail)
    act(() => {
      result.current.goNext();
    });

    // Navigation should still be possible (buttons re-enabled)
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Invalid Context Handling (Requirement 5.5)
// ---------------------------------------------------------------------------

describe('Invalid Context Handling', () => {
  it('should handle malformed ids parameter gracefully', () => {
    mockSearchParams.set('ids', 'cert-1,,cert-2,');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Should filter out empty segments
    expect(result.current.context?.ids).toEqual(['cert-1', 'cert-2']);
    expect(result.current.total).toBe(2);
  });

  it('should return null context when ids parameter is empty string', () => {
    mockSearchParams.set('ids', '');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
    expect(result.current.total).toBe(0);
  });

  it('should return null context when ids parameter contains only commas', () => {
    mockSearchParams.set('ids', ',,,');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
    expect(result.current.total).toBe(0);
  });

  it('should handle missing ids parameter gracefully', () => {
    // No ids parameter set
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
    expect(result.current.total).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
  });

  it('should handle invalid current ID not in context', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.total).toBe(3); // Context still valid
  });

  it('should trigger invalid_context error when all records are removed', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
      { wrapper },
    );

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1');
    });

    // Remove all records
    act(() => {
      result.current.updateContext([]);
    });

    expect(onNavigationError).toHaveBeenCalledWith(
      'invalid_context',
      'All records removed. Returning to list.',
    );
  });

  it('should navigate back to list when context becomes invalid (empty)', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1');
    });

    // Make context invalid
    act(() => {
      result.current.updateContext([]);
    });

    // Should navigate back to list (parent path)
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.not.stringContaining('cert-1'),
      expect.objectContaining({ replace: true }),
    );
  });

  it('should set context to null when invalid context is detected', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1');
    });

    // Make context invalid
    act(() => {
      result.current.updateContext([]);
    });

    expect(result.current.context).toBeNull();
    expect(result.current.error).toBe('invalid_context');
  });
});

// ---------------------------------------------------------------------------
// 4. Single Record Context (Requirements 1.2, 1.3)
// ---------------------------------------------------------------------------

describe('Single Record Context', () => {
  it('should disable both Previous and Next buttons with single record', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  it('should show correct position indicator for single record (1 of 1)', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.total).toBe(1);
  });

  it('should not navigate when goNext is called on single record', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when goPrevious is called on single record', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should maintain single record context during updates', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Initialize with single record
    act(() => {
      result.current.initializeFromList(['cert-1'], 'cert-1');
    });

    expect(result.current.context?.ids).toEqual(['cert-1']);
    expect(result.current.total).toBe(1);
    expect(result.current.currentIndex).toBe(0);
  });

  it('should not set loading state when navigation is attempted on single record', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    const initialLoadingState = result.current.isLoading;

    act(() => {
      result.current.goNext();
    });

    // Loading state should not change since navigation doesn't occur
    expect(result.current.isLoading).toBe(initialLoadingState);
  });
});

// ---------------------------------------------------------------------------
// 5. Empty Context (Requirements 1.2, 1.3)
// ---------------------------------------------------------------------------

describe('Empty Context', () => {
  it('should return null context when no navigation data is available', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
  });

  it('should show zero total and invalid index for empty context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.total).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
  });

  it('should disable both navigation buttons with empty context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  it('should not navigate when goNext is called with empty context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when goPrevious is called with empty context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should handle initializeFromURL gracefully with empty context', async () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    await act(async () => {
      await result.current.initializeFromURL();
    });

    expect(result.current.context).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should not set loading state when navigation is attempted with empty context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    const initialLoadingState = result.current.isLoading;

    act(() => {
      result.current.goNext();
    });

    // Loading state should not change since navigation doesn't occur
    expect(result.current.isLoading).toBe(initialLoadingState);
  });

  it('should maintain empty context state consistently', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    // Multiple calls should maintain consistent empty state
    expect(result.current.context).toBeNull();
    expect(result.current.total).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Error State Management
// ---------------------------------------------------------------------------

describe('Error State Management', () => {
  it('should clear error state when clearError is called', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
      { wrapper },
    );

    // Trigger an error
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

  it('should clear error state automatically during successful navigation', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
      { wrapper },
    );

    // Initialize and trigger error
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
      result.current.updateContext([]);
    });

    expect(result.current.error).not.toBeNull();

    // Re-initialize with valid context
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2', 'cert-3'], 'cert-1');
    });

    // Navigate (should clear error)
    act(() => {
      result.current.goNext();
    });

    expect(result.current.error).toBeNull();
  });

  it('should maintain error state until explicitly cleared or navigation succeeds', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
      { wrapper },
    );

    // Trigger error
    act(() => {
      result.current.initializeFromList(['cert-1', 'cert-2'], 'cert-1');
      result.current.updateContext([]);
    });

    const errorState = result.current.error;
    expect(errorState).not.toBeNull();

    // Error should persist until cleared
    expect(result.current.error).toBe(errorState);
  });
});
