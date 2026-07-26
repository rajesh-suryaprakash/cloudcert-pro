import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { QuestionHistoryService } from './QuestionHistoryService';
import { QuestionRepository } from '../repositories/QuestionRepository';
import fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for QuestionHistoryService - Active Questions Filtering
 * Feature: question-history-tracking
 * Task: 17.2 Write property test for active questions filtering
 *
 * Property 15: Active Questions Only in Statistics and Selection
 * Property 16: History Retention for Deactivated Questions
 * **Validates: Requirements 7.4, 8.1, 8.2, 8.3**
 */

describe('Feature: question-history-tracking, Property 15: Active Questions Only in Statistics and Selection', () => {
  let testDb: Database.Database;
  let service: QuestionHistoryService;
  let questionRepo: QuestionRepository;

  beforeEach(() => {
    testDb = new Database(':memory:');
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        vendor TEXT,
        level TEXT DEFAULT 'Associate',
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

      CREATE TABLE sub_topics (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        orderIndex INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        subTopicId TEXT,
        questionText TEXT NOT NULL,
        questionType TEXT DEFAULT 'single',
        options TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'Medium',
        tags TEXT DEFAULT '[]',
        points INTEGER DEFAULT 1,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY(subTopicId) REFERENCES sub_topics(id) ON DELETE SET NULL
      );

      CREATE TABLE question_history (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        seenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(userId, certificationId, questionId)
      );

      CREATE INDEX idx_question_history_user_cert ON question_history(userId, certificationId);
      CREATE INDEX idx_question_history_lookup ON question_history(userId, certificationId, questionId);
    `);

    service = new QuestionHistoryService(testDb);
    questionRepo = new QuestionRepository(testDb);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  // Helper functions
  function createUser(id: string = uuidv4()): string {
    const now = Date.now();
    testDb
      .prepare(
        'INSERT INTO users (id, email, password, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, `user${id}@test.com`, 'hashedpassword', 'Test User', now, now);
    return id;
  }

  function createCertification(id: string = uuidv4()): string {
    const now = Date.now();
    testDb
      .prepare(
        'INSERT INTO certifications (id, title, description, vendor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, 'Test Certification', 'Test Description', 'Test Vendor', now, now);
    return id;
  }

  function createTopic(certificationId: string, id: string = uuidv4()): string {
    testDb
      .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
      .run(id, certificationId, 'Test Topic');
    return id;
  }

  function createQuestion(topicId: string, isActive: number = 1, id: string = uuidv4()): string {
    testDb
      .prepare(
        'INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        topicId,
        'Test question',
        JSON.stringify(['A', 'B', 'C']),
        JSON.stringify(['A']),
        isActive,
      );
    return id;
  }

  it('Property 15: For any certification with both active and inactive questions, statistics should only consider active questions', () => {
    fc.assert(
      fc.property(
        // Generate active questions (1-50) and inactive questions (0-30)
        fc
          .record({
            activeQuestions: fc.integer({ min: 1, max: 50 }),
            inactiveQuestions: fc.nat({ max: 30 }),
            seenActiveQuestions: fc.nat({ max: 50 }),
            seenInactiveQuestions: fc.nat({ max: 30 }),
          })
          .chain(
            ({ activeQuestions, inactiveQuestions, seenActiveQuestions, seenInactiveQuestions }) =>
              fc.record({
                activeQuestions: fc.constant(activeQuestions),
                inactiveQuestions: fc.constant(inactiveQuestions),
                seenActiveQuestions: fc.constant(Math.min(seenActiveQuestions, activeQuestions)),
                seenInactiveQuestions: fc.constant(
                  Math.min(seenInactiveQuestions, inactiveQuestions),
                ),
              }),
          ),
        ({ activeQuestions, inactiveQuestions, seenActiveQuestions, seenInactiveQuestions }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create active questions
          const activeQuestionIds: string[] = [];
          for (let i = 0; i < activeQuestions; i++) {
            activeQuestionIds.push(createQuestion(topicId, 1));
          }

          // Create inactive questions
          const inactiveQuestionIds: string[] = [];
          for (let i = 0; i < inactiveQuestions; i++) {
            inactiveQuestionIds.push(createQuestion(topicId, 0));
          }

          // Mark some active questions as seen
          const seenActiveIds = activeQuestionIds.slice(0, seenActiveQuestions);
          if (seenActiveIds.length > 0) {
            service.recordQuestionsSeen(userId, certificationId, seenActiveIds);
          }

          // Mark some inactive questions as seen
          const seenInactiveIds = inactiveQuestionIds.slice(0, seenInactiveQuestions);
          if (seenInactiveIds.length > 0) {
            service.recordQuestionsSeen(userId, certificationId, seenInactiveIds);
          }

          // Act: Get history statistics
          const stats = service.getHistoryStats(userId, certificationId);

          // Assert: Total count should only include active questions
          expect(stats.totalCount).toBe(activeQuestions);

          // Assert: Seen count should only include active questions
          expect(stats.seenCount).toBe(seenActiveQuestions);

          // Property: Inactive questions should not affect statistics
          const totalWithInactive = testDb
            .prepare(
              `
              SELECT COUNT(*) as count
              FROM questions q
              JOIN topics t ON q.topicId = t.id
              WHERE t.certificationId = ?
            `,
            )
            .get(certificationId) as { count: number };

          expect(stats.totalCount).toBeLessThanOrEqual(totalWithInactive.count);

          // Property: Percentage should be calculated based on active questions only
          const expectedPercentage =
            activeQuestions > 0
              ? Math.round((seenActiveQuestions / activeQuestions) * 100 * 100) / 100
              : 0;
          expect(stats.percentageSeen).toBe(expectedPercentage);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 15: Question selection should only return active questions', () => {
    fc.assert(
      fc.property(
        // Generate active questions (10-50) and inactive questions (5-20)
        fc
          .record({
            activeQuestions: fc.integer({ min: 10, max: 50 }),
            inactiveQuestions: fc.integer({ min: 5, max: 20 }),
            seenActiveQuestions: fc.nat({ max: 25 }),
          })
          .chain(({ activeQuestions, inactiveQuestions, seenActiveQuestions }) =>
            fc.record({
              activeQuestions: fc.constant(activeQuestions),
              inactiveQuestions: fc.constant(inactiveQuestions),
              seenActiveQuestions: fc.constant(Math.min(seenActiveQuestions, activeQuestions)),
            }),
          ),
        ({ activeQuestions, inactiveQuestions, seenActiveQuestions }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create active questions
          const activeQuestionIds: string[] = [];
          for (let i = 0; i < activeQuestions; i++) {
            activeQuestionIds.push(createQuestion(topicId, 1));
          }

          // Create inactive questions
          const inactiveQuestionIds: string[] = [];
          for (let i = 0; i < inactiveQuestions; i++) {
            inactiveQuestionIds.push(createQuestion(topicId, 0));
          }

          // Mark some active questions as seen
          const seenActiveIds = activeQuestionIds.slice(0, seenActiveQuestions);
          if (seenActiveIds.length > 0) {
            service.recordQuestionsSeen(userId, certificationId, seenActiveIds);
          }

          // Act: Get seen question IDs and query unseen questions
          const seenQuestionIds = service.getSeenQuestionIds(userId, certificationId);
          const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
            certificationId,
            seenQuestionIds,
          );

          // Assert: All returned questions should be active
          for (const question of unseenQuestions) {
            expect(question.isActive).toBe(1);
          }

          // Assert: No inactive questions should be in the result
          const unseenQuestionIds = unseenQuestions.map((q) => q.id);
          for (const inactiveId of inactiveQuestionIds) {
            expect(unseenQuestionIds).not.toContain(inactiveId);
          }

          // Property: Unseen questions should only include active questions not in seen list
          const expectedUnseenCount = activeQuestions - seenActiveQuestions;
          expect(unseenQuestions.length).toBe(expectedUnseenCount);

          // Property: All unseen questions should be from active set
          for (const question of unseenQuestions) {
            expect(activeQuestionIds).toContain(question.id);
            expect(seenActiveIds).not.toContain(question.id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: question-history-tracking, Property 16: History Retention for Deactivated Questions', () => {
  let testDb: Database.Database;
  let service: QuestionHistoryService;

  beforeEach(() => {
    testDb = new Database(':memory:');
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        vendor TEXT,
        level TEXT DEFAULT 'Associate',
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

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        subTopicId TEXT,
        questionText TEXT NOT NULL,
        questionType TEXT DEFAULT 'single',
        options TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'Medium',
        tags TEXT DEFAULT '[]',
        points INTEGER DEFAULT 1,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
      );

      CREATE TABLE question_history (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        seenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(userId, certificationId, questionId)
      );

      CREATE INDEX idx_question_history_user_cert ON question_history(userId, certificationId);
      CREATE INDEX idx_question_history_lookup ON question_history(userId, certificationId, questionId);
    `);

    service = new QuestionHistoryService(testDb);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  // Helper functions
  function createUser(id: string = uuidv4()): string {
    const now = Date.now();
    testDb
      .prepare(
        'INSERT INTO users (id, email, password, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, `user${id}@test.com`, 'hashedpassword', 'Test User', now, now);
    return id;
  }

  function createCertification(id: string = uuidv4()): string {
    const now = Date.now();
    testDb
      .prepare(
        'INSERT INTO certifications (id, title, description, vendor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, 'Test Certification', 'Test Description', 'Test Vendor', now, now);
    return id;
  }

  function createTopic(certificationId: string, id: string = uuidv4()): string {
    testDb
      .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
      .run(id, certificationId, 'Test Topic');
    return id;
  }

  function createQuestion(topicId: string, isActive: number = 1, id: string = uuidv4()): string {
    testDb
      .prepare(
        'INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        topicId,
        'Test question',
        JSON.stringify(['A', 'B', 'C']),
        JSON.stringify(['A']),
        isActive,
      );
    return id;
  }

  function _deactivateQuestion(questionId: string): void {
    testDb.prepare('UPDATE questions SET isActive = 0 WHERE id = ?').run(questionId);
  }

  it('Property 16: For any question that is marked as seen and then deactivated, the history record should remain in the database', () => {
    fc.assert(
      fc.property(
        // Generate questions (10-50) and select some to deactivate (1-20)
        fc.integer({ min: 10, max: 50 }).chain((totalQuestions) =>
          fc.record({
            totalQuestions: fc.constant(totalQuestions),
            questionsToDeactivate: fc.integer({ min: 1, max: Math.min(20, totalQuestions) }),
          }),
        ),
        ({ totalQuestions, questionsToDeactivate }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create questions (all active initially)
          const questionIds: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            questionIds.push(createQuestion(topicId, 1));
          }

          // Record all questions as seen
          service.recordQuestionsSeen(userId, certificationId, questionIds);

          // Verify all questions are recorded in history
          const historyBeforeDeactivation = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };
          expect(historyBeforeDeactivation.count).toBe(totalQuestions);

          // Deactivate some questions
          const questionsToDeactivateIds = questionIds.slice(0, questionsToDeactivate);
          for (const questionId of questionsToDeactivateIds) {
            _deactivateQuestion(questionId);
          }

          // Assert: History records should still exist for deactivated questions
          const historyAfterDeactivation = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };
          expect(historyAfterDeactivation.count).toBe(totalQuestions);

          // Property: Each deactivated question should still have a history record
          for (const questionId of questionsToDeactivateIds) {
            const historyRecord = testDb
              .prepare(
                'SELECT * FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, certificationId, questionId);
            expect(historyRecord).toBeDefined();
          }

          // Property: getSeenQuestionIds should still return deactivated questions
          const seenQuestionIds = service.getSeenQuestionIds(userId, certificationId);
          expect(seenQuestionIds.length).toBe(totalQuestions);
          for (const questionId of questionsToDeactivateIds) {
            expect(seenQuestionIds).toContain(questionId);
          }

          // Property: Statistics should exclude deactivated questions from counts
          const stats = service.getHistoryStats(userId, certificationId);
          const activeQuestions = totalQuestions - questionsToDeactivate;
          expect(stats.totalCount).toBe(activeQuestions);
          expect(stats.seenCount).toBe(activeQuestions);

          // Calculate expected percentage (handle case where all questions are deactivated)
          const expectedPercentage = activeQuestions > 0 ? 100 : 0;
          expect(stats.percentageSeen).toBe(expectedPercentage); // All active questions are seen
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 16: Deactivating and reactivating questions should not affect history records', () => {
    fc.assert(
      fc.property(
        // Generate questions (10-30) and select some to toggle (1-15)
        fc.integer({ min: 10, max: 30 }).chain((totalQuestions) =>
          fc.record({
            totalQuestions: fc.constant(totalQuestions),
            questionsToToggle: fc.integer({ min: 1, max: Math.min(15, totalQuestions) }),
          }),
        ),
        ({ totalQuestions, questionsToToggle }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create questions (all active initially)
          const questionIds: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            questionIds.push(createQuestion(topicId, 1));
          }

          // Record all questions as seen
          service.recordQuestionsSeen(userId, certificationId, questionIds);

          // Get initial history count
          const initialHistoryCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          // Deactivate some questions
          const questionsToToggleIds = questionIds.slice(0, questionsToToggle);
          for (const questionId of questionsToToggleIds) {
            _deactivateQuestion(questionId);
          }

          // Verify history count unchanged after deactivation
          const historyAfterDeactivation = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };
          expect(historyAfterDeactivation.count).toBe(initialHistoryCount.count);

          // Reactivate the questions
          for (const questionId of questionsToToggleIds) {
            testDb.prepare('UPDATE questions SET isActive = 1 WHERE id = ?').run(questionId);
          }

          // Verify history count still unchanged after reactivation
          const historyAfterReactivation = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };
          expect(historyAfterReactivation.count).toBe(initialHistoryCount.count);

          // Property: Statistics should reflect all questions as seen after reactivation
          const stats = service.getHistoryStats(userId, certificationId);
          expect(stats.totalCount).toBe(totalQuestions);
          expect(stats.seenCount).toBe(totalQuestions);
          expect(stats.percentageSeen).toBe(100);

          // Property: All history records should still exist
          for (const questionId of questionIds) {
            const historyRecord = testDb
              .prepare(
                'SELECT * FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, certificationId, questionId);
            expect(historyRecord).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 16 Edge Case: Deactivating all seen questions should result in 0% seen in statistics', () => {
    fc.assert(
      fc.property(
        // Generate questions (5-30)
        fc.integer({ min: 5, max: 30 }),
        (totalQuestions) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create questions (all active initially)
          const questionIds: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            questionIds.push(createQuestion(topicId, 1));
          }

          // Record all questions as seen
          service.recordQuestionsSeen(userId, certificationId, questionIds);

          // Verify all questions are seen
          const statsBeforeDeactivation = service.getHistoryStats(userId, certificationId);
          expect(statsBeforeDeactivation.seenCount).toBe(totalQuestions);
          expect(statsBeforeDeactivation.totalCount).toBe(totalQuestions);
          expect(statsBeforeDeactivation.percentageSeen).toBe(100);

          // Deactivate all questions
          for (const questionId of questionIds) {
            _deactivateQuestion(questionId);
          }

          // Assert: History records should still exist
          const historyCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };
          expect(historyCount.count).toBe(totalQuestions);

          // Assert: Statistics should show 0 seen and 0 total (no active questions)
          const statsAfterDeactivation = service.getHistoryStats(userId, certificationId);
          expect(statsAfterDeactivation.seenCount).toBe(0);
          expect(statsAfterDeactivation.totalCount).toBe(0);
          expect(statsAfterDeactivation.percentageSeen).toBe(0);

          // Property: getSeenQuestionIds should still return all question IDs
          const seenQuestionIds = service.getSeenQuestionIds(userId, certificationId);
          expect(seenQuestionIds.length).toBe(totalQuestions);
        },
      ),
      { numRuns: 100 },
    );
  });
});
