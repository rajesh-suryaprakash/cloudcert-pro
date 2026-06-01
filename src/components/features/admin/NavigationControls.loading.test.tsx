/**
 * Unit Tests for NavigationControls Loading States
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NavigationControls from './NavigationControls';

// ---------------------------------------------------------------------------
// Test: Loading indicator display
// Validates: Requirement 5.1 - Display loading indicator during navigation
// ---------------------------------------------------------------------------

describe('Loading indicator display', () => {
  it('displays loading spinner when isLoading is true', () => {
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

  it('does not display loading spinner when isLoading is false', () => {
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

  it('displays loading spinner at first record', () => {
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

    const spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays loading spinner at last record', () => {
    render(
      <NavigationControls
        currentIndex={2}
        total={3}
        canGoPrevious={true}
        canGoNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    const spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays position indicator alongside loading spinner', () => {
    render(
      <NavigationControls
        currentIndex={1}
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
    expect(screen.getByText('Record 2 of 5')).toBeInTheDocument();
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
});

// ---------------------------------------------------------------------------
// Test: Buttons disabled during loading
// Validates: Requirement 5.3 - Disable buttons during navigation transition
// ---------------------------------------------------------------------------

describe('Buttons disabled during loading', () => {
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

  it('enables Previous button when isLoading is false and canGoPrevious is true', () => {
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
    expect(prevButton).not.toBeDisabled();
  });

  it('enables Next button when isLoading is false and canGoNext is true', () => {
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

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('keeps Previous button disabled when at first record even if not loading', () => {
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
    expect(prevButton).toBeDisabled();
  });

  it('keeps Next button disabled when at last record even if not loading', () => {
    render(
      <NavigationControls
        currentIndex={2}
        total={3}
        canGoPrevious={true}
        canGoNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={false}
      />,
    );

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
  });

  it('disables buttons during loading even when at boundaries', () => {
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

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('has correct aria-disabled attribute when loading', () => {
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

    expect(prevButton).toHaveAttribute('aria-disabled', 'true');
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');
  });
});

// ---------------------------------------------------------------------------
// Test: Loading state transitions
// Validates: Requirement 5.1, 5.3 - Smooth loading state transitions
// ---------------------------------------------------------------------------

describe('Loading state transitions', () => {
  it('transitions from not loading to loading state', () => {
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

  it('transitions from loading to not loading state', () => {
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

    // Initially spinner present
    let status = screen.getByRole('status');
    let spinner = status.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Rerender without loading
    rerender(
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

    // Spinner should be gone
    status = screen.getByRole('status');
    spinner = status.querySelector('svg.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  it('maintains position indicator during loading state changes', () => {
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

    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();

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

    // Position should still be visible
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('updates position when navigating with loading state', () => {
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

    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();

    // Simulate navigation to next record (optimistic update)
    rerender(
      <NavigationControls
        currentIndex={2}
        total={3}
        canGoPrevious={true}
        canGoNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />,
    );

    // Position should update even while loading
    expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test: Edge cases with loading states
// ---------------------------------------------------------------------------

describe('Edge cases with loading states', () => {
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

  it('handles loading state when keyboard hints are hidden', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
        showKeyboardHints={false}
      />,
    );

    // Should show loading spinner
    const spinner = screen.getByRole('status').querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Should not show keyboard hints
    expect(screen.queryByText(/keyboard/i)).not.toBeInTheDocument();
  });
});
