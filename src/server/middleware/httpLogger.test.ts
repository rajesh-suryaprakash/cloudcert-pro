/**
 * Property-based tests for the HTTP logger middleware.
 * Feature: enterprise-logging
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Writable } from 'stream';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a writable stream that captures lines into an array. */
function makeCapture() {
  const lines: string[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      lines.push(chunk.toString().trim());
      cb();
    },
  });
  return { lines, dest };
}

/**
 * Build a pino-http instance wired to an in-memory capture stream so we can
 * inspect the JSON output.  Mirrors the production httpLogger configuration.
 */
function makeTestHttpLogger(dest: NodeJS.WritableStream) {
  const testLogger = pino({ level: 'trace' }, dest);

  return pinoHttp({
    logger: testLogger,
    customLogLevel(_req, res, _err) {
      return res.statusCode >= 400 ? 'warn' : 'info';
    },
    customProps(req: Request) {
      return { correlationId: req.correlationId };
    },
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  });
}

/** HTTP methods we want to exercise. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

/**
 * Build a minimal but complete enough mock Response for pino-http.
 * pino-http calls res.on('finish'), res.removeListener, res.getHeader, etc.
 */
function makeMockRes(statusCode: number): Response {
  const listeners: Record<string, Array<() => void>> = {};
  const res = {
    statusCode,
    headersSent: true,
    getHeader: () => undefined,
    getHeaders: () => ({}),
    writableEnded: false,
    on(event: string, cb: () => void) {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
      // Immediately fire 'finish' so pino-http writes the log entry
      if (event === 'finish') cb();
      return res;
    },
    removeListener(event: string, cb: () => void) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== cb);
      }
      return res;
    },
  } as unknown as Response;
  return res;
}

/** Arbitraries for status code ranges. */
const successStatus = fc.integer({ min: 200, max: 399 });
const errorStatus = fc.integer({ min: 400, max: 599 });

// ---------------------------------------------------------------------------
// Property 3: HTTP access log entries contain method, URL, status, and correlationId
// Feature: enterprise-logging, Property 3: HTTP access log entries contain method, URL, status, and correlationId
// Validates: Requirements 2.1, 3.2
// ---------------------------------------------------------------------------
describe('Property 3: HTTP access log entries contain method, URL, status, and correlationId', () => {
  it('for any HTTP method, URL, status, and correlationId, the access log entry contains all required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HTTP_METHODS),
        fc.webPath().filter((p) => p.length > 0),
        fc.integer({ min: 200, max: 599 }),
        fc.uuid(),
        (method, url, statusCode, correlationId) => {
          const { lines, dest } = makeCapture();
          const middleware = makeTestHttpLogger(dest);

          // Build minimal req / res mocks
          const req = {
            method,
            url,
            correlationId,
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
          } as unknown as Request;

          const res = makeMockRes(statusCode);

          middleware(req, res, () => {});

          expect(lines.length).toBeGreaterThanOrEqual(1);
          const entry = JSON.parse(lines[lines.length - 1]);

          // Required fields per Requirements 2.1 and 3.2
          expect(entry.req).toHaveProperty('method', method);
          expect(entry.req).toHaveProperty('url', url);
          expect(entry.res).toHaveProperty('statusCode', statusCode);
          expect(entry).toHaveProperty('correlationId', correlationId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: HTTP access log level reflects response status range
// Feature: enterprise-logging, Property 4: HTTP access log level reflects response status range
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

// Pino numeric level values
const LEVEL_NUMS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

describe('Property 4: HTTP access log level reflects response status range', () => {
  it('2xx/3xx responses are logged at info level', () => {
    fc.assert(
      fc.property(successStatus, fc.uuid(), (statusCode, correlationId) => {
        const { lines, dest } = makeCapture();
        const middleware = makeTestHttpLogger(dest);

        const req = {
          method: 'GET',
          url: '/test',
          correlationId,
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown as Request;

        const res = makeMockRes(statusCode);

        middleware(req, res, () => {});

        expect(lines.length).toBeGreaterThanOrEqual(1);
        const entry = JSON.parse(lines[lines.length - 1]);
        // pino stores level as a number; 30 = info
        expect(entry.level).toBe(LEVEL_NUMS['info']);
      }),
      { numRuns: 100 },
    );
  });

  it('4xx/5xx responses are logged at warn level', () => {
    fc.assert(
      fc.property(errorStatus, fc.uuid(), (statusCode, correlationId) => {
        const { lines, dest } = makeCapture();
        const middleware = makeTestHttpLogger(dest);

        const req = {
          method: 'GET',
          url: '/test',
          correlationId,
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown as Request;

        const res = makeMockRes(statusCode);

        middleware(req, res, () => {});

        expect(lines.length).toBeGreaterThanOrEqual(1);
        const entry = JSON.parse(lines[lines.length - 1]);
        // pino stores level as a number; 40 = warn
        expect(entry.level).toBe(LEVEL_NUMS['warn']);
      }),
      { numRuns: 100 },
    );
  });
});
