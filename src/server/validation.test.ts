import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidEmail, isValidPassword } from './validation';

describe('validation - property tests', () => {
  // Feature: codebase-refactoring, Property 1: Email validator rejects non-email strings
  // Validates: Requirements 2.1
  it('Property 1: rejects strings without @ symbol', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('@')),
        (s) => {
          expect(isValidEmail(s)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1: rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('Property 1: rejects strings with @ but no domain', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !s.includes('@') && !s.includes('.')),
        (local) => {
          // "local@" has no domain
          expect(isValidEmail(`${local}@`)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1: accepts valid email addresses', () => {
    const validEmails = ['user@example.com', 'test.user@domain.org', 'a@b.co'];
    for (const email of validEmails) {
      expect(isValidEmail(email)).toBe(true);
    }
  });

  // Feature: codebase-refactoring, Property 2: Password validator enforces minimum rules
  // Validates: Requirements 2.1
  it('Property 2: rejects passwords shorter than 8 characters', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 7 }), (s) => {
        expect(isValidPassword(s)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 2: rejects passwords with no digits', () => {
    fc.assert(
      fc.property(
        // Generate strings of 8+ chars with only letters (no digits)
        fc
          .array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
            { minLength: 8 },
          )
          .map((chars) => chars.join('')),
        (s) => {
          expect(isValidPassword(s)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 2: accepts passwords with 8+ chars and at least one digit', () => {
    fc.assert(
      fc.property(
        // Generate a string of 7+ letters then append a digit
        fc
          .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 7 })
          .map((chars) => chars.join('')),
        fc.integer({ min: 0, max: 9 }),
        (letters, digit) => {
          const password = letters + digit.toString();
          expect(isValidPassword(password)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
