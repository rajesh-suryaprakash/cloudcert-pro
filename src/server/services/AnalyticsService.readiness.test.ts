import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { AnalyticsService } from './AnalyticsService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for AnalyticsService readiness score calculation
 * Feature: insight-dashboard
 * Task: 4.6 Write property test for readiness score
 */

describe('AnalyticsService - Property 3: Readiness score bounds and null handling', () => {
  let testDb: Database.Database;
  let analyticsService: AnalyticsService;
  let dbModuleSpy: any;

  beforeEach(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Mock the db module to use our test database
    const dbModule = await import('../db/connection');
    dbModuleSpy = vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

    // Create schema needed for readiness score calculations
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

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        topicId TEXT,
        subTopicId TEXT,
        domainId TEXT,
        questionText TEXT NOT NULL,
        questionType TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL,
        FOREIGN KEY(subTopicId) REFERENCES subtopics(id) ON DELETE SET NULL
      );

      CREATE TABLE exam_configurations (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        name TEXT,
        duration INTEGER NOT NULL,
        totalQuestions INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        examConfigurationId TEXT,
        status TEXT NOT NULL,
        examName TEXT,
        isPracticeMode INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE SET NULL
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
    if (dbModuleSpy) {
      dbModuleSpy.mockRestore();
    }
  });

  /**
   * **Validates: Requirements 8.1**
   *
   * Property: Readiness score is between 0-100 or null
   *
   * This property verifies that the readiness score calculation:
   * 1. Returns null when there are fewer than 3 completed sessions
   * 2. Returns a score between 0 and 100 (inclusive) when there are 3 or more sessions
   *
   * The test generates various scenarios with different numbers of sessions,
   * questions, correctness rates, time spent, and confidence levels to ensure
   * the readiness score always falls within the valid range or is null.
   */
  it('readiness score is between 0-100 or null based on session count', () => {
    // Generate number of sessions (0-10)
    const numSessionsArb = fc.integer({ min: 0, max: 10 });

    // Generate number of questions per session (5-30)
    const questionsPerSessionArb = fc.integer({ min: 5, max: 30 });

    // Generate correctness for each answer (0 or 1)
    const isCorrectArb = fc.integer({ min: 0, max: 1 });

    // Generate time spent (30-300 seconds)
    const timeSpentArb = fc.integer({ min: 30, max: 300 });

    // Generate confidence level (or null)
    const confidenceLevelArb = fc.oneof(
      fc.constant(null),
      fc.constantFrom('Low', 'Medium', 'High'),
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }), // number of domains
        fc.integer({ min: 1, max: 5 }), // number of topics
        numSessionsArb,
        questionsPerSessionArb,
        (numDomains, numTopics, numSessions, questionsPerSession) => {
          // Generate unique IDs for this test run
          const userId = uuidv4();
          const certificationId = uuidv4();
          const domainIds = Array.from({ length: numDomains }, () => uuidv4());
          const topicIds = Array.from({ length: numTopics }, () => uuidv4());
          // Setup: Create test data
          testDb
            .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
            .run(userId, `${userId}@test.com`, 'hash');

          testDb
            .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
            .run(certificationId, 'Test Cert');

          // Create exam configuration
          const examConfigId = uuidv4();
          testDb
            .prepare(
              'INSERT INTO exam_configurations (id, certificationId, duration, totalQuestions) VALUES (?, ?, ?, ?)',
            )
            .run(
              examConfigId,
              certificationId,
              90, // 90 minutes
              questionsPerSession,
            );

          // Create domains with equal weights
          domainIds.forEach((domainId, idx) => {
            testDb
              .prepare(
                'INSERT INTO domain_weights (id, certificationId, domainName, weightPercentage) VALUES (?, ?, ?, ?)',
              )
              .run(domainId, certificationId, `Domain ${idx}`, 100 / domainIds.length);
          });

          // Create topics
          topicIds.forEach((topicId, idx) => {
            testDb
              .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
              .run(topicId, certificationId, `Topic ${idx}`);
          });

          // Create questions
          const questionIds: string[] = [];
          for (let i = 0; i < questionsPerSession; i++) {
            const questionId = uuidv4();
            questionIds.push(questionId);
            const domainId = domainIds[i % domainIds.length];
            const topicId = topicIds[i % topicIds.length];

            testDb
              .prepare(
                `
              INSERT INTO questions (id, certificationId, topicId, domainId, questionText, questionType, correctAnswers)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
              )
              .run(
                questionId,
                certificationId,
                topicId,
                domainId,
                `Question ${i}`,
                'single',
                JSON.stringify(['A']),
              );
          }

          // Create exam sessions with answers
          for (let sessionIdx = 0; sessionIdx < numSessions; sessionIdx++) {
            const sessionId = uuidv4();

            testDb
              .prepare(
                'INSERT INTO exam_sessions (id, userId, certificationId, examConfigurationId, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
              )
              .run(
                sessionId,
                userId,
                certificationId,
                examConfigId,
                'completed',
                new Date(Date.now() - (numSessions - sessionIdx) * 86400000).toISOString(), // Spread sessions over days
              );

            // Create answers for this session
            questionIds.forEach((questionId) => {
              const isCorrect = fc.sample(isCorrectArb, 1)[0];
              const timeSpent = fc.sample(timeSpentArb, 1)[0];
              const confidenceLevel = fc.sample(confidenceLevelArb, 1)[0];

              testDb
                .prepare(
                  `
                INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, timeSpent, confidenceLevel)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
                )
                .run(
                  uuidv4(),
                  sessionId,
                  questionId,
                  JSON.stringify('A'),
                  isCorrect,
                  timeSpent,
                  confidenceLevel,
                );
            });
          }

          // Test: Calculate readiness score
          const readinessScore = analyticsService.calculateReadinessScore(userId, certificationId);

          // Verify: Score is null if fewer than 3 sessions, otherwise between 0-100
          if (numSessions < 3) {
            expect(readinessScore).toBeNull();
          } else {
            expect(readinessScore).not.toBeNull();
            expect(readinessScore!.overallScore).toBeGreaterThanOrEqual(0);
            expect(readinessScore!.overallScore).toBeLessThanOrEqual(100);

            // Also verify component scores are within bounds
            expect(readinessScore!.consistencyScore).toBeGreaterThanOrEqual(0);
            expect(readinessScore!.consistencyScore).toBeLessThanOrEqual(100);
            expect(readinessScore!.pacingScore).toBeGreaterThanOrEqual(0);
            expect(readinessScore!.pacingScore).toBeLessThanOrEqual(100);
          }

          // Cleanup: Clear database for next iteration
          testDb.prepare('DELETE FROM exam_answers').run();
          testDb.prepare('DELETE FROM exam_sessions').run();
          testDb.prepare('DELETE FROM questions').run();
          testDb.prepare('DELETE FROM topics').run();
          testDb.prepare('DELETE FROM domain_weights').run();
          testDb.prepare('DELETE FROM exam_configurations').run();
          testDb.prepare('DELETE FROM certifications').run();
          testDb.prepare('DELETE FROM users').run();
        },
      ),
      { numRuns: 50 }, // Run 50 test cases with different random inputs
    );
  });
});
