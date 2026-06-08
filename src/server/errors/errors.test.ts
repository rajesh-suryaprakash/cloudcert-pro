import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AppError } from './AppError';
import { NotFoundError, UnauthorizedError, ForbiddenError, ValidationError } from './index';

/**
 * Feature: enterprise-structure, Property 1: AppError preserves statusCode and message
 * Validates: Requirements 6.1, 6.2
 */
describe('AppError correctness properties', () => {
  it('Property 1: AppError preserves statusCode and message', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const err = new AppError(statusCode, message);
          expect(err.statusCode).toBe(statusCode);
          expect(err.message).toBe(message);
          expect(err instanceof Error).toBe(true);
          expect(err instanceof AppError).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1 (subclasses): fixed-status subclasses always carry the correct HTTP status code', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        expect(new NotFoundError(message).statusCode).toBe(404);
        expect(new UnauthorizedError(message).statusCode).toBe(401);
        expect(new ForbiddenError(message).statusCode).toBe(403);
        expect(new ValidationError(message).statusCode).toBe(400);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1 (subclass instanceof): subclasses are instances of AppError', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        expect(new NotFoundError(message) instanceof AppError).toBe(true);
        expect(new UnauthorizedError(message) instanceof AppError).toBe(true);
        expect(new ForbiddenError(message) instanceof AppError).toBe(true);
        expect(new ValidationError(message) instanceof AppError).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
