import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { runMigrations, migrations } from './migrations';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('runMigrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
  });

  it('creates all expected tables on a fresh in-memory db', () => {
    runMigrations(db);

    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];
    const tableNames = rows.map((r) => r.name);

    const expectedTables = [
      'achievements',
      'answer_change_history',
      'benchmark_users',
      'certifications',
      'community_benchmark_cache',
      'dashboard_metrics_cache',
      'discussion_votes',
      'discussions',
      'domain_weights',
      'exam_answers',
      'exam_configurations',
      'exam_sessions',
      'question_reports',
      'question_reviews',
      'questions',
      'refresh_tokens',
      'schema_migrations',
      'study_plan_completions',
      'subtopics',
      'topics',
      'user_achievements',
      'user_streaks',
      'users',
    ];

    for (const table of expectedTables) {
      expect(tableNames, `expected table "${table}" to exist`).toContain(table);
    }
  });

  it('records applied migration versions in schema_migrations', () => {
    runMigrations(db);

    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
      version: number;
    }[];

    const defined = migrations.map((m) => m.version).sort((a, b) => a - b);
    expect(versions.map((r) => r.version)).toEqual(defined);
  });

  it('is idempotent — running twice leaves the db unchanged', () => {
    runMigrations(db);

    const versionsBefore = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as { version: number }[];

    // Should not throw and should not duplicate versions
    runMigrations(db);

    const versionsAfter = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as { version: number }[];

    expect(versionsAfter).toEqual(versionsBefore);
  });

  /**
   * Feature: code-quality-hardening, Property 1: Migration idempotence — running migrations twice leaves the DB unchanged
   * Validates: Requirements 1.3, 1.5
   */
  it('property: running migrations twice leaves the DB unchanged', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const testDb = new Database(':memory:');
        testDb.pragma('foreign_keys = ON');

        // First run — apply all migrations
        runMigrations(testDb);

        const tablesBefore = (
          testDb
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
            .all() as { name: string }[]
        ).map((r) => r.name);

        const versionsBefore = (
          testDb.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
            version: number;
          }[]
        ).map((r) => r.version);

        // Second run — must be a no-op
        runMigrations(testDb);

        const tablesAfter = (
          testDb
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
            .all() as { name: string }[]
        ).map((r) => r.name);

        const versionsAfter = (
          testDb.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
            version: number;
          }[]
        ).map((r) => r.version);

        testDb.close();

        expect(tablesAfter).toEqual(tablesBefore);
        expect(versionsAfter).toEqual(versionsBefore);
      }),
      { numRuns: 100 },
    );
  });

  it('skips already-applied migrations on subsequent runs', () => {
    runMigrations(db);
    // Insert a fake future version to simulate a partially-migrated db
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(999);

    // Running again should not error and should not re-apply version 1
    expect(() => runMigrations(db)).not.toThrow();

    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
      version: number;
    }[];

    expect(versions.map((r) => r.version)).toContain(1);
    expect(versions.map((r) => r.version)).toContain(999);
  });

  /**
   * Feature: code-quality-hardening, Property 2: After runMigrations(), recorded versions equal the defined migration list
   * Validates: Requirements 1.2, 1.4
   */
  it('property: recorded versions after runMigrations equal the defined migration list', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const testDb = new Database(':memory:');
        testDb.pragma('foreign_keys = ON');

        runMigrations(testDb);

        const recorded = (
          testDb.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
            version: number;
          }[]
        ).map((r) => r.version);

        const defined = migrations.map((m) => m.version).sort((a, b) => a - b);

        testDb.close();

        expect(recorded).toEqual(defined);
      }),
      { numRuns: 100 },
    );
  });
  it('migration 15: creates compound indexes on exam_sessions for query performance', () => {
    runMigrations(db);

    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='exam_sessions'`)
      .all() as { name: string }[];
    const indexNames = indexes.map((r) => r.name);

    expect(indexNames).toContain('idx_exam_sessions_userId_status');
    expect(indexNames).toContain('idx_exam_sessions_userId_certId_status_created');
  });
});
