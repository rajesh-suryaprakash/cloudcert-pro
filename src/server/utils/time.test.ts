import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { nowIso, nowMs } from './time';

describe('time utilities', () => {
  // Feature: codebase-refactoring, Property 9: nowIso always returns a parseable ISO date string
  // Validates: Requirements 10.1
  it('Property 9: nowIso always returns a parseable ISO date string', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const result = nowIso();
        const parsed = new Date(result).getTime();
        expect(typeof result).toBe('string');
        expect(parsed).not.toBeNaN();
      }),
      { numRuns: 100 },
    );
  });

  it('nowMs returns a positive integer', () => {
    const ms = nowMs();
    expect(typeof ms).toBe('number');
    expect(ms).toBeGreaterThan(0);
    expect(Number.isInteger(ms)).toBe(true);
  });
});
