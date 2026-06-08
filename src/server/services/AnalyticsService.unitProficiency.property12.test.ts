// Feature: units-config, Property 12: hasInsufficientData threshold invariant

import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsService } from './AnalyticsService';

/**
 * Property 12: hasInsufficientData threshold invariant
 *
 * For any `attempted` in [0, 10], `hasInsufficientData` SHALL be `true`
 * when `questionsAttempted < 3` and `false` when `questionsAttempted >= 3`.
 *
 * **Validates: Requirements 14.3, 16.3**
 */

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0
    );

    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      title TEXT NOT NULL
    );

    CREATE TABLE units (
      id TEXT PRIMARY KEY,
      subTopicId TEXT NOT NULL,
      title TEXT NOT NULL,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      topicId TEXT,
      subTopicId TEXT,
      unitId TEXT,
      questionText TEXT NOT NULL,
      questionType TEXT NOT NULL,
      correctAnswers TEXT NOT NULL,
      isActive INTEGER DEFAULT 1
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL
    );

    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      certificationId TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE exam_answers (
      id TEXT PRIMARY KEY,
      examSessionId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      isCorrect INTEGER
    );
  `);
  return db;
}

// ---------------------------------------------------------------------------
// Property 12 — hasInsufficientData threshold invariant
// Validates: Requirements 14.3, 16.3
// ---------------------------------------------------------------------------

describe('AnalyticsService property tests — units-config', () => {
  let testDb: Database.Database;
  let analyticsService: AnalyticsService;

  beforeEach(async () => {
    testDb = createTestDb();

    const dbModule = await import('../db/connection');
    vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    testDb.close();
    vi.restoreAllMocks();
  });

  /**
   * **Validates: Requirements 14.3, 16.3**
   *
   * For any `attempted` in [1, 10], the `hasInsufficientData` field returned
   * by `calculateUnitProficiency` SHALL equal `(attempted < 3)`.
   *
   * When `attempted = 0` there are no exam answers so the unit does not appear
   * in the results — this is consistent with "insufficient data" (0 < 3 = true)
   * and is verified separately below.
   */
  it('Property 12: hasInsufficientData === (attempted < 3) for attempted in [1, 10]', () => {
    // Feature: units-config, Property 12: hasInsufficientData threshold invariant
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (attempted) => {
        // ── Seed base entities ──────────────────────────────────────────
        const userId = uuidv4();
        const certificationId = uuidv4();
        const topicId = uuidv4();
        const subtopicId = uuidv4();
        const unitId = uuidv4();

        testDb
          .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
          .run(userId, `u-${userId}@test.com`, 'hash');
        testDb
          .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
          .run(certificationId, 'Test Cert');
        testDb
          .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
          .run(topicId, certificationId, 'Topic');
        testDb
          .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
          .run(subtopicId, topicId, 'Subtopic');
        testDb
          .prepare('INSERT INTO units (id, subTopicId, title) VALUES (?, ?, ?)')
          .run(unitId, subtopicId, 'Unit');

        // ── Seed a single completed exam session ────────────────────────
        const sessionId = uuidv4();
        testDb
          .prepare(
            'INSERT INTO exam_sessions (id, userId, certificationId, status) VALUES (?, ?, ?, ?)',
          )
          .run(sessionId, userId, certificationId, 'completed');

        // ── Seed exactly `attempted` answers for the unit ───────────────
        for (let i = 0; i < attempted; i++) {
          const questionId = uuidv4();
          testDb
            .prepare(
              'INSERT INTO questions (id, certificationId, topicId, subTopicId, unitId, questionText, questionType, correctAnswers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .run(questionId, certificationId, topicId, subtopicId, unitId, 'Q?', 'single', 'A');

          testDb
            .prepare(
              'INSERT INTO exam_answers (id, examSessionId, questionId, isCorrect) VALUES (?, ?, ?, ?)',
            )
            .run(uuidv4(), sessionId, questionId, 1);
        }

        // ── Call the service ────────────────────────────────────────────
        const results = analyticsService.calculateUnitProficiency(userId, certificationId);
        const unitResult = results.find((r) => r.unitId === unitId);

        // The unit must appear in results (attempted >= 1 means at least one answer)
        if (!unitResult) return false;

        // ── Assert the threshold ────────────────────────────────────────
        // hasInsufficientData must be true when attempted < 3, false otherwise
        return unitResult.hasInsufficientData === attempted < 3;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 14.3, 16.3**
   *
   * When `attempted = 0` (no exam answers for the unit), the unit does not
   * appear in the proficiency results. This is consistent with the
   * "insufficient data" semantic since 0 < 3.
   */
  it('Property 12 (zero case): unit with 0 attempted answers is absent from results', () => {
    // Feature: units-config, Property 12: hasInsufficientData threshold invariant
    fc.assert(
      fc.property(fc.constant(0), (_attempted) => {
        // ── Seed base entities ──────────────────────────────────────────
        const userId = uuidv4();
        const certificationId = uuidv4();
        const topicId = uuidv4();
        const subtopicId = uuidv4();
        const unitId = uuidv4();

        testDb
          .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
          .run(userId, `u-${userId}@test.com`, 'hash');
        testDb
          .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
          .run(certificationId, 'Test Cert');
        testDb
          .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
          .run(topicId, certificationId, 'Topic');
        testDb
          .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
          .run(subtopicId, topicId, 'Subtopic');
        testDb
          .prepare('INSERT INTO units (id, subTopicId, title) VALUES (?, ?, ?)')
          .run(unitId, subtopicId, 'Unit');

        // ── Seed a completed session but NO answers for this unit ───────
        const sessionId = uuidv4();
        testDb
          .prepare(
            'INSERT INTO exam_sessions (id, userId, certificationId, status) VALUES (?, ?, ?, ?)',
          )
          .run(sessionId, userId, certificationId, 'completed');

        // No exam_answers inserted — attempted = 0

        // ── Call the service ────────────────────────────────────────────
        const results = analyticsService.calculateUnitProficiency(userId, certificationId);
        const unitResult = results.find((r) => r.unitId === unitId);

        // Unit with 0 answers should not appear in results (INNER JOIN filters it out)
        // This is consistent with hasInsufficientData = true (0 < 3)
        return unitResult === undefined;
      }),
      { numRuns: 100 },
    );
  });
});
