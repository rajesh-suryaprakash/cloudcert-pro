import { describe, it, beforeEach, expect } from 'vitest';
import Database from 'better-sqlite3';
import * as fc from 'fast-check';
import { ExamSessionRepository } from './ExamSessionRepository';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT,
      xp INTEGER DEFAULT 0
    );
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      vendor TEXT,
      level TEXT DEFAULT 'Associate',
      examCode TEXT,
      url TEXT,
      iconUrl TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
    );
    CREATE TABLE exam_configurations (
      id TEXT PRIMARY KEY,
      certificationId TEXT,
      name TEXT,
      duration INTEGER,
      totalQuestions INTEGER,
      passingScore INTEGER,
      questionSelectionStrategy TEXT,
      topicWeights TEXT,
      isActive INTEGER DEFAULT 1
    );
    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      examConfigurationId TEXT,
      certificationId TEXT,
      topicId TEXT,
      questions TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',
      score REAL,
      totalQuestions INTEGER NOT NULL,
      correctAnswers INTEGER DEFAULT 0,
      incorrectAnswers INTEGER DEFAULT 0,
      unansweredQuestions INTEGER DEFAULT 0,
      timeTaken INTEGER,
      startTime DATETIME,
      endTime DATETIME,
      autoSubmitAt DATETIME NOT NULL,
      isPracticeMode INTEGER DEFAULT 0,
      isTopicQuiz INTEGER DEFAULT 0,
      isCustomQuiz INTEGER DEFAULT 0,
      isSRSReview INTEGER DEFAULT 0,
      sessionName TEXT,
      passingScoreOverride INTEGER,
      createdAt DATETIME,
      updatedAt DATETIME
    )
  `);
  return db;
}

describe('ExamSessionRepository', () => {
  let db: ReturnType<typeof createTestDb>;
  let repo: ExamSessionRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new ExamSessionRepository(db);
  });

  // Feature: codebase-refactoring, Property 4: ExamSessionRepository create/findById round trip
  // Validates: Requirements 6.2
  it('Property 4: create then findById returns matching userId, examConfigurationId, and totalQuestions', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          examConfigurationId: fc.option(fc.uuid(), { nil: null }),
          totalQuestions: fc.integer({ min: 1, max: 200 }),
        }),
        ({ userId, examConfigurationId, totalQuestions }) => {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          const questions = JSON.stringify(
            Array.from({ length: totalQuestions }, () => crypto.randomUUID()),
          );

          repo.create({
            id,
            userId,
            examConfigurationId,
            questions,
            totalQuestions,
            isPracticeMode: 0,
            autoSubmitAt: now,
            startTime: now,
          });

          const found = repo.findById(id, userId);
          return (
            found !== undefined &&
            found.userId === userId &&
            found.examConfigurationId === examConfigurationId &&
            found.totalQuestions === totalQuestions
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: codebase-refactoring, Property 4: findByUser always includes passingScore
  // Validates: Requirements 5.2, 5.3
  it('Property 4: findByUser always includes a non-negative passingScore for every session', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          // Some sessions have a config (with a passingScore), some don't
          sessions: fc.array(
            fc.record({
              hasConfig: fc.boolean(),
              configPassingScore: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 1, maxLength: 10 },
          ),
        }),
        ({ userId, sessions }) => {
          const now = new Date().toISOString();

          sessions.forEach((s, i) => {
            const sessionId = `session-${userId}-${i}`;
            let configId: string | null = null;

            if (s.hasConfig) {
              configId = `config-${userId}-${i}`;
              db.prepare(
                `INSERT OR IGNORE INTO exam_configurations
                 (id, certificationId, name, duration, totalQuestions, passingScore, questionSelectionStrategy, topicWeights)
                 VALUES (?, 'cert-1', 'Config', 60, 10, ?, 'random', '{}')`,
              ).run(configId, s.configPassingScore);
            }

            db.prepare(
              `INSERT INTO exam_sessions
               (id, userId, examConfigurationId, questions, status, score, totalQuestions, autoSubmitAt, startTime, createdAt, updatedAt)
               VALUES (?, ?, ?, '[]', 'completed', 80, 10, ?, ?, ?, ?)`,
            ).run(sessionId, userId, configId, now, now, now, now);
          });

          const results = repo.findByUser(userId);

          return results.every((r) => {
            const ps = (r as { passingScore: number }).passingScore;
            return typeof ps === 'number' && ps >= 0;
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Requirements: 1.8 — custom quiz sessions fall back to 'Custom Quiz' label
  it('findByUser returns "Custom Quiz" as examName for sessions with isCustomQuiz=1 and no exam config', () => {
    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO exam_sessions
       (id, userId, examConfigurationId, questions, status, totalQuestions, autoSubmitAt, startTime, createdAt, updatedAt, isCustomQuiz)
       VALUES (?, ?, NULL, '[]', 'completed', 5, ?, ?, ?, ?, 1)`,
    ).run(sessionId, userId, now, now, now, now);

    const results = repo.findByUser(userId);
    const session = results.find((r) => r.id === sessionId);

    expect(session).toBeDefined();
    expect((session as { examName: string | null }).examName).toBe('Custom Quiz');
  });

  // Feature: codebase-refactoring, Property 2: findCompletedScoresByConfig excludes the target session
  // Validates: Requirements 2.3
  it('Property 2: findCompletedScoresByConfig excludes the target session and includes all others', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }).chain((n) =>
          fc.record({
            configId: fc.uuid(),
            sessions: fc.array(
              fc.record({
                score: fc.integer({ min: 0, max: 100 }),
              }),
              { minLength: n, maxLength: n },
            ),
            excludeIndex: fc.integer({ min: 0, max: n - 1 }),
          }),
        ),
        ({ configId, sessions, excludeIndex }) => {
          const now = new Date().toISOString();

          // Insert a dummy exam config
          db.prepare(
            `INSERT INTO exam_configurations (id, certificationId, name, duration, totalQuestions, passingScore, questionSelectionStrategy, topicWeights)
             VALUES (?, 'cert-1', 'Test Config', 60, 10, 70, 'random', '{}')`,
          ).run(configId);

          // Insert all sessions as completed with the given config
          const sessionIds = sessions.map((_, i) => {
            const id = `session-${configId}-${i}`;
            db.prepare(
              `INSERT INTO exam_sessions (id, userId, examConfigurationId, questions, status, score, totalQuestions, autoSubmitAt, startTime, createdAt, updatedAt)
               VALUES (?, 'user-1', ?, '[]', 'completed', ?, 10, ?, ?, ?, ?)`,
            ).run(id, configId, sessions[i].score, now, now, now, now);
            return id;
          });

          const excludeId = sessionIds[excludeIndex];
          const result = repo.findCompletedScoresByConfig(configId, excludeId);

          // The excluded session's score must not appear (by position — check count)
          const expectedCount = sessions.length - 1;
          if (result.length !== expectedCount) return false;

          // The result must not contain the excluded session id
          // (verify by checking all returned scores match the non-excluded sessions)
          const expectedScores = sessions
            .filter((_, i) => i !== excludeIndex)
            .map((s) => s.score)
            .sort((a, b) => a - b);
          const actualScores = [...result].sort((a, b) => a - b);

          return JSON.stringify(expectedScores) === JSON.stringify(actualScores);
        },
      ),
      { numRuns: 100 },
    );
  });
});
