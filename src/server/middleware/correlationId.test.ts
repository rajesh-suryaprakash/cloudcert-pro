/**
 * Property-based tests for the correlationId middleware.
 * Feature: enterprise-logging
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Request, Response, NextFunction } from 'express';
import { correlationId } from './correlationId';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

const noop: NextFunction = () => {};
const res = {} as Response;

// ---------------------------------------------------------------------------
// Property 5: Generated correlation IDs are valid UUID v4
// Feature: enterprise-logging, Property 5: Generated correlation IDs are valid UUID v4
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------
describe('Property 5: Generated correlation IDs are valid UUID v4', () => {
  it('for any request without X-Correlation-ID, req.correlationId matches UUID v4 format', () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const req = makeReq();
        correlationId(req, res, noop);
        expect(req.correlationId).toMatch(UUID_V4_REGEX);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Provided X-Correlation-ID header is preserved unchanged
// Feature: enterprise-logging, Property 6: Provided X-Correlation-ID header is preserved unchanged
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------
describe('Property 6: Provided X-Correlation-ID header is preserved unchanged', () => {
  it('for any non-empty X-Correlation-ID header value, req.correlationId equals that value', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const req = makeReq({ 'x-correlation-id': id });
        correlationId(req, res, noop);
        expect(req.correlationId).toBe(id);
      }),
      { numRuns: 100 },
    );
  });
});
