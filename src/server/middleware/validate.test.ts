import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from './validate';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: unknown): Request {
  return { body } as Request;
}

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

// ── Schema used in tests ──────────────────────────────────────────────────────

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0).max(150),
});

type TestBody = z.infer<typeof testSchema>;

// ── Property 5: Validation middleware rejects invalid bodies with HTTP 400 ────
// Feature: codebase-refactoring, Property 5: Validation middleware rejects invalid bodies with HTTP 400
// Validates: Requirements 6.1

describe('validate middleware', () => {
  it('Property 5: rejects invalid bodies with HTTP 400 and error field', () => {
    // Generate objects that are guaranteed to fail the testSchema:
    // either missing required fields or wrong types.
    const invalidBodyArb = fc.oneof(
      // empty object — missing both fields
      fc.constant({}),
      // name present but age missing
      fc.record({ name: fc.string({ minLength: 1 }) }),
      // age present but name missing
      fc.record({ age: fc.integer({ min: 0, max: 150 }) }),
      // name is empty string (fails min(1))
      fc.record({ name: fc.constant(''), age: fc.integer({ min: 0, max: 150 }) }),
      // age is a string instead of number
      fc.record({ name: fc.string({ minLength: 1 }), age: fc.string() }),
      // age out of range
      fc.record({ name: fc.string({ minLength: 1 }), age: fc.integer({ min: 151 }) }),
    );

    fc.assert(
      fc.property(invalidBodyArb, (body) => {
        const req = makeReq(body);
        const res = makeMockRes();
        const next = vi.fn() as unknown as NextFunction;

        validate(testSchema)(req, res, next);

        expect(res.statusCode).toBe(400);
        expect((res.body as Record<string, unknown>).error).toBeDefined();
        expect(next).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  // ── Property 6: Validation middleware passes valid bodies through ────────────
  // Feature: codebase-refactoring, Property 6: Validation middleware passes valid bodies through
  // Validates: Requirements 6.2

  it('Property 6: passes valid bodies through and calls next()', () => {
    const validBodyArb = fc.record<TestBody>({
      name: fc.string({ minLength: 1 }),
      age: fc.integer({ min: 0, max: 150 }),
    });

    fc.assert(
      fc.property(validBodyArb, (body) => {
        const req = makeReq(body);
        const res = makeMockRes();
        const next = vi.fn() as unknown as NextFunction;

        validate(testSchema)(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.statusCode).toBe(0); // no response sent
        // req.body should be set to the parsed value
        expect(req.body).toEqual(body);
      }),
      { numRuns: 100 },
    );
  });
});
