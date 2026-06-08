import { describe, it, beforeEach, expect } from 'vitest';
import Database from 'better-sqlite3';
import * as fc from 'fast-check';

type TaskType = 'review_wrong_answers' | 'practice_quiz' | 'read_docs';
const VALID_TASK_TYPES: TaskType[] = ['review_wrong_answers', 'practice_quiz', 'read_docs'];

/**
 * Creates an in-memory SQLite DB with the minimal schema needed for study_plan_completions tests.
 */
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
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
      vendor TEXT,
      level TEXT DEFAULT 'Associate',
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(title, level)
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
      docUrl TEXT,
      isActive INTEGER DEFAULT 1,
      orderIndex INTEGER DEFAULT 0,
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
      passingScoreOverride INTEGER,
      createdAt DATETIME,
      updatedAt DATETIME,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE study_plan_completions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      topicId TEXT NOT NULL,
      taskType TEXT NOT NULL CHECK(taskType IN ('review_wrong_answers', 'practice_quiz', 'read_docs')),
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(sessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
      UNIQUE(userId, sessionId, topicId, taskType)
    );
    CREATE INDEX IF NOT EXISTS idx_spc_session ON study_plan_completions(sessionId, userId);
  `);
  return db;
}

/**
 * Seeds a user, certification, topic, and exam session into the test DB.
 * Returns the IDs for use in tests.
 */
function seedFixtures(db: ReturnType<typeof createTestDb>) {
  const userId = crypto.randomUUID();
  const certId = crypto.randomUUID();
  const topicId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, password, name, role) VALUES (?, ?, 'pw', 'Test', 'learner')`,
  ).run(userId, `${userId}@test.com`);

  db.prepare(
    `INSERT INTO certifications (id, title, vendor, level, createdAt, updatedAt) VALUES (?, 'Test Cert', 'Test', 'Associate', ?, ?)`,
  ).run(certId, now, now);

  db.prepare(`INSERT INTO topics (id, certificationId, title) VALUES (?, ?, 'Test Topic')`).run(
    topicId,
    certId,
  );

  db.prepare(
    `INSERT INTO exam_sessions (id, userId, questions, totalQuestions, autoSubmitAt, startTime, createdAt, updatedAt)
     VALUES (?, ?, '[]', 0, ?, ?, ?, ?)`,
  ).run(sessionId, userId, now, now, now, now);

  return { userId, topicId, sessionId };
}

/**
 * Inserts a completion record using INSERT OR IGNORE (idempotent).
 */
function insertCompletion(
  db: ReturnType<typeof createTestDb>,
  userId: string,
  sessionId: string,
  topicId: string,
  taskType: TaskType,
) {
  const id = crypto.randomUUID();
  const completedAt = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO study_plan_completions (id, userId, sessionId, topicId, taskType, completedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, sessionId, topicId, taskType, completedAt);
}

/**
 * Counts completion records for a given (userId, sessionId, topicId, taskType) tuple.
 */
function countCompletions(
  db: ReturnType<typeof createTestDb>,
  userId: string,
  sessionId: string,
  topicId: string,
  taskType: TaskType,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM study_plan_completions
       WHERE userId = ? AND sessionId = ? AND topicId = ? AND taskType = ?`,
    )
    .get(userId, sessionId, topicId, taskType) as { cnt: number };
  return row.cnt;
}

describe('study_plan_completions — idempotence', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  /**
   * Feature: study-plan-enhancements, Property 4: Task completion idempotence
   * Validates: Requirements 4.4
   */
  it('Property 4: inserting the same completion record N times results in exactly 1 DB record', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom(...VALID_TASK_TYPES),
        (n, taskType) => {
          const { userId, topicId, sessionId } = seedFixtures(db);

          for (let i = 0; i < n; i++) {
            insertCompletion(db, userId, sessionId, topicId, taskType);
          }

          const count = countCompletions(db, userId, sessionId, topicId, taskType);
          expect(count).toBe(1);

          // Clean up for next iteration
          db.prepare(`DELETE FROM study_plan_completions`).run();
          db.prepare(`DELETE FROM exam_sessions`).run();
          db.prepare(`DELETE FROM topics`).run();
          db.prepare(`DELETE FROM certifications`).run();
          db.prepare(`DELETE FROM users`).run();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('study_plan_completions — round-trip', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  /**
   * Feature: study-plan-enhancements, Property 3: Task completion round-trip
   * Validates: Requirements 1.3, 2.3, 4.1, 4.2, 4.3
   */
  it('Property 3: after inserting a completion, querying completions for the session returns it', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_TASK_TYPES), (taskType) => {
        const { userId, topicId, sessionId } = seedFixtures(db);

        insertCompletion(db, userId, sessionId, topicId, taskType);

        const completions = db
          .prepare(
            `SELECT topicId, taskType FROM study_plan_completions
             WHERE sessionId = ? AND userId = ?`,
          )
          .all(sessionId, userId) as Array<{ topicId: string; taskType: TaskType }>;

        const found = completions.find((c) => c.topicId === topicId && c.taskType === taskType);
        expect(found).toBeDefined();

        // Clean up for next iteration
        db.prepare(`DELETE FROM study_plan_completions`).run();
        db.prepare(`DELETE FROM exam_sessions`).run();
        db.prepare(`DELETE FROM topics`).run();
        db.prepare(`DELETE FROM certifications`).run();
        db.prepare(`DELETE FROM users`).run();
      }),
      { numRuns: 100 },
    );
  });
});
