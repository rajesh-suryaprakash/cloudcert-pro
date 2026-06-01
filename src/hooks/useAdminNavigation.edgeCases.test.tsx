/**
 * Unit Tests for useAdminNavigation hook - Edge Cases (Task 2.6)
 *
 * Covers:
 * - Single record context
 * - Empty context
 * - Navigation at boundaries
 * - Invalid current ID
 * - Context reconstruction failure
 *
 * Requirements: 1.1, 2.1, 7.4
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
  Object.defineProperty(window, 'location', {
    value: { pathname: '/admin/certifications/cert-1' },
    writable: true,
  });
});

// ---------------------------------------------------------------------------
// 1. Single Record Context
// ---------------------------------------------------------------------------

describe('Single Record Context', () => {
  it('disables both Previous and Next buttons', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  it('shows position as 1 of 1 (currentIndex=0, total=1)', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.total).toBe(1);
  });

  it('does not navigate when goNext is called', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when goPrevious is called', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('context is non-null with the single ID', () => {
    mockSearchParams.set('ids', 'cert-1');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.ids).toEqual(['cert-1']);
  });
});

// ---------------------------------------------------------------------------
// 2. Empty Context
// ---------------------------------------------------------------------------

describe('Empty Context', () => {
  it('returns null context when no ids param is present', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
  });

  it('returns total=0 and currentIndex=-1 when context is null', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.total).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
  });

  it('disables both navigation buttons when context is null', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  it('does not navigate when goNext is called with null context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when goPrevious is called with null context', () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates back to list and sets context to null when updateContext receives empty array', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.updateContext([]);
    });

    expect(result.current.context).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.not.stringContaining('cert-1'),
      expect.objectContaining({ replace: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Navigation at Boundaries
// ---------------------------------------------------------------------------

describe('Navigation at Boundaries', () => {
  describe('First record', () => {
    it('canGoPrevious is false at the first record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.canGoPrevious).toBe(false);
    });

    it('canGoNext is true at the first record (when more records exist)', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      expect(result.current.canGoNext).toBe(true);
    });

    it('goPrevious does not navigate when at the first record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      act(() => {
        result.current.goPrevious();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('goNext navigates to the second record from the first', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
        wrapper,
      });

      act(() => {
        result.current.goNext();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('cert-2'),
        expect.any(Object),
      );
    });
  });

  describe('Last record', () => {
    it('canGoNext is false at the last record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
        wrapper,
      });

      expect(result.current.canGoNext).toBe(false);
    });

    it('canGoPrevious is true at the last record (when more records exist)', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
        wrapper,
      });

      expect(result.current.canGoPrevious).toBe(true);
    });

    it('goNext does not navigate when at the last record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
        wrapper,
      });

      act(() => {
        result.current.goNext();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('goPrevious navigates to the second-to-last record from the last', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-3'), {
        wrapper,
      });

      act(() => {
        result.current.goPrevious();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('cert-2'),
        expect.any(Object),
      );
    });
  });

  describe('Middle record', () => {
    it('both canGoPrevious and canGoNext are true for a middle record', () => {
      mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

      const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
        wrapper,
      });

      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.canGoNext).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Invalid Current ID
// ---------------------------------------------------------------------------

describe('Invalid Current ID', () => {
  it('currentIndex is -1 when currentId is not in the ids array', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    expect(result.current.currentIndex).toBe(-1);
  });

  it('canGoPrevious is false when currentId is not in the ids array', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    expect(result.current.canGoPrevious).toBe(false);
  });

  it('canGoNext is false when currentId is not in the ids array', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    expect(result.current.canGoNext).toBe(false);
  });

  it('total still reflects the number of IDs in context even with invalid currentId', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    expect(result.current.total).toBe(3);
  });

  it('goNext does not navigate when currentId is not in the ids array', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    act(() => {
      result.current.goNext();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('goPrevious does not navigate when currentId is not in the ids array', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    act(() => {
      result.current.goPrevious();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('context is still populated with the ids from URL even when currentId is invalid', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-999'), {
      wrapper,
    });

    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.ids).toEqual(['cert-1', 'cert-2', 'cert-3']);
  });
});

// ---------------------------------------------------------------------------
// 5. Context Reconstruction Failure
// ---------------------------------------------------------------------------

describe('Context Reconstruction Failure', () => {
  it('returns null context when ids param is an empty string', () => {
    mockSearchParams.set('ids', '');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
  });

  it('filters out empty segments from a malformed ids param', () => {
    mockSearchParams.set('ids', 'cert-1,,cert-2,');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context?.ids).toEqual(['cert-1', 'cert-2']);
  });

  it('returns null context when ids param contains only commas', () => {
    mockSearchParams.set('ids', ',,,');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
  });

  it('returns null context when ids param is absent entirely', () => {
    // No ids param set at all
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    expect(result.current.context).toBeNull();
    expect(result.current.total).toBe(0);
    expect(result.current.currentIndex).toBe(-1);
  });

  it('initializeFromURL resolves without error when no context exists in URL', async () => {
    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    await act(async () => {
      await result.current.initializeFromURL();
    });

    // Should not throw; isLoading should be false after resolution
    expect(result.current.isLoading).toBe(false);
  });

  it('initializeFromURL sets context from URL when valid params exist', async () => {
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
    mockSearchParams.set('current', 'cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-2'), {
      wrapper,
    });

    await act(async () => {
      await result.current.initializeFromURL();
    });

    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.ids).toEqual(['cert-1', 'cert-2', 'cert-3']);
    expect(result.current.isLoading).toBe(false);
  });

  it('onNavigationError is called with invalid_context when updateContext receives empty array', () => {
    const onNavigationError = vi.fn();
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(
      () => useAdminNavigation('certifications', 'cert-1', { onNavigationError }),
      { wrapper },
    );

    act(() => {
      result.current.updateContext([]);
    });

    expect(onNavigationError).toHaveBeenCalledWith(
      'invalid_context',
      'All records removed. Returning to list.',
    );
  });

  it('error state is set when context becomes invalid via empty updateContext', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.updateContext([]);
    });

    expect(result.current.error).toBe('invalid_context');
  });

  it('clearError resets error state after a reconstruction failure', () => {
    mockSearchParams.set('ids', 'cert-1,cert-2');

    const { result } = renderHook(() => useAdminNavigation('certifications', 'cert-1'), {
      wrapper,
    });

    act(() => {
      result.current.updateContext([]);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
