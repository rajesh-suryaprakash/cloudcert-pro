import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { QuestionHistoryService } from './QuestionHistoryService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Unit tests for QuestionHistoryService
 * Feature: question-history-tracking
 * Task: 2.8 Write unit tests for QuestionHistoryService
 *
 * Tests verify:
 * - Recording questions seen
 * - Retrieving seen question IDs
 * - Calculating history statistics
 * - Resetting history
 * - Backfilling from existing sessions
 *
 * Requirements: 1.1, 1.2, 4.1, 5.1, 7.1, 9.2
 */

describe('QuestionHistoryService', () => {
  let testDb: Database.Database;
  let service: QuestionHistoryService;

  beforeEach(() => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Create minimal schema needed for question history service
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

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        examConfigurationId TEXT,
        certificationId TEXT,
        questions TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        totalQuestions INTEGER NOT NULL,
        startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL
      );

      CREATE TABLE exam_configurations (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        totalQuestions INTEGER NOT NULL,
        passingScore INTEGER NOT NULL,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );
    `);

    // Create service instance
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

  describe('recordQuestionsSeen', () => {
    it('should record questions seen by a user', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = [
        createQuestion(topicId),
        createQuestion(topicId),
        createQuestion(topicId),
      ];

      service.recordQuestionsSeen(userId, certId, questionIds);

      const records = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId) as any[];

      expect(records).toHaveLength(3);
      expect(records.map((r) => r.questionId).sort()).toEqual(questionIds.sort());
    });

    it('should handle empty array gracefully', () => {
      const userId = createUser();
      const certId = createCertification();

      service.recordQuestionsSeen(userId, certId, []);

      const records = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(records).toHaveLength(0);
    });

    it('should handle duplicate questions gracefully (INSERT OR IGNORE)', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionId = createQuestion(topicId);

      // Record the same question twice
      service.recordQuestionsSeen(userId, certId, [questionId]);
      service.recordQuestionsSeen(userId, certId, [questionId]);

      const records = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      // Should only have one record due to UNIQUE constraint and INSERT OR IGNORE
      expect(records).toHaveLength(1);
    });
  });

  describe('getSeenQuestionIds', () => {
    it('should return seen question IDs for a user and certification', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = [
        createQuestion(topicId),
        createQuestion(topicId),
        createQuestion(topicId),
      ];

      service.recordQuestionsSeen(userId, certId, questionIds);

      const seenIds = service.getSeenQuestionIds(userId, certId);

      expect(seenIds.sort()).toEqual(questionIds.sort());
    });

    it('should return empty array when no history exists', () => {
      const userId = createUser();
      const certId = createCertification();

      const seenIds = service.getSeenQuestionIds(userId, certId);

      expect(seenIds).toEqual([]);
    });

    it('should only return questions for the specified certification', () => {
      const userId = createUser();
      const cert1 = createCertification();
      const cert2 = createCertification();
      const topic1 = createTopic(cert1);
      const topic2 = createTopic(cert2);

      const cert1Questions = [createQuestion(topic1), createQuestion(topic1)];
      const cert2Questions = [createQuestion(topic2), createQuestion(topic2)];

      service.recordQuestionsSeen(userId, cert1, cert1Questions);
      service.recordQuestionsSeen(userId, cert2, cert2Questions);

      const seenIds = service.getSeenQuestionIds(userId, cert1);

      expect(seenIds.sort()).toEqual(cert1Questions.sort());
      expect(seenIds).not.toContain(cert2Questions[0]);
      expect(seenIds).not.toContain(cert2Questions[1]);
    });
  });

  describe('getHistoryStats', () => {
    it('should calculate statistics correctly', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);

      // Create 10 active questions
      const allQuestions = Array(10)
        .fill(null)
        .map(() => createQuestion(topicId, 1));

      // User has seen 3 of them
      service.recordQuestionsSeen(userId, certId, allQuestions.slice(0, 3));

      const stats = service.getHistoryStats(userId, certId);

      expect(stats.seenCount).toBe(3);
      expect(stats.totalCount).toBe(10);
      expect(stats.percentageSeen).toBe(30);
    });

    it('should only count active questions', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);

      // Create 5 active and 5 inactive questions
      const activeQuestions = Array(5)
        .fill(null)
        .map(() => createQuestion(topicId, 1));
      const inactiveQuestions = Array(5)
        .fill(null)
        .map(() => createQuestion(topicId, 0));

      // User has seen 2 active and 2 inactive
      service.recordQuestionsSeen(userId, certId, [
        ...activeQuestions.slice(0, 2),
        ...inactiveQuestions.slice(0, 2),
      ]);

      const stats = service.getHistoryStats(userId, certId);

      // Should only count active questions
      expect(stats.seenCount).toBe(2); // Only 2 active questions seen
      expect(stats.totalCount).toBe(5); // Only 5 active questions total
      expect(stats.percentageSeen).toBe(40); // 2/5 = 40%
    });

    it('should return zero stats when no questions exist', () => {
      const userId = createUser();
      const certId = createCertification();
      createTopic(certId); // Create topic but no questions

      const stats = service.getHistoryStats(userId, certId);

      expect(stats.seenCount).toBe(0);
      expect(stats.totalCount).toBe(0);
      expect(stats.percentageSeen).toBe(0);
    });

    it('should handle all questions seen', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);

      const allQuestions = Array(5)
        .fill(null)
        .map(() => createQuestion(topicId, 1));
      service.recordQuestionsSeen(userId, certId, allQuestions);

      const stats = service.getHistoryStats(userId, certId);

      expect(stats.seenCount).toBe(5);
      expect(stats.totalCount).toBe(5);
      expect(stats.percentageSeen).toBe(100);
    });
  });

  describe('resetHistory', () => {
    it('should delete all history records for a user and certification', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(5)
        .fill(null)
        .map(() => createQuestion(topicId));

      service.recordQuestionsSeen(userId, certId, questionIds);

      const deletedCount = service.resetHistory(userId, certId);

      expect(deletedCount).toBe(5);

      const remainingRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(remainingRecords).toHaveLength(0);
    });

    it('should return 0 when no history exists', () => {
      const userId = createUser();
      const certId = createCertification();

      const deletedCount = service.resetHistory(userId, certId);

      expect(deletedCount).toBe(0);
    });

    it('should only delete records for the specified certification', () => {
      const userId = createUser();
      const cert1 = createCertification();
      const cert2 = createCertification();
      const topic1 = createTopic(cert1);
      const topic2 = createTopic(cert2);

      const cert1Questions = Array(3)
        .fill(null)
        .map(() => createQuestion(topic1));
      const cert2Questions = Array(3)
        .fill(null)
        .map(() => createQuestion(topic2));

      service.recordQuestionsSeen(userId, cert1, cert1Questions);
      service.recordQuestionsSeen(userId, cert2, cert2Questions);

      const deletedCount = service.resetHistory(userId, cert1);

      expect(deletedCount).toBe(3);

      // Cert1 history should be gone
      const cert1Records = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, cert1);
      expect(cert1Records).toHaveLength(0);

      // Cert2 history should remain
      const cert2Records = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, cert2);
      expect(cert2Records).toHaveLength(3);
    });
  });

  describe('backfillFromExistingSessions', () => {
    it('should backfill history from existing sessions', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(5)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create an exam session
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(sessionId, userId, certId, JSON.stringify(questionIds), questionIds.length);

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(5);

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(5);
    });

    it('should handle sessions with examConfigurationId', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create exam configuration
      const configId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_configurations (id, certificationId, name, duration, totalQuestions, passingScore) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(configId, certId, 'Test Exam', 60, 50, 70);

      // Create session with examConfigurationId instead of certificationId
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, examConfigurationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(sessionId, userId, configId, JSON.stringify(questionIds), questionIds.length);

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(3);

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(3);
    });

    it('should handle malformed JSON gracefully', () => {
      const userId = createUser();
      const certId = createCertification();

      // Create session with malformed JSON
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(sessionId, userId, certId, 'invalid json', 0);

      const result = service.backfillFromExistingSessions();

      // Should process the session but create no records
      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(0);
    });

    it('should be idempotent (running twice should not create duplicates)', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));

      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(sessionId, userId, certId, JSON.stringify(questionIds), questionIds.length);

      // Run backfill twice
      const result1 = service.backfillFromExistingSessions();
      const result2 = service.backfillFromExistingSessions();

      expect(result1.recordsCreated).toBe(3);
      expect(result2.recordsCreated).toBe(0); // No new records on second run

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(3); // Still only 3 records
    });

    it('should return zero when no sessions exist', () => {
      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(0);
      expect(result.recordsCreated).toBe(0);
    });

    // Task 13.3: Additional unit tests for backfill migration
    it('should backfill from completed sessions', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(4)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create a completed session
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          sessionId,
          userId,
          certId,
          JSON.stringify(questionIds),
          questionIds.length,
          'completed',
        );

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(4);

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(4);
    });

    it('should backfill from in-progress sessions', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create an in-progress session
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          sessionId,
          userId,
          certId,
          JSON.stringify(questionIds),
          questionIds.length,
          'in_progress',
        );

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(3);

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(3);
    });

    it('should backfill from abandoned sessions', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const questionIds = Array(2)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create an abandoned session
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          sessionId,
          userId,
          certId,
          JSON.stringify(questionIds),
          questionIds.length,
          'abandoned',
        );

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(2);

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(2);
    });

    it('should skip sessions missing certificationId and examConfigurationId', () => {
      const userId = createUser();
      const topicId = createTopic(createCertification());
      const questionIds = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create session without certificationId or examConfigurationId
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, questions, totalQuestions) VALUES (?, ?, ?, ?)',
        )
        .run(sessionId, userId, JSON.stringify(questionIds), questionIds.length);

      const result = service.backfillFromExistingSessions();

      // Session is not processed because WHERE clause filters it out
      expect(result.sessionsProcessed).toBe(0);
      expect(result.recordsCreated).toBe(0);
    });

    it('should skip sessions with examConfigurationId that does not exist', () => {
      const userId = createUser();
      const topicId = createTopic(createCertification());
      const questionIds = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));

      // Create session with non-existent examConfigurationId
      const sessionId = uuidv4();
      const nonExistentConfigId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, examConfigurationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          sessionId,
          userId,
          nonExistentConfigId,
          JSON.stringify(questionIds),
          questionIds.length,
        );

      const result = service.backfillFromExistingSessions();

      // Session is processed but no records created because certificationId cannot be resolved
      expect(result.sessionsProcessed).toBe(1);
      expect(result.recordsCreated).toBe(0);
    });

    it('should handle multiple sessions with different statuses', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);

      // Create completed session
      const completedQuestions = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          uuidv4(),
          userId,
          certId,
          JSON.stringify(completedQuestions),
          completedQuestions.length,
          'completed',
        );

      // Create in-progress session
      const inProgressQuestions = Array(2)
        .fill(null)
        .map(() => createQuestion(topicId));
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          uuidv4(),
          userId,
          certId,
          JSON.stringify(inProgressQuestions),
          inProgressQuestions.length,
          'in_progress',
        );

      // Create abandoned session
      const abandonedQuestions = Array(4)
        .fill(null)
        .map(() => createQuestion(topicId));
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          uuidv4(),
          userId,
          certId,
          JSON.stringify(abandonedQuestions),
          abandonedQuestions.length,
          'abandoned',
        );

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(3);
      expect(result.recordsCreated).toBe(9); // 3 + 2 + 4

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(9);
    });

    it('should handle backfill with overlapping questions across sessions', () => {
      const userId = createUser();
      const certId = createCertification();
      const topicId = createTopic(certId);
      const sharedQuestions = Array(3)
        .fill(null)
        .map(() => createQuestion(topicId));
      const uniqueQuestions = Array(2)
        .fill(null)
        .map(() => createQuestion(topicId));

      // First session with shared questions
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), userId, certId, JSON.stringify(sharedQuestions), sharedQuestions.length);

      // Second session with shared + unique questions
      const allQuestions = [...sharedQuestions, ...uniqueQuestions];
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), userId, certId, JSON.stringify(allQuestions), allQuestions.length);

      const result = service.backfillFromExistingSessions();

      expect(result.sessionsProcessed).toBe(2);
      // Only 5 unique records created due to UNIQUE constraint
      expect(result.recordsCreated).toBe(5);

      const historyRecords = testDb
        .prepare('SELECT * FROM question_history WHERE userId = ? AND certificationId = ?')
        .all(userId, certId);

      expect(historyRecords).toHaveLength(5);
    });
  });
});
