import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { AnalyticsService } from './AnalyticsService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for AnalyticsService proficiency calculations
 * Feature: insight-dashboard
 * Task: 2.2 Write property test for proficiency calculation
 */

describe('AnalyticsService - Property 1: Proficiency score bounds', () => {
  let testDb: Database.Database;
  let analyticsService: AnalyticsService;
  let dbModuleSpy: any;

  beforeEach(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Mock the db module to use our test database
    const dbModule = await import('../db/connection');
    dbModuleSpy = vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

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

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        status TEXT NOT NULL,
        examName TEXT,
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
    if (dbModuleSpy) {
      dbModuleSpy.mockRestore();
    }
  });

  /**
   * **Validates: Requirements 1.3, 3.3**
   *
   * Property: Proficiency scores are always between 0 and 100
   *
   * This property verifies that regardless of the input data (number of questions,
   * correct/incorrect answers, domains, topics, subtopics), the proficiency scores
   * returned by calculateDomainProficiency, calculateTopicProficiency, and
   * calculateSubtopicProficiency are always within the valid range of 0-100.
   */
  it('proficiency scores are always between 0 and 100 for all calculation methods', () => {
    // Arbitraries for generating test data
    const userIdArb = fc.uuid();
    const certificationIdArb = fc.uuid();
    const domainIdArb = fc.uuid();
    const topicIdArb = fc.uuid();
    const subtopicIdArb = fc.uuid();

    // Generate a random number of questions (1-50)
    const questionsArb = fc.integer({ min: 1, max: 50 });

    // Generate correctness for each answer (0 or 1)
    const isCorrectArb = fc.integer({ min: 0, max: 1 });

    fc.assert(
      fc.property(
        userIdArb,
        certificationIdArb,
        fc.array(domainIdArb, { minLength: 1, maxLength: 5 }),
        fc.array(topicIdArb, { minLength: 1, maxLength: 10 }),
        fc.array(subtopicIdArb, { minLength: 0, maxLength: 15 }),
        questionsArb,
        (userId, certificationId, domainIds, topicIds, subtopicIds, numQuestions) => {
          // Setup: Create test data
          testDb
            .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
            .run(userId, `${userId}@test.com`, 'hash');

          testDb
            .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
            .run(certificationId, 'Test Cert');

          // Deduplicate IDs to prevent PRIMARY KEY / UNIQUE constraint violations
          const uniqueDomainIds = [...new Set(domainIds)];
          const uniqueTopicIds = [...new Set(topicIds)];
          const uniqueSubtopicIds = [...new Set(subtopicIds)];

          // Create domains
          uniqueDomainIds.forEach((domainId, idx) => {
            testDb
              .prepare(
                'INSERT INTO domain_weights (id, certificationId, domainName, weightPercentage) VALUES (?, ?, ?, ?)',
              )
              .run(domainId, certificationId, `Domain ${idx}`, 100 / uniqueDomainIds.length);
          });

          // Create topics
          uniqueTopicIds.forEach((topicId, idx) => {
            testDb
              .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
              .run(topicId, certificationId, `Topic ${idx}`);
          });

          // Create subtopics
          uniqueSubtopicIds.forEach((subtopicId, idx) => {
            const topicId = uniqueTopicIds[idx % uniqueTopicIds.length];
            testDb
              .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
              .run(subtopicId, topicId, `Subtopic ${idx}`);
          });

          // Create exam session
          const sessionId = uuidv4();
          testDb
            .prepare(
              'INSERT INTO exam_sessions (id, userId, certificationId, status) VALUES (?, ?, ?, ?)',
            )
            .run(sessionId, userId, certificationId, 'completed');

          // Create questions and answers
          for (let i = 0; i < numQuestions; i++) {
            const questionId = uuidv4();
            const domainId = uniqueDomainIds[i % uniqueDomainIds.length];
            const topicId = uniqueTopicIds[i % uniqueTopicIds.length];
            const subtopicId =
              uniqueSubtopicIds.length > 0 ? uniqueSubtopicIds[i % uniqueSubtopicIds.length] : null;

            // Generate random correctness
            const isCorrect = fc.sample(isCorrectArb, 1)[0];

            testDb
              .prepare(
                `
              INSERT INTO questions (id, certificationId, topicId, subTopicId, domainId, questionText, questionType, correctAnswers)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
              )
              .run(
                questionId,
                certificationId,
                topicId,
                subtopicId,
                domainId,
                `Question ${i}`,
                'single',
                JSON.stringify(['A']),
              );

            testDb
              .prepare(
                `
              INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, timeSpent)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
              )
              .run(uuidv4(), sessionId, questionId, JSON.stringify('A'), isCorrect, 60);
          }

          // Test: Calculate proficiency scores
          const domainProficiency = analyticsService.calculateDomainProficiency(
            userId,
            certificationId,
          );
          const topicProficiency = analyticsService.calculateTopicProficiency(
            userId,
            certificationId,
          );
          const subtopicProficiency = analyticsService.calculateSubtopicProficiency(
            userId,
            certificationId,
          );

          // Verify: All proficiency scores are between 0 and 100
          domainProficiency.forEach((domain) => {
            expect(domain.proficiencyScore).toBeGreaterThanOrEqual(0);
            expect(domain.proficiencyScore).toBeLessThanOrEqual(100);
          });

          topicProficiency.forEach((topic) => {
            expect(topic.proficiencyScore).toBeGreaterThanOrEqual(0);
            expect(topic.proficiencyScore).toBeLessThanOrEqual(100);
          });

          subtopicProficiency.forEach((subtopic) => {
            expect(subtopic.proficiencyScore).toBeGreaterThanOrEqual(0);
            expect(subtopic.proficiencyScore).toBeLessThanOrEqual(100);
          });

          // Cleanup: Clear database for next iteration
          testDb.prepare('DELETE FROM exam_answers').run();
          testDb.prepare('DELETE FROM questions').run();
          testDb.prepare('DELETE FROM exam_sessions').run();
          testDb.prepare('DELETE FROM subtopics').run();
          testDb.prepare('DELETE FROM topics').run();
          testDb.prepare('DELETE FROM domain_weights').run();
          testDb.prepare('DELETE FROM certifications').run();
          testDb.prepare('DELETE FROM users').run();
        },
      ),
      { numRuns: 50 }, // Run 50 test cases with different random inputs
    );
  });
});
