import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { AnalyticsService } from './AnalyticsService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for AnalyticsService
 * Feature: insight-dashboard
 */

describe('AnalyticsService - Property Tests', () => {
  let testDb: Database.Database;
  let analyticsService: AnalyticsService;

  beforeEach(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Mock the db module to use our test database
    const dbModule = await import('../db/connection');

    // Replace the db export with our test database
    vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

    // Create minimal schema needed for proficiency calculations
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE domain_weights (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        domainName TEXT NOT NULL,
        weightPercentage REAL NOT NULL CHECK(weightPercentage >= 0 AND weightPercentage <= 100),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE topics (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        title TEXT NOT NULL,
        weightPercentage REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE subtopics (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        title TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
      );

      CREATE TABLE units (
        id TEXT PRIMARY KEY,
        subTopicId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        orderIndex INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(subTopicId) REFERENCES subtopics(id) ON DELETE CASCADE
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        topicId TEXT,
        subTopicId TEXT,
        unitId TEXT,
        domainId TEXT,
        questionText TEXT NOT NULL,
        questionType TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL,
        FOREIGN KEY(subTopicId) REFERENCES subtopics(id) ON DELETE SET NULL,
        FOREIGN KEY(unitId) REFERENCES units(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        status TEXT NOT NULL,
        examName TEXT,
        sessionName TEXT,
        isPracticeMode INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_answers (
        id TEXT PRIMARY KEY,
        examSessionId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        userAnswer TEXT,
        isCorrect INTEGER,
        timeSpent INTEGER DEFAULT 0,
        confidenceLevel TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_exam_sessions_user_cert ON exam_sessions(userId, certificationId, status, createdAt DESC);
      CREATE INDEX idx_exam_answers_session ON exam_answers(examSessionId, isCorrect, timeSpent);
      CREATE INDEX idx_questions_domain ON questions(domainId, topicId, subTopicId);
    `);

    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
    vi.restoreAllMocks();
  });

  describe('Property 1: Proficiency score bounds', () => {
    it('proficiency scores are always between 0 and 100', () => {
      fc.assert(
        fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }), (correctAnswers) => {
          const userId = uuidv4();
          const certificationId = uuidv4();
          const sessionId = uuidv4();
          const domainName = 'Test Domain';

          // Insert test data
          testDb
            .prepare('INSERT OR IGNORE INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
            .run(userId, `test-${userId}@example.com`, 'hash');

          testDb
            .prepare('INSERT OR IGNORE INTO certifications (id, title) VALUES (?, ?)')
            .run(certificationId, 'Test Cert');

          testDb
            .prepare(
              'INSERT OR IGNORE INTO domain_weights (id, certificationId, domainName, weightPercentage) VALUES (?, ?, ?, ?)',
            )
            .run(uuidv4(), certificationId, domainName, 25);

          testDb
            .prepare(
              'INSERT INTO exam_sessions (id, userId, certificationId, status, isPracticeMode) VALUES (?, ?, ?, ?, ?)',
            )
            .run(sessionId, userId, certificationId, 'completed', 0);

          // Create questions and answers
          correctAnswers.forEach((isCorrect) => {
            const questionId = uuidv4();
            testDb
              .prepare(
                'INSERT INTO questions (id, certificationId, domainId, questionText, questionType, correctAnswers) VALUES (?, ?, ?, ?, ?, ?)',
              )
              .run(
                questionId,
                certificationId,
                domainName,
                'Test question',
                'multiple-choice',
                'A',
              );

            testDb
              .prepare(
                'INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect) VALUES (?, ?, ?, ?, ?)',
              )
              .run(uuidv4(), sessionId, questionId, 'A', isCorrect ? 1 : 0);
          });

          // Calculate proficiency
          const proficiency = analyticsService.calculateDomainProficiency(userId, certificationId);

          // Verify bounds
          proficiency.forEach((domain) => {
            expect(domain.proficiencyScore).toBeGreaterThanOrEqual(0);
            expect(domain.proficiencyScore).toBeLessThanOrEqual(100);
          });
        }),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Unit tests for AnalyticsService.calculateUnitProficiency
 * Requirements: 14.2, 14.3
 */
describe('AnalyticsService.calculateUnitProficiency', () => {
  let testDb: Database.Database;
  let analyticsService: AnalyticsService;

  // Shared IDs reused across tests
  let userId: string;
  let certificationId: string;
  let topicId: string;
  let subtopicId: string;
  let unitId: string;

  beforeEach(async () => {
    testDb = new Database(':memory:');

    const dbModule = await import('../db/connection');
    vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

    // Minimal schema including the units table
    testDb.exec(`
      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL
      );

      CREATE TABLE topics (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        title TEXT NOT NULL
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

    analyticsService = new AnalyticsService();

    // Seed shared base data
    userId = uuidv4();
    certificationId = uuidv4();
    topicId = uuidv4();
    subtopicId = uuidv4();
    unitId = uuidv4();

    testDb
      .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
      .run(userId, 'u@test.com', 'hash');
    testDb
      .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
      .run(certificationId, 'Test Cert');
    testDb
      .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
      .run(topicId, certificationId, 'Topic 1');
    testDb
      .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
      .run(subtopicId, topicId, 'Subtopic 1');
    testDb
      .prepare('INSERT INTO units (id, subTopicId, title) VALUES (?, ?, ?)')
      .run(unitId, subtopicId, 'Unit 1');
  });

  afterEach(() => {
    testDb.close();
    vi.restoreAllMocks();
  });

  /**
   * Helper: insert a completed exam session and answers for the given unit.
   * Returns the session ID.
   */
  function seedSession(numCorrect: number, numIncorrect: number): string {
    const sessionId = uuidv4();
    testDb
      .prepare(
        'INSERT INTO exam_sessions (id, userId, certificationId, status) VALUES (?, ?, ?, ?)',
      )
      .run(sessionId, userId, certificationId, 'completed');

    for (let i = 0; i < numCorrect + numIncorrect; i++) {
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
        .run(uuidv4(), sessionId, questionId, i < numCorrect ? 1 : 0);
    }

    return sessionId;
  }

  // ─── Zero-division guard ────────────────────────────────────────────────────

  it('returns proficiencyScore of 0 (not NaN or Infinity) when questionsAttempted is 0', () => {
    // The unit exists but the user has no exam answers for it.
    // The SQL query only returns rows where answers exist, so the unit won't
    // appear in results. We verify the service returns an empty array (no
    // division-by-zero row) rather than a NaN/Infinity entry.
    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(0);
  });

  it('returns proficiencyScore of 0 when all answers are incorrect (0 correct out of N)', () => {
    // 0 correct, 4 incorrect → score should be 0, not NaN
    seedSession(0, 4);

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);

    const unit = results[0];
    expect(unit.proficiencyScore).toBe(0);
    expect(Number.isNaN(unit.proficiencyScore)).toBe(false);
    expect(Number.isFinite(unit.proficiencyScore)).toBe(true);
  });

  // ─── hasInsufficientData boundary ──────────────────────────────────────────

  it('sets hasInsufficientData = false when questionsAttempted is exactly 3', () => {
    // Boundary: 3 attempted → NOT insufficient (>= 3 means sufficient)
    seedSession(2, 1); // 3 total

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].questionsAttempted).toBe(3);
    expect(results[0].hasInsufficientData).toBe(false);
  });

  it('sets hasInsufficientData = true when questionsAttempted is exactly 2', () => {
    // Boundary: 2 attempted → insufficient (< 3)
    seedSession(1, 1); // 2 total

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].questionsAttempted).toBe(2);
    expect(results[0].hasInsufficientData).toBe(true);
  });

  it('sets hasInsufficientData = true when questionsAttempted is 1', () => {
    seedSession(1, 0); // 1 total

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].hasInsufficientData).toBe(true);
  });

  it('sets hasInsufficientData = false when questionsAttempted is 4', () => {
    seedSession(3, 1); // 4 total

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].hasInsufficientData).toBe(false);
  });

  // ─── Correct proficiencyScore calculation ──────────────────────────────────

  it('calculates proficiencyScore as (questionsCorrect / questionsAttempted) * 100', () => {
    // 3 correct out of 5 attempted = 60.0
    seedSession(3, 2);

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);

    const unit = results[0];
    expect(unit.questionsAttempted).toBe(5);
    expect(unit.questionsCorrect).toBe(3);
    expect(unit.proficiencyScore).toBeCloseTo(60.0, 5);
  });

  it('calculates proficiencyScore of 100 when all questions are correct', () => {
    seedSession(5, 0); // 5 correct, 0 incorrect

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].proficiencyScore).toBe(100);
  });

  it('includes subtopicId on each result for downstream filtering', () => {
    seedSession(3, 0);

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].subtopicId).toBe(subtopicId);
  });

  it('returns correct unitId and unitName on each result', () => {
    seedSession(3, 0);

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(1);
    expect(results[0].unitId).toBe(unitId);
    expect(results[0].unitName).toBe('Unit 1');
  });

  it('returns an empty array when the user has no completed sessions', () => {
    // No sessions seeded
    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(0);
  });

  it('ignores incomplete (non-completed) exam sessions', () => {
    // Insert an in-progress session with answers — should not count
    const sessionId = uuidv4();
    testDb
      .prepare(
        'INSERT INTO exam_sessions (id, userId, certificationId, status) VALUES (?, ?, ?, ?)',
      )
      .run(sessionId, userId, certificationId, 'in_progress');

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

    const results = analyticsService.calculateUnitProficiency(userId, certificationId);
    expect(results).toHaveLength(0);
  });
});
