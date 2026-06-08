/**
 * Property-based tests for the enterprise logger singleton.
 * Feature: enterprise-logging
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import pino from 'pino';

// Valid pino log levels in ascending severity order
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

// Numeric values pino assigns to each level
const LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Creates a pino logger that writes to an in-memory string array so we can
 * inspect the JSON output without touching stdout.
 */
function makeTestLogger(level: LogLevel) {
  const lines: string[] = [];
  const dest = new (require('stream').Writable)({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      lines.push(chunk.toString().trim());
      cb();
    },
  });

  const log = pino(
    {
      level,
      redact: {
        paths: [
          'password',
          'token',
          'authorization',
          'cookie',
          'secret',
          '*.password',
          '*.token',
          '*.authorization',
          '*.cookie',
          '*.secret',
        ],
        censor: '[REDACTED]',
      },
    },
    dest,
  );

  return { log, lines };
}

// ---------------------------------------------------------------------------
// Property 1: Log entries always contain required fields
// Feature: enterprise-logging, Property 1: Log entries always contain required fields
// Validates: Requirements 1.1
// ---------------------------------------------------------------------------
describe('Property 1: Log entries always contain required fields', () => {
  it('for any message at any valid level, the JSON output contains level, time, and msg', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LOG_LEVELS), fc.string({ minLength: 1 }), (level, msg) => {
        const { log, lines } = makeTestLogger(level);
        // Emit at the configured level so it is never filtered
        log[level](msg);

        expect(lines.length).toBeGreaterThanOrEqual(1);
        const entry = JSON.parse(lines[lines.length - 1]);

        expect(entry).toHaveProperty('level');
        expect(entry).toHaveProperty('time');
        expect(entry).toHaveProperty('msg', msg);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Logger filters entries below the configured level
// Feature: enterprise-logging, Property 2: Logger filters entries below the configured level
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------
describe('Property 2: Logger filters entries below the configured level', () => {
  it('entries at a level below the configured level are suppressed; at or above are emitted', () => {
    fc.assert(
      fc.property(
        // Pick a configured level that is not the lowest (so there is something to filter)
        fc.constantFrom('debug', 'info', 'warn', 'error', 'fatal' as LogLevel),
        fc.constantFrom(...LOG_LEVELS),
        fc.string({ minLength: 1 }),
        (configuredLevel, emitLevel, msg) => {
          const { log, lines } = makeTestLogger(configuredLevel as LogLevel);
          log[emitLevel](msg);

          const shouldAppear = LEVEL_VALUES[emitLevel] >= LEVEL_VALUES[configuredLevel as LogLevel];

          if (shouldAppear) {
            expect(lines.length).toBeGreaterThanOrEqual(1);
            const entry = JSON.parse(lines[lines.length - 1]);
            expect(entry.msg).toBe(msg);
          } else {
            expect(lines.length).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
