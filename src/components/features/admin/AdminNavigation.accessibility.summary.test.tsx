import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavigationControls from './NavigationControls';
import { useKeyboardNavigation } from '../../../hooks/useKeyboardNavigation';

/**
 * Accessibility Summary Tests for Admin Detail Navigation
 *
 * This test suite validates the key accessibility requirements for the
 * admin detail navigation system as specified in Task 19.3:
 *
 * - ARIA labels presence on navigation controls
 * - Keyboard navigation functionality (arrow keys)
 * - Focus management and indicators
 * - Screen reader compatibility
 *
 * Requirements: 1.1, 6.1, 6.2
 */
describe('Admin Navigation - Accessibility Summary Tests', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up DOM to avoid interference between tests
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up DOM after each test
    document.body.innerHTML = '';
  });

  describe('ARIA Labels and Roles - Requirements 1.1, 6.1, 6.2', () => {
    it('should have proper ARIA structure for navigation controls', () => {
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

      // Test navigation container has proper role and label
      const navigationContainer = screen.getByRole('navigation');
      expect(navigationContainer).toBeInTheDocument();
      expect(navigationContainer).toHaveAttribute('aria-label', 'Record navigation');

      // Test buttons have descriptive ARIA labels
      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).toHaveAttribute('aria-label', 'Navigate to previous record');
      expect(nextButton).toHaveAttribute('aria-label', 'Navigate to next record');

      // Test aria-disabled attributes
      expect(previousButton).toHaveAttribute('aria-disabled', 'false');
      expect(nextButton).toHaveAttribute('aria-disabled', 'false');

      // Test aria-live region for screen reader announcements
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('should provide contextual ARIA labels for disabled buttons', () => {
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
      expect(previousButton).toHaveAttribute(
        'aria-label',
        'Navigate to previous record (disabled, at first record)',
      );
      expect(previousButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have aria-hidden on decorative icons', () => {
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
      expect(chevronIcons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Keyboard Navigation - Requirements 6.1, 6.2', () => {
    it('should support arrow key navigation when enabled', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Test Left Arrow triggers Previous
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);

      // Test Right Arrow triggers Next
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should prevent default behavior for arrow keys', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventDefaultSpy = vi.spyOn(leftArrowEvent, 'preventDefault');

      fireEvent(window, leftArrowEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not trigger navigation when input elements have focus', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Create events with input as target
      const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      Object.defineProperty(leftArrowEvent, 'target', { value: input, enumerable: true });

      window.dispatchEvent(leftArrowEvent);

      expect(mockOnPrevious).not.toHaveBeenCalled();
    });

    it('should support Enter and Space key activation on buttons', async () => {
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

      // Test Enter key
      previousButton.focus();
      await user.keyboard('{Enter}');
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);

      // Test Space key
      await user.keyboard(' ');
      expect(mockOnPrevious).toHaveBeenCalledTimes(2);
    });
  });

  describe('Focus Management - Requirements 6.1, 6.2', () => {
    it('should have visible focus indicators', () => {
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

      // Check focus ring classes are present
      expect(previousButton).toHaveClass('focus:ring-2', 'focus:ring-indigo-500');
      expect(nextButton).toHaveClass('focus:ring-2', 'focus:ring-indigo-500');
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

      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      // Tab should skip disabled Previous button and go to Next button
      await user.tab();
      expect(nextButton).toHaveFocus();
    });
  });

  describe('Screen Reader Compatibility - Requirements 1.1, 6.1, 6.2', () => {
    it('should announce position through aria-live region', () => {
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

    it('should announce loading states appropriately', () => {
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

      // Loading spinner should have aria-hidden
      const loadingSpinner = document.querySelector('.animate-spin');
      expect(loadingSpinner).toHaveAttribute('aria-hidden', 'true');

      // Buttons should be disabled and have aria-disabled
      const previousButton = screen.getByRole('button', { name: /navigate to previous record/i });
      const nextButton = screen.getByRole('button', { name: /navigate to next record/i });

      expect(previousButton).toHaveAttribute('aria-disabled', 'true');
      expect(nextButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Edge Cases - Accessibility', () => {
    it('should handle empty context gracefully', () => {
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

      // Both buttons should be disabled with appropriate labels
      const previousButton = screen.getByRole('button', {
        name: /navigate to previous record.*disabled.*first record/i,
      });
      const nextButton = screen.getByRole('button', {
        name: /navigate to next record.*disabled.*last record/i,
      });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
      expect(previousButton).toHaveAttribute('aria-disabled', 'true');
      expect(nextButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should disable keyboard navigation for single record context', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
          isSingleRecord: true,
        }),
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts Accessibility', () => {
    it('should provide keyboard shortcut hints with proper labeling', () => {
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

    it('should not interfere with screen reader navigation keys', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Common screen reader keys should not trigger navigation
      const screenReaderKeys = ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Space'];

      screenReaderKeys.forEach((key) => {
        const event = new KeyboardEvent('keydown', { key });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        fireEvent(window, event);

        // Should not prevent default for non-navigation keys
        expect(preventDefaultSpy).not.toHaveBeenCalled();
      });

      // Navigation should not be triggered
      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });
  });
});
