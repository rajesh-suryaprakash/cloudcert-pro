/**
 * Global test setup for all server-side tests.
 *
 * IMPORTANT: This file is loaded by Vitest before every test file via the
 * `setupFiles` config in vitest.config.ts. Its job is to ensure that NO test
 * ever touches the real `cloudcert.db` on disk.
 *
 * Strategy:
 *   - Before each test FILE  → spin up a fresh in-memory SQLite DB, run all
 *     migrations, and swap it in via overrideDb().
 *   - After each test FILE   → restore the default connection (overrideDb(null))
 *     and close the in-memory DB. The file-scoped DB is destroyed automatically.
 *
 * Individual test suites that need a DB reference for direct inserts should
 * import `getTestDb()` from this file instead of importing `db` from connection.
 */

import { beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { overrideDb } from '../server/db/connection';
import { runMigrations } from '../server/db/migrations';

// Module-level reference so getTestDb() can be used by any test file
let _testDb: Database.Database | null = null;

/**
 * Returns the current test-scoped in-memory database instance.
 * Use this in test files that need to directly insert/query rows
 * instead of importing the live `db` from connection.ts.
 */
export function getTestDb(): Database.Database {
  if (!_testDb) {
    throw new Error(
      'getTestDb() called before the in-memory DB was initialized. ' +
        'Make sure your test file is covered by the global setup.',
    );
  }
  return _testDb;
}

// ── Global lifecycle ─────────────────────────────────────────────────────────

beforeAll(() => {
  // Create a fresh in-memory DB for each test file
  _testDb = new Database(':memory:');
  _testDb.pragma('journal_mode = WAL');
  _testDb.pragma('foreign_keys = ON');
  runMigrations(_testDb);
  overrideDb(_testDb);
});

afterAll(() => {
  // Restore the default (lazy) DB connection and destroy the in-memory instance
  overrideDb(null);
  _testDb?.close();
  _testDb = null;
});
