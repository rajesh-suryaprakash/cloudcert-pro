import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, fireEvent } from '@testing-library/react';
import { useKeyboardNavigation } from './useKeyboardNavigation';

/**
 * Accessibility Tests for useKeyboardNavigation Hook
 *
 * Tests keyboard navigation functionality, focus management,
 * and accessibility compliance for arrow key navigation.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
describe('useKeyboardNavigation - Accessibility Tests', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any event listeners
    document.body.innerHTML = '';
  });

  describe('Arrow Key Navigation', () => {
    it('should trigger Previous action when Left Arrow key is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('should trigger Next action when Right Arrow key is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnNext).toHaveBeenCalledTimes(1);
      expect(mockOnPrevious).not.toHaveBeenCalled();
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
      const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      const preventDefaultSpy1 = vi.spyOn(leftArrowEvent, 'preventDefault');
      const preventDefaultSpy2 = vi.spyOn(rightArrowEvent, 'preventDefault');

      fireEvent(window, leftArrowEvent);
      fireEvent(window, rightArrowEvent);

      expect(preventDefaultSpy1).toHaveBeenCalled();
      expect(preventDefaultSpy2).toHaveBeenCalled();
    });

    it('should not trigger navigation when disabled', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: false,
        }),
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('should not trigger navigation for single record context', () => {
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

  describe('Focus Management and Input Detection', () => {
    it('should not trigger navigation when input field has focus', () => {
      // Create an input element and focus it
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Create keyboard events with the input as target
      const leftArrowEvent = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });
      const rightArrowEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });

      // Override the target property to simulate the event coming from input
      Object.defineProperty(leftArrowEvent, 'target', {
        value: input,
        enumerable: true,
      });
      Object.defineProperty(rightArrowEvent, 'target', {
        value: input,
        enumerable: true,
      });

      // Dispatch events on window (as the hook listens to window)
      window.dispatchEvent(leftArrowEvent);
      window.dispatchEvent(rightArrowEvent);

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('should not trigger navigation when textarea has focus', () => {
      // Create a textarea element and focus it
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Create keyboard events with the textarea as target
      const leftArrowEvent = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });
      const rightArrowEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });

      // Override the target property to simulate the event coming from textarea
      Object.defineProperty(leftArrowEvent, 'target', {
        value: textarea,
        enumerable: true,
      });
      Object.defineProperty(rightArrowEvent, 'target', {
        value: textarea,
        enumerable: true,
      });

      // Dispatch events on window (as the hook listens to window)
      window.dispatchEvent(leftArrowEvent);
      window.dispatchEvent(rightArrowEvent);

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('should not trigger navigation when contentEditable element has focus', () => {
      // Create a contentEditable element and focus it
      const editableDiv = document.createElement('div');
      editableDiv.contentEditable = 'true';
      document.body.appendChild(editableDiv);
      editableDiv.focus();

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Create keyboard events with the contentEditable as target
      const leftArrowEvent = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });
      const rightArrowEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });

      // Override the target property to simulate the event coming from contentEditable
      // Note: isContentEditable should be true when contentEditable="true"
      const mockTarget = {
        ...editableDiv,
        tagName: 'DIV',
        isContentEditable: true, // This is the key property the hook checks
      };

      Object.defineProperty(leftArrowEvent, 'target', {
        value: mockTarget,
        enumerable: true,
      });
      Object.defineProperty(rightArrowEvent, 'target', {
        value: mockTarget,
        enumerable: true,
      });

      // Dispatch events on window (as the hook listens to window)
      window.dispatchEvent(leftArrowEvent);
      window.dispatchEvent(rightArrowEvent);

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('should trigger navigation when non-input element has focus', () => {
      // Create a button element and focus it
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Simulate arrow key press - should work since button is not an input
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should trigger navigation when document body has focus', () => {
      // Focus the document body
      document.body.focus();

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should only respond to ArrowLeft and ArrowRight keys', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Test various keys that should not trigger navigation
      const nonNavigationKeys = [
        'ArrowUp',
        'ArrowDown',
        'Enter',
        'Space',
        'Tab',
        'Escape',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'a',
        'A',
        '1',
        'Shift',
        'Control',
        'Alt',
      ];

      nonNavigationKeys.forEach((key) => {
        fireEvent.keyDown(window, { key });
      });

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();

      // Now test the correct keys
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid key presses without issues', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Simulate rapid key presses
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      }

      expect(mockOnPrevious).toHaveBeenCalledTimes(10);
      expect(mockOnNext).toHaveBeenCalledTimes(10);
    });

    it('should handle modifier keys correctly', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Test arrow keys with modifier keys - should still work
      fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true });
      fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
      fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });

      expect(mockOnPrevious).toHaveBeenCalledTimes(2);
      expect(mockOnNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Listener Management', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should update event listeners when callbacks change', () => {
      const newMockOnPrevious = vi.fn();
      const newMockOnNext = vi.fn();

      const { rerender } = renderHook(
        ({ onPrevious, onNext }) =>
          useKeyboardNavigation({
            onPrevious,
            onNext,
            enabled: true,
          }),
        {
          initialProps: {
            onPrevious: mockOnPrevious,
            onNext: mockOnNext,
          },
        },
      );

      // Test with initial callbacks
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);

      // Update callbacks
      rerender({
        onPrevious: newMockOnPrevious,
        onNext: newMockOnNext,
      });

      // Test with new callbacks
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(newMockOnPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnPrevious).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should update event listeners when enabled state changes', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useKeyboardNavigation({
            onPrevious: mockOnPrevious,
            onNext: mockOnNext,
            enabled,
          }),
        {
          initialProps: { enabled: true },
        },
      );

      // Test when enabled
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);

      // Disable
      rerender({ enabled: false });

      // Test when disabled
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1); // Should not increase

      // Re-enable
      rerender({ enabled: true });

      // Test when re-enabled
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(2); // Should increase
    });
  });

  describe('Accessibility Compliance', () => {
    it('should not interfere with screen reader navigation keys', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Common screen reader navigation keys that should not be affected
      const screenReaderKeys = [
        'ArrowUp',
        'ArrowDown',
        'Tab',
        'Enter',
        'Space',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ];

      screenReaderKeys.forEach((key) => {
        const event = new KeyboardEvent('keydown', { key });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        fireEvent(window, event);

        // Should not prevent default for non-navigation keys
        expect(preventDefaultSpy).not.toHaveBeenCalled();
      });
    });

    it('should work with assistive technology focus management', () => {
      // Create elements that might be focused by assistive technology
      const focusableElements = [
        document.createElement('button'),
        document.createElement('a'),
        document.createElement('div'), // with tabindex
      ];

      focusableElements[2].setAttribute('tabindex', '0');

      focusableElements.forEach((element) => {
        document.body.appendChild(element);
      });

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Test navigation works when these elements have focus
      focusableElements.forEach((element) => {
        element.focus();
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
      });

      expect(mockOnPrevious).toHaveBeenCalledTimes(focusableElements.length);
    });

    it('should respect ARIA attributes and roles', () => {
      // Create elements with ARIA attributes
      const ariaElements = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];

      ariaElements[0].setAttribute('role', 'button');
      ariaElements[1].setAttribute('role', 'link');
      ariaElements[2].setAttribute('aria-label', 'Navigation control');

      ariaElements.forEach((element) => {
        document.body.appendChild(element);
      });

      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: true,
        }),
      );

      // Navigation should work regardless of ARIA attributes
      ariaElements.forEach((element) => {
        element.focus();
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      });

      expect(mockOnNext).toHaveBeenCalledTimes(ariaElements.length);
    });
  });

  describe('Integration with Modal and Dialog States', () => {
    it('should be disabled when modal is indicated to be open', () => {
      renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: false, // This would be set to false when modal is open
        }),
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnPrevious).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    it('should handle dynamic enable/disable based on UI state', () => {
      let isModalOpen = false;
      let isEditMode = false;

      const { rerender } = renderHook(() =>
        useKeyboardNavigation({
          onPrevious: mockOnPrevious,
          onNext: mockOnNext,
          enabled: !isModalOpen && !isEditMode,
        }),
      );

      // Initially enabled
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);

      // Open modal
      isModalOpen = true;
      rerender();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1); // Should not increase

      // Close modal, enter edit mode
      isModalOpen = false;
      isEditMode = true;
      rerender();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(1); // Should not increase

      // Exit edit mode
      isEditMode = false;
      rerender();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(mockOnPrevious).toHaveBeenCalledTimes(2); // Should increase
    });
  });
});
