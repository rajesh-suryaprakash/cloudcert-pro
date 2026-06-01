import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { API_BASE_URL } from './api';
import { TOKEN_STORAGE_KEY } from './auth';
import { DEFAULT_QUESTION_COUNT, DEFAULT_EXAM_DURATION_MINUTES } from './exam';

// Feature: enterprise-structure, Property 4: Constants modules export expected values
describe('Constants modules export expected values', () => {
  // Validates: Requirements 3.1, 3.2, 3.3
  it('API_BASE_URL equals /api', () => {
    expect(API_BASE_URL).toBe('/api');
  });

  it('TOKEN_STORAGE_KEY equals token', () => {
    expect(TOKEN_STORAGE_KEY).toBe('token');
  });

  it('DEFAULT_QUESTION_COUNT equals 10 and is a positive integer', () => {
    expect(DEFAULT_QUESTION_COUNT).toBe(10);
    expect(Number.isInteger(DEFAULT_QUESTION_COUNT)).toBe(true);
    expect(DEFAULT_QUESTION_COUNT).toBeGreaterThan(0);
  });

  it('DEFAULT_EXAM_DURATION_MINUTES equals 120 and is a positive integer', () => {
    expect(DEFAULT_EXAM_DURATION_MINUTES).toBe(120);
    expect(Number.isInteger(DEFAULT_EXAM_DURATION_MINUTES)).toBe(true);
    expect(DEFAULT_EXAM_DURATION_MINUTES).toBeGreaterThan(0);
  });

  it('property: numeric constants are always positive integers regardless of import context', () => {
    // For any import of these constants, they must be positive integers
    fc.assert(
      fc.property(
        fc.constant(DEFAULT_QUESTION_COUNT),
        fc.constant(DEFAULT_EXAM_DURATION_MINUTES),
        (qCount, duration) => {
          return (
            Number.isInteger(qCount) && qCount > 0 && Number.isInteger(duration) && duration > 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
