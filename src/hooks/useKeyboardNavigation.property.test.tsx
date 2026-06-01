/**
 * Property-Based Tests for useKeyboardNavigation hook
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 *
 * These tests verify universal correctness properties of the keyboard navigation
 * hook across all valid inputs using fast-check.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as fc from 'fast-check';
import { useKeyboardNavigation } from './useKeyboardNavigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fires a keydown event on window with the given key and optional target element.
 */
function fireKeyDown(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target, writable: false });
  window.dispatchEvent(event);
}

/**
 * Creates a mock input element with the given tag name.
 */
function createInputElement(tagName: 'INPUT' | 'TEXTAREA'): HTMLElement {
  const el = document.createElement(tagName.toLowerCase()) as HTMLElement;
  document.body.appendChild(el);
  return el;
}

/**
 * Fires a keydown event simulating the active element being an input/textarea.
 */
function fireKeyDownFromInput(key: string, tagName: 'INPUT' | 'TEXTAREA') {
  const el = createInputElement(tagName);
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: el, writable: false });
  window.dispatchEvent(event);
  document.body.removeChild(el);
}

/**
 * Fires a keydown event simulating the active element being a contentEditable element.
 * jsdom does not compute isContentEditable correctly, so we mock it on the element.
 */
function fireKeyDownFromContentEditable(key: string) {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  // jsdom doesn't compute isContentEditable from the attribute, so mock it explicitly
  Object.defineProperty(el, 'isContentEditable', { value: true, writable: false });
  document.body.appendChild(el);
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: el, writable: false });
  window.dispatchEvent(event);
  document.body.removeChild(el);
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generates a non-arrow key string (letters, digits, function keys, etc.)
 * to verify that non-arrow keys do not trigger navigation.
 */
function arbitraryNonArrowKey(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'a',
    'b',
    'z',
    'Enter',
    'Escape',
    'Tab',
    'Backspace',
    'Delete',
    'ArrowUp',
    'ArrowDown',
    'F1',
    'F5',
    ' ',
    '1',
    '9',
  );
}

/**
 * Generates a boolean representing the enabled state.
 */
function arbitraryEnabled(): fc.Arbitrary<boolean> {
  return fc.boolean();
}

// ---------------------------------------------------------------------------
// Property 16: Left Arrow Key Triggers Previous
// Feature: admin-detail-navigation, Property 16: Left Arrow Key Triggers Previous
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------

describe('Property 16: Left Arrow Key Triggers Previous', () => {
  let onPrevious: ReturnType<typeof vi.fn>;
  let onNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPrevious = vi.fn();
    onNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('left arrow triggers onPrevious when enabled is true', () => {
    // **Validates: Requirements 6.1**
    fc.assert(
      fc.property(fc.constant(true), (_enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: true }));

        fireKeyDown('ArrowLeft');

        expect(onPrevious).toHaveBeenCalledTimes(1);
        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('left arrow does NOT trigger onPrevious when enabled is false', () => {
    // **Validates: Requirements 6.1**
    fc.assert(
      fc.property(fc.constant(false), (_enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: false }));

        fireKeyDown('ArrowLeft');

        expect(onPrevious).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('non-arrow keys do not trigger onPrevious', () => {
    // **Validates: Requirements 6.1**
    fc.assert(
      fc.property(arbitraryNonArrowKey(), (key) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: true }));

        fireKeyDown(key);

        expect(onPrevious).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 17: Right Arrow Key Triggers Next
// Feature: admin-detail-navigation, Property 17: Right Arrow Key Triggers Next
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe('Property 17: Right Arrow Key Triggers Next', () => {
  let onPrevious: ReturnType<typeof vi.fn>;
  let onNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPrevious = vi.fn();
    onNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('right arrow triggers onNext when enabled is true', () => {
    // **Validates: Requirements 6.2**
    fc.assert(
      fc.property(fc.constant(true), (_enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: true }));

        fireKeyDown('ArrowRight');

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrevious).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('right arrow does NOT trigger onNext when enabled is false', () => {
    // **Validates: Requirements 6.2**
    fc.assert(
      fc.property(fc.constant(false), (_enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: false }));

        fireKeyDown('ArrowRight');

        expect(onNext).not.toHaveBeenCalled();
        expect(onPrevious).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('non-arrow keys do not trigger onNext', () => {
    // **Validates: Requirements 6.2**
    fc.assert(
      fc.property(arbitraryNonArrowKey(), (key) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: true }));

        fireKeyDown(key);

        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: Keyboard Shortcuts Disabled During Input
// Feature: admin-detail-navigation, Property 18: Keyboard Shortcuts Disabled During Input
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

describe('Property 18: Keyboard Shortcuts Disabled During Input', () => {
  let onPrevious: ReturnType<typeof vi.fn>;
  let onNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPrevious = vi.fn();
    onNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('left arrow does not navigate when an INPUT element is focused', () => {
    // **Validates: Requirements 6.3**
    fc.assert(
      fc.property(arbitraryEnabled(), (enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled }));

        fireKeyDownFromInput('ArrowLeft', 'INPUT');

        expect(onPrevious).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('right arrow does not navigate when an INPUT element is focused', () => {
    // **Validates: Requirements 6.3**
    fc.assert(
      fc.property(arbitraryEnabled(), (enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled }));

        fireKeyDownFromInput('ArrowRight', 'INPUT');

        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('left arrow does not navigate when a TEXTAREA element is focused', () => {
    // **Validates: Requirements 6.3**
    fc.assert(
      fc.property(arbitraryEnabled(), (enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled }));

        fireKeyDownFromInput('ArrowLeft', 'TEXTAREA');

        expect(onPrevious).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('right arrow does not navigate when a TEXTAREA element is focused', () => {
    // **Validates: Requirements 6.3**
    fc.assert(
      fc.property(arbitraryEnabled(), (enabled) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled }));

        fireKeyDownFromInput('ArrowRight', 'TEXTAREA');

        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('arrow keys do not navigate when a contentEditable element is focused', () => {
    // **Validates: Requirements 6.3**
    fc.assert(
      fc.property(
        arbitraryEnabled(),
        fc.constantFrom('ArrowLeft', 'ArrowRight'),
        (enabled, key) => {
          onPrevious = vi.fn();
          onNext = vi.fn();

          renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled }));

          fireKeyDownFromContentEditable(key);

          expect(onPrevious).not.toHaveBeenCalled();
          expect(onNext).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: Keyboard Shortcuts Disabled During Modal
// Feature: admin-detail-navigation, Property 19: Keyboard Shortcuts Disabled During Modal
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------

describe('Property 19: Keyboard Shortcuts Disabled During Modal', () => {
  let onPrevious: ReturnType<typeof vi.fn>;
  let onNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onPrevious = vi.fn();
    onNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('left arrow does not navigate when enabled is false (modal open)', () => {
    // **Validates: Requirements 6.4**
    // The hook's `enabled` prop is set to false when a modal is open.
    fc.assert(
      fc.property(fc.constant(false), (_modalOpen) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: false }));

        fireKeyDown('ArrowLeft');

        expect(onPrevious).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('right arrow does not navigate when enabled is false (modal open)', () => {
    // **Validates: Requirements 6.4**
    fc.assert(
      fc.property(fc.constant(false), (_modalOpen) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: false }));

        fireKeyDown('ArrowRight');

        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });

  it('navigation resumes when modal is closed (enabled transitions false -> true)', () => {
    // **Validates: Requirements 6.4**
    // Verify that once enabled becomes true again, navigation works.
    fc.assert(
      fc.property(fc.constantFrom('ArrowLeft', 'ArrowRight'), (key) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        // Start with modal open (enabled = true, but we re-render with enabled = true)
        const { rerender } = renderHook(
          ({ enabled }: { enabled: boolean }) =>
            useKeyboardNavigation({ onPrevious, onNext, enabled }),
          { initialProps: { enabled: false } },
        );

        fireKeyDown(key);
        expect(onPrevious).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();

        // Modal closed - re-enable
        rerender({ enabled: true });

        fireKeyDown(key);

        if (key === 'ArrowLeft') {
          expect(onPrevious).toHaveBeenCalledTimes(1);
        } else {
          expect(onNext).toHaveBeenCalledTimes(1);
        }
      }),
      { numRuns: 25 },
    );
  });

  it('both arrow keys are blocked when enabled is false regardless of key', () => {
    // **Validates: Requirements 6.4**
    fc.assert(
      fc.property(fc.constantFrom('ArrowLeft', 'ArrowRight'), (key) => {
        onPrevious = vi.fn();
        onNext = vi.fn();

        renderHook(() => useKeyboardNavigation({ onPrevious, onNext, enabled: false }));

        fireKeyDown(key);

        expect(onPrevious).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
      }),
      { numRuns: 25 },
    );
  });
});
