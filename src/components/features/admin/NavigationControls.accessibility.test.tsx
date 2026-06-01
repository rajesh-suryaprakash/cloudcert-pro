import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavigationControls from './NavigationControls';

/**
 * Accessibility Tests for NavigationControls Component
 *
 * Tests ARIA labels, roles, keyboard navigation, focus management,
 * and screen reader compatibility for the admin detail navigation system.
 *
 * Requirements: 1.1, 6.1, 6.2
 */
describe('NavigationControls - Accessibility Tests', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ARIA Labels and Roles', () => {
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

      const navigationContainer = screen.getByRole('navigation');
      expect(navigationContainer).toBeInTheDocument();
      expect(navigationContainer).toHaveAttribute('aria-label', 'Record navigation');
    });

    it('should have descriptive aria-label on Previous button when enabled', () => {
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
      expect(previousButton).toBeInTheDocument();
      expect(previousButton).toHaveAttribute('aria-label', 'Navigate to previous record');
    });

    it('should have descriptive aria-label on Next button when enabled', () => {
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
      expect(nextButton).toHaveAttribute('aria-label', 'Navigate to next record');
    });

    it('should have descriptive aria-label on Previous button when disabled at first record', () => {
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

      const previousButton = screen.getByRole('button', {
        name: /navigate to previous record.*disabled.*first record/i,
      });
      expect(previousButton).toBeInTheDocument();
      expect(previousButton).toHaveAttribute(
        'aria-label',
        'Navigate to previous record (disabled, at first record)',
      );
    });

    it('should have descriptive aria-label on Next button when disabled at last record', () => {
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

      const nextButton = screen.getByRole('button', {
        name: /navigate to next record.*disabled.*last record/i,
      });
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveAttribute(
        'aria-label',
        'Navigate to next record (disabled, at last record)',
      );
    });

    it('should have aria-disabled attribute on disabled buttons', () => {
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

      expect(previousButton).toHaveAttribute('aria-disabled', 'true');
      expect(nextButton).toHaveAttribute('aria-disabled', 'false');
    });

    it('should have aria-hidden="true" on decorative icons', () => {
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

      // Check that chevron icons have aria-hidden
      const chevronIcons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(chevronIcons.length).toBeGreaterThanOrEqual(2); // At least Previous and Next chevrons
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
      expect(statusRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have proper aria-label on keyboard hints', () => {
      render(
        <NavigationControls
          currentIndex={1}
          total={3}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
          showKeyboardHints={true}
        />,
      );

      const keyboardHint = screen.getByLabelText('Use left and right arrow keys to navigate');
      expect(keyboardHint).toBeInTheDocument();
      expect(keyboardHint).toHaveTextContent('Keyboard: ← →');
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators on buttons', () => {
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

      // Check that buttons have focus ring classes
      expect(previousButton).toHaveClass(
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-indigo-500',
        'focus:ring-offset-2',
      );
      expect(nextButton).toHaveClass(
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-indigo-500',
        'focus:ring-offset-2',
      );
    });

    it('should be keyboard navigable with Tab key', async () => {
      const user = userEvent.setup();

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

      // Tab to first button
      await user.tab();
      expect(previousButton).toHaveFocus();

      // Tab to second button
      await user.tab();
      expect(nextButton).toHaveFocus();
    });

    it('should skip disabled buttons in tab navigation', async () => {
      const user = userEvent.setup();

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

      // Tab should skip disabled Previous button and go to Next button
      await user.tab();
      expect(nextButton).toHaveFocus();
      expect(previousButton).not.toHaveFocus();
    });

    it('should maintain focus on button after click', async () => {
      const user = userEvent.setup();

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

      // Focus and click the button
      await user.click(nextButton);

      expect(mockOnNext).toHaveBeenCalledTimes(1);
      expect(nextButton).toHaveFocus();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should trigger Previous action when Enter is pressed on Previous button', async () => {
      const user = userEvent.setup();

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

      // Focus the button and press Enter (without clicking first)
      previousButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    });

    it('should trigger Next action when Enter is pressed on Next button', async () => {
      const user = userEvent.setup();

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

      // Focus the button and press Enter (without clicking first)
      nextButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should trigger Previous action when Space is pressed on Previous button', async () => {
      const user = userEvent.setup();

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

      // Focus the button and press Space (without clicking first)
      previousButton.focus();
      await user.keyboard(' ');

      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    });

    it('should trigger Next action when Space is pressed on Next button', async () => {
      const user = userEvent.setup();

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

      // Focus the button and press Space (without clicking first)
      nextButton.focus();
      await user.keyboard(' ');

      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should not trigger actions on disabled buttons with keyboard', async () => {
      const user = userEvent.setup();

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

      // Try to focus and activate disabled button
      previousButton.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');

      expect(mockOnPrevious).not.toHaveBeenCalled();
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should announce position changes through aria-live region', () => {
      const { rerender } = render(
        <NavigationControls
          currentIndex={0}
          total={5}
          canGoPrevious={false}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveTextContent('Record 1 of 5');

      // Simulate navigation to next record
      rerender(
        <NavigationControls
          currentIndex={1}
          total={5}
          canGoPrevious={true}
          canGoNext={true}
          onPrevious={mockOnPrevious}
          onNext={mockOnNext}
        />,
      );

      expect(statusRegion).toHaveTextContent('Record 2 of 5');
    });

    it('should provide context about button state in aria-label', () => {
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

      const previousButton = screen.getByRole('button', {
        name: /navigate to previous record.*disabled.*first record/i,
      });
      const nextButton = screen.getByRole('button', {
        name: /navigate to next record.*disabled.*last record/i,
      });

      expect(previousButton).toHaveAttribute(
        'aria-label',
        'Navigate to previous record (disabled, at first record)',
      );
      expect(nextButton).toHaveAttribute(
        'aria-label',
        'Navigate to next record (disabled, at last record)',
      );
    });

    it('should announce loading state through aria-live region', () => {
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

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toBeInTheDocument();

      // Loading spinner should be present and have aria-hidden
      const loadingSpinner = document.querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
      expect(loadingSpinner).toHaveAttribute('aria-hidden', 'true');
    });

    it('should provide meaningful text content for screen readers', () => {
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

      // Check that all text content is meaningful
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Record 3 of 10')).toBeInTheDocument();
      expect(screen.getByText('Keyboard: ← →')).toBeInTheDocument();
    });

    it('should not have empty or meaningless aria-labels', () => {
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

      const allElementsWithAriaLabel = document.querySelectorAll('[aria-label]');

      allElementsWithAriaLabel.forEach((element) => {
        const ariaLabel = element.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect((ariaLabel ?? '').trim().length).toBeGreaterThan(0);
        expect(ariaLabel).not.toBe(' ');
        expect(ariaLabel).not.toBe('');
      });
    });
  });

  describe('Edge Cases - Accessibility', () => {
    it('should handle empty context gracefully for screen readers', () => {
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

      const message = screen.getByText('No records available for navigation');
      expect(message).toBeInTheDocument();

      // Should not have navigation role when empty
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('should provide appropriate context for single record', () => {
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
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();

      // Both buttons should be disabled and have appropriate labels
      const previousButton = screen.getByRole('button', {
        name: /navigate to previous record.*disabled.*first record/i,
      });
      const nextButton = screen.getByRole('button', {
        name: /navigate to next record.*disabled.*last record/i,
      });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should maintain accessibility during loading transitions', () => {
      const { rerender } = render(
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

      // Start loading
      rerender(
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

      expect(previousButton).toHaveAttribute('aria-disabled', 'true');
      expect(nextButton).toHaveAttribute('aria-disabled', 'true');

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });
  });
});
