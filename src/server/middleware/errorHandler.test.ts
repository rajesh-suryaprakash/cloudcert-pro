import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { errorHandler } from './errorHandler';
import { logger } from '../logger';

function makeMockRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

/**
 * Feature: enterprise-structure, Property 2: errorHandler responds with AppError's statusCode and message
 * Validates: Requirements 6.3
 */
describe('errorHandler middleware', () => {
  it('Property 2: errorHandler responds with AppError statusCode and message', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const err = new AppError(statusCode, message);
          const req = {} as Request;
          const res = makeMockRes();
          const next = vi.fn() as unknown as NextFunction;

          errorHandler(err, req, res, next);

          expect(res.statusCode).toBe(statusCode);
          expect(res.body).toEqual({ error: message });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 2 (unknown errors): non-AppError errors produce 500 with generic message', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        const err = new Error(message);
        const req = {} as Request;
        const res = makeMockRes();
        const next = vi.fn() as unknown as NextFunction;

        errorHandler(err, req, res, next);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'Internal server error' });
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: enterprise-logging, Property 8: Error handler logs error message and stack as structured fields
 * Validates: Requirements 5.2
 */
describe('errorHandler structured logging (Property 8)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs error message and stack as structured fields at error level for non-AppError', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (message) => {
        errorSpy.mockClear();

        const err = new Error(message);
        const req = { correlationId: 'test-id' } as unknown as Request;
        const res = makeMockRes();
        const next = vi.fn() as unknown as NextFunction;

        errorHandler(err, req, res, next);

        expect(errorSpy).toHaveBeenCalledOnce();
        const [bindings] = errorSpy.mock.calls[0] as [Record<string, unknown>, string];
        expect(bindings.err).toBe(err);
        expect((bindings.err as Error).message).toBe(message);
        expect(typeof (bindings.err as Error).stack).toBe('string');
      }),
      { numRuns: 100 },
    );
  });
});
