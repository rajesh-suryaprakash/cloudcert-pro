import { useEffect } from 'react';

interface UseKeyboardNavigationOptions {
  onPrevious: () => void;
  onNext: () => void;
  enabled?: boolean;
  isSingleRecord?: boolean;
}

/**
 * Hook for handling keyboard navigation with arrow keys.
 *
 * - Left arrow triggers Previous action
 * - Right arrow triggers Next action
 * - Automatically disables when input/textarea has focus
 * - Can be manually disabled via enabled prop (e.g., when modal is open)
 * - Disables when only a single record is in context
 *
 * @param options Configuration object with navigation callbacks and enabled state
 */
export function useKeyboardNavigation({
  onPrevious,
  onNext,
  enabled = true,
  isSingleRecord = false,
}: UseKeyboardNavigationOptions) {
  useEffect(() => {
    // Disable keyboard shortcuts for single record context
    if (!enabled || isSingleRecord) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger navigation if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInputFocused) {
        return;
      }

      // Handle arrow key navigation
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount or when dependencies change
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPrevious, onNext, enabled, isSingleRecord]);
}
