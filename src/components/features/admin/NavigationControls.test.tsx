import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NavigationControls from './NavigationControls';

describe('NavigationControls - Edge Cases', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Context', () => {
    it('should display "No records available" message when total is 0', () => {
      render(
        <NavigationControls
          currentIndex={-1}
          total={0}
          canGoPrevious={false}
          canGoNext={false}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(screen.getByText('No records available for navigation')).toBeInTheDocument();
    });

    it('should not render navigation buttons when total is 0', () => {
      render(
        <NavigationControls
          currentIndex={-1}
          total={0}
          canGoPrevious={false}
          canGoNext={false}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });
  });

  describe('Single Record Context', () => {
    it('should display "1 of 1" for single record', () => {
      render(
        <NavigationControls
          currentIndex={0}
          total={1}
          canGoPrevious={false}
          canGoNext={false}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });

    it('should disable both Previous and Next buttons for single record', () => {
      render(
        <NavigationControls
          currentIndex={0}
          total={1}
          canGoPrevious={false}
          canGoNext={false}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should display "Single record" hint instead of keyboard shortcuts for single record', () => {
      render(
        <NavigationControls
          currentIndex={0}
          total={1}
          canGoPrevious={false}
          canGoNext={false}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(screen.getByText('Single record')).toBeInTheDocument();
      expect(screen.queryByText('Keyboard: ← →')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Records Context', () => {
    it('should display keyboard shortcuts for multiple records', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(screen.getByText('Keyboard: ← →')).toBeInTheDocument();
      expect(screen.queryByText('Single record')).not.toBeInTheDocument();
    });

    it('should enable both buttons when in middle of sequence', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });

    it('should disable Previous button at first record', () => {
      render(
        <NavigationControls
          currentIndex={0}
          total={3}
          canGoPrevious={false}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });

    it('should disable Next button at last record', () => {
      render(
        <NavigationControls
          currentIndex={2}
          total={3}
          canGoPrevious={true}
          canGoNext={false}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).not.toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should disable both buttons when loading', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
          isLoading={true}
        />,
      );

      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should display loading spinner when loading', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
          isLoading={true}
        />,
      );

      // Check for loading spinner (animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Keyboard Hints', () => {
    it('should hide keyboard hints when showKeyboardHints is false', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
          showKeyboardHints={false}
        />,
      );

      expect(screen.queryByText('Keyboard: ← →')).not.toBeInTheDocument();
    });

    it('should show keyboard hints by default', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(screen.getByText('Keyboard: ← →')).toBeInTheDocument();
    });
  });
});

describe('NavigationControls - Button Click Handlers', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onPrevious when Previous button is clicked', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /navigate to previous record/i }));
    expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('should call onNext when Next button is clicked', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /navigate to next record/i }));
    expect(mockOnNext).toHaveBeenCalledTimes(1);
    expect(mockOnPrevious).not.toHaveBeenCalled();
  });

  it('should not call onPrevious when Previous button is disabled', () => {
    render(
      <NavigationControls
        currentIndex={0}
        total={3}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /navigate to previous record/i }));
    expect(mockOnPrevious).not.toHaveBeenCalled();
  });

  it('should not call onNext when Next button is disabled', () => {
    render(
      <NavigationControls
        currentIndex={2}
        total={3}
        canGoPrevious={true}
        canGoNext={false}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /navigate to next record/i }));
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('should not call handlers when loading', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        isLoading={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /navigate to previous record/i }));
    fireEvent.click(screen.getByRole('button', { name: /navigate to next record/i }));
    expect(mockOnPrevious).not.toHaveBeenCalled();
    expect(mockOnNext).not.toHaveBeenCalled();
  });
});

describe('NavigationControls - Position Indicator Formatting', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  it('should display "Record 1 of 15" for first record in 15', () => {
    render(
      <NavigationControls
        currentIndex={0}
        total={15}
        canGoPrevious={false}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    expect(screen.getByText('Record 1 of 15')).toBeInTheDocument();
  });

  it('should display "Record 3 of 15" for third record in 15', () => {
    render(
      <NavigationControls
        currentIndex={2}
        total={15}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    expect(screen.getByText('Record 3 of 15')).toBeInTheDocument();
  });

  it('should display "Record 15 of 15" for last record in 15', () => {
    render(
      <NavigationControls
        currentIndex={14}
        total={15}
        canGoPrevious={true}
        canGoNext={false}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    expect(screen.getByText('Record 15 of 15')).toBeInTheDocument();
  });

  it('should use 1-based index in position display', () => {
    render(
      <NavigationControls
        currentIndex={4}
        total={10}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    // currentIndex is 0-based (4), so display should show 5
    expect(screen.getByText('Record 5 of 10')).toBeInTheDocument();
  });

  it('should have aria-live region for position announcements', () => {
    render(
      <NavigationControls
        currentIndex={2}
        total={10}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });
});

describe('NavigationControls - Accessibility', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  it('should have role="navigation" on the container', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should have descriptive aria-label on Previous button', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeInTheDocument();
  });

  it('should have descriptive aria-label on Next button', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
      />,
    );

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeInTheDocument();
  });

  it('should not show loading spinner when not loading', () => {
    render(
      <NavigationControls
        currentIndex={1}
        total={3}
        canGoPrevious={true}
        canGoNext={true}
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        isLoading={false}
      />,
    );

    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
  });
});
