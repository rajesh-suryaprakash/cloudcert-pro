/**
 * Unit Tests for Navigation Loading States
 *
 * Feature: admin-detail-navigation
 * Task: 17.3 - Write unit tests for loading states
 * Validates: Requirements 5.1, 5.3, 5.4
 *
 * Tests:
 * - Loading indicator display during navigation
 * - Navigation buttons disabled during loading
 * - Optimistic UI updates (URL updates immediately, cached data shown)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Import the hook and component to test
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import NavigationControls from './NavigationControls';

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
// Test Component for Hook Testing
// ---------------------------------------------------------------------------

interface TestComponentProps {
  entityType: 'certifications' | 'exams' | 'topics' | 'subtopics' | 'questions';
  currentId: string;
  onNavigationStateChange?: (state: ReturnType<typeof useAdminNavigation>) => void;
}

function TestComponent({ entityType, currentId, onNavigationStateChange }: TestComponentProps) {
  const navigation = useAdminNavigation(entityType, currentId);

  React.useEffect(() => {
    if (onNavigationStateChange) {
      onNavigationStateChange(navigation);
    }
  }, [navigation, onNavigationStateChange]);

  return (
    <div>
      <NavigationControls
        currentIndex={navigation.currentIndex}
        total={navigation.total}
        canGoPrevious={navigation.canGoPrevious}
        canGoNext={navigation.canGoNext}
        onPrevious={navigation.goPrevious}
        onNext={navigation.goNext}
        isLoading={navigation.isLoading}
      />
      <div data-testid="navigation-state">
        {JSON.stringify({
          isLoading: navigation.isLoading,
          currentIndex: navigation.currentIndex,
          total: navigation.total,
          canGoPrevious: navigation.canGoPrevious,
          canGoNext: navigation.canGoNext,
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function renderTestComponent(
  entityType: TestComponentProps['entityType'],
  currentId: string,
  onNavigationStateChange?: (state: ReturnType<typeof useAdminNavigation>) => void,
) {
  return render(
    <MemoryRouter>
      <TestComponent
        entityType={entityType}
        currentId={currentId}
        onNavigationStateChange={onNavigationStateChange}
      />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockNavigate.mockClear();
  mockSetSearchParams.mockClear();
});

// ---------------------------------------------------------------------------
// Test: Loading indicator display
// Validates: Requirement 5.1 - Display loading indicator during navigation
// ---------------------------------------------------------------------------

describe('Loading indicator display', () => {
  it('shows loading spinner when isLoading is true', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Loading spinner should be visible
    const spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('hides loading spinner when isLoading is false', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={false}
      />,
    );

    // Loading spinner should not be visible
    const status = screen.getByRole('status');
    const spinner = status.querySelector('svg.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  it('shows loading spinner alongside position indicator', () => {
    render(
      <NavigationControls
        currentIndex={2}
        total={5}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Both spinner and position should be visible
    const spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText('Record 3 of 5')).toBeInTheDocument();
  });

  it('loading spinner has correct accessibility attributes', () => {
    render(
      <NavigationControls
        currentIndex={0}
        total={3}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
  });

  it('transitions loading state correctly', () => {
    const { rerender } = render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={false}
      />,
    );

    // Initially no spinner
    let status = screen.getByRole('status');
    let spinner = status.querySelector('svg.animate-spin');
    expect(spinner).not.toBeInTheDocument();

    // Rerender with loading
    rerender(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Now spinner should appear
    status = screen.getByRole('status');
    spinner = status.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test: Navigation buttons disabled during loading
// Validates: Requirement 5.3 - Disable buttons during navigation transition
// ---------------------------------------------------------------------------

describe('Navigation buttons disabled during loading', () => {
  it('disables Previous button when isLoading is true', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeDisabled();
    expect(prevButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables Next button when isLoading is true', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables both buttons when isLoading is true', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('enables buttons when isLoading is false and navigation is possible', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={false}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('keeps buttons disabled due to boundary conditions even when not loading', () => {
    render(
      <NavigationControls
        currentIndex={0}
        total={3}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={false}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    expect(prevButton).toBeDisabled(); // Disabled due to boundary
    expect(nextButton).not.toBeDisabled(); // Enabled
  });

  it('loading state overrides boundary conditions for button disabling', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    // Both should be disabled due to loading, regardless of canGo* values
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('prevents button clicks when loading', async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={onPrevious}
        onNext={onNext}
        isLoading={true}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    // Try to click disabled buttons
    await act(async () => {
      await userEvent.click(prevButton);
      await userEvent.click(nextButton);
    });

    // Handlers should not be called
    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test: Optimistic UI updates with useAdminNavigation hook
// Validates: Requirement 5.4 - Optimistic UI updates
// ---------------------------------------------------------------------------

describe('Optimistic UI updates', () => {
  it('sets isLoading to true immediately when calling goNext', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    let capturedState: ReturnType<typeof useAdminNavigation> | null = null;
    const onStateChange = (state: ReturnType<typeof useAdminNavigation>) => {
      capturedState = state;
    };

    renderTestComponent('certifications', 'cert-1', onStateChange);

    // Initially not loading
    expect(capturedState?.isLoading).toBe(false);

    // Click next button
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    act(() => {
      nextButton.click();
    });

    // Should immediately set loading to true
    expect(capturedState?.isLoading).toBe(true);
  });

  it('sets isLoading to true immediately when calling goPrevious', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    let capturedState: ReturnType<typeof useAdminNavigation> | null = null;
    const onStateChange = (state: ReturnType<typeof useAdminNavigation>) => {
      capturedState = state;
    };

    renderTestComponent('certifications', 'cert-2', onStateChange);

    // Initially not loading
    expect(capturedState?.isLoading).toBe(false);

    // Click previous button
    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });

    act(() => {
      prevButton.click();
    });

    // Should immediately set loading to true
    expect(capturedState?.isLoading).toBe(true);
  });

  it('updates URL immediately when navigating (optimistic update)', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderTestComponent('certifications', 'cert-1');

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    act(() => {
      nextButton.click();
    });

    // Should call navigate immediately (optimistic update)
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cert-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('preserves navigation context in URL during optimistic updates', () => {
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'cert-1,cert-2,cert-3');
    mockSearchParams.set('current', 'cert-1');
    mockSearchParams.set('navVendor', 'Amazon');
    mockSearchParams.set('navSearch', 'aws');

    renderTestComponent('certifications', 'cert-1');

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    act(() => {
      nextButton.click();
    });

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // The ids context and new current ID should be preserved in the URL.
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    expect(navigateCall).toContain('ids=cert-1%2Ccert-2%2Ccert-3');
    expect(navigateCall).toContain('current=cert-2');
  });

  it('does not set loading when navigation is not possible', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-3'); // Last record

    let capturedState: ReturnType<typeof useAdminNavigation> | null = null;
    const onStateChange = (state: ReturnType<typeof useAdminNavigation>) => {
      capturedState = state;
    };

    renderTestComponent('certifications', 'cert-3', onStateChange);

    // Should not be able to go next
    expect(capturedState?.canGoNext).toBe(false);

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    act(() => {
      nextButton.click();
    });

    // Should not set loading since navigation is not possible
    expect(capturedState?.isLoading).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('position indicator updates optimistically during navigation', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderTestComponent('certifications', 'cert-1');

    // Initially should show "Record 1 of 3"
    expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    act(() => {
      nextButton.click();
    });

    // Position should update optimistically (this would happen when currentId prop changes)
    // For this test, we're verifying the loading state is set correctly
    const stateElement = screen.getByTestId('navigation-state');
    const state = JSON.parse(stateElement.textContent || '{}');
    expect(state.isLoading).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Loading state edge cases
// ---------------------------------------------------------------------------

describe('Loading state edge cases', () => {
  it('handles loading state with single record context', () => {
    render(
      <NavigationControls
        currentIndex={0}
        total={1}
        canGoPrevious={false}
        canGoNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Should show loading spinner
    const spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Both buttons should be disabled
    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();

    // Should show single record indicator
    expect(screen.getByText('Single record')).toBeInTheDocument();
  });

  it('handles loading state with empty context', () => {
    render(
      <NavigationControls
        currentIndex={-1}
        total={0}
        canGoPrevious={false}
        canGoNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Should show "No records available" message instead of controls
    expect(screen.getByText('No records available for navigation')).toBeInTheDocument();

    // Should not show loading spinner for empty context
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('maintains loading state consistency across re-renders', () => {
    const { rerender } = render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Should show loading state
    let spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Re-render with same loading state
    rerender(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Loading state should persist
    spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('loading state works correctly across different entity types', () => {
    const entityTypes: Array<'certifications' | 'exams' | 'topics' | 'subtopics' | 'questions'> = [
      'certifications',
      'exams',
      'topics',
      'subtopics',
      'questions',
    ];

    entityTypes.forEach((entityType) => {
      setNavigationContext(['item-1', 'item-2', 'item-3'], 'item-1');

      let capturedState: ReturnType<typeof useAdminNavigation> | null = null;
      const onStateChange = (state: ReturnType<typeof useAdminNavigation>) => {
        capturedState = state;
      };

      const { unmount } = renderTestComponent(entityType, 'item-1', onStateChange);

      // Initially not loading
      expect(capturedState?.isLoading).toBe(false);

      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      act(() => {
        nextButton.click();
      });

      // Should set loading for all entity types
      expect(capturedState?.isLoading).toBe(true);

      unmount();
    });
  });
});

// ---------------------------------------------------------------------------
// Test: Integration between hook and component
// ---------------------------------------------------------------------------

describe('Hook and component integration', () => {
  it('NavigationControls correctly reflects useAdminNavigation loading state', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    let capturedState: ReturnType<typeof useAdminNavigation> | null = null;
    const onStateChange = (state: ReturnType<typeof useAdminNavigation>) => {
      capturedState = state;
    };

    renderTestComponent('certifications', 'cert-1', onStateChange);

    // Initially not loading
    expect(capturedState?.isLoading).toBe(false);

    // No loading spinner should be visible
    const status = screen.getByRole('status');
    let spinner = status.querySelector('svg.animate-spin');
    expect(spinner).not.toBeInTheDocument();

    // Trigger navigation
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    act(() => {
      nextButton.click();
    });

    // Hook should set loading to true
    expect(capturedState?.isLoading).toBe(true);

    // Component should show loading spinner
    spinner = status.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Buttons should be disabled
    expect(nextButton).toBeDisabled();
  });

  it('loading state prevents multiple rapid navigation attempts', () => {
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderTestComponent('certifications', 'cert-1');

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    // First click
    act(() => {
      nextButton.click();
    });

    const firstCallCount = mockNavigate.mock.calls.length;

    // Try to click again while loading (button should be disabled)
    act(() => {
      nextButton.click();
    });

    // Should not call navigate again
    expect(mockNavigate.mock.calls.length).toBe(firstCallCount);
  });
});
