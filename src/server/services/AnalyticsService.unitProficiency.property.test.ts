// Feature: units-config, Property 11: Unit proficiency score calculation

import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsService } from './AnalyticsService';

/**
 * Property 11: Unit proficiency score calculation
 *
 * For any (attempted >= 3, correct <= attempted), assert
 * proficiencyScore = (correct / attempted) * 100 within 0.01 tolerance.
 *
 * **Validates: Requirements 14.2**
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
// Property 11 — Unit proficiency score calculation
// Validates: Requirements 14.2
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
   * **Validates: Requirements 14.2**
   *
   * For any (attempted >= 3, correct <= attempted), the proficiencyScore
   * returned by calculateUnitProficiency SHALL equal
   * (correct / attempted) * 100, clamped to [0, 100], within 0.01 tolerance.
   */
  it('Property 11: proficiencyScore = (correct / attempted) * 100 within 0.01 tolerance', () => {
    // Feature: units-config, Property 11: Unit proficiency score calculation
    fc.assert(
      fc.property(
        fc
          .record({
            attempted: fc.integer({ min: 3, max: 50 }),
            correct: fc.nat(),
          })
          .filter(({ attempted, correct }) => correct <= attempted),
        ({ attempted, correct }) => {
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

          // ── Seed `attempted` answers: first `correct` are correct ───────
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
              .run(uuidv4(), sessionId, questionId, i < correct ? 1 : 0);
          }

          // ── Call the service ────────────────────────────────────────────
          const results = analyticsService.calculateUnitProficiency(userId, certificationId);

          // There must be exactly one result for our unit
          const unitResult = results.find((r) => r.unitId === unitId);
          if (!unitResult) return false;

          // ── Assert the formula ──────────────────────────────────────────
          // proficiencyScore = (correct / attempted) * 100, clamped to [0, 100]
          const expected = Math.min((correct / attempted) * 100, 100);
          return Math.abs(unitResult.proficiencyScore - expected) < 0.01;
        },
      ),
      { numRuns: 100 },
    );
  });
});
