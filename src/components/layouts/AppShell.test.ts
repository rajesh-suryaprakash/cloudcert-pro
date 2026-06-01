import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getInitials, getAvatarColor } from './AppShell';

describe('getInitials', () => {
  /**
   * Feature: code-quality-hardening, Property 4: For any non-empty name, getInitials returns 1–2 uppercase ASCII letters
   * Validates: Requirements 4.2, 4.3
   */
  it('Property 4: for any non-empty name, returns 1–2 uppercase ASCII letters', () => {
    // Generator: non-empty strings where the first and last whitespace-separated word
    // each contain at least one letter (so getInitials can extract a real initial from each)
    const wordWithLetter = fc
      .array(
        fc.oneof(fc.constantFrom('a', 'b', 'c', 'A', 'B', 'Z', 'x', 'Y'), fc.constantFrom('-')),
        { minLength: 1, maxLength: 8 },
      )
      .map((chars) => chars.join(''))
      .filter((w) => /[A-Za-z]/.test(w));

    const nonEmptyName = fc
      .tuple(
        wordWithLetter,
        fc.array(fc.oneof(wordWithLetter, fc.constantFrom(' ')), { minLength: 0, maxLength: 3 }),
        wordWithLetter,
      )
      .map(([first, middle, last]) =>
        [first, ...middle, last].join(' ').replace(/\s+/g, ' ').trim(),
      )
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(nonEmptyName, (name) => {
        const initials = getInitials(name);
        // Must be 1 or 2 characters
        expect(initials.length).toBeGreaterThanOrEqual(1);
        expect(initials.length).toBeLessThanOrEqual(2);
        // Every character must be an uppercase ASCII letter
        expect(initials).toMatch(/^[A-Z]{1,2}$/);
      }),
      { numRuns: 100 },
    );
  });
});

describe('getAvatarColor', () => {
  /**
   * Feature: code-quality-hardening, Property 5: For any name, getAvatarColor returns the same colour on repeated calls
   * Validates: Requirements 4.4
   */
  it('Property 5: for any name, returns the same colour on repeated calls', () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        const first = getAvatarColor(name);
        const second = getAvatarColor(name);
        expect(first).toBe(second);
      }),
      { numRuns: 100 },
    );
  });
});
