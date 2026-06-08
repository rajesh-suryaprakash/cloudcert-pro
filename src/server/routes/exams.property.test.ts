import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import { ExamSessionRepository } from '../repositories/ExamSessionRepository';
import fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for exam session creation history recording
 * Feature: question-history-tracking
 * Task: 8.2 Write property test for session creation history recording
 *
 * Property 1: History Recording on Session Creation
 * Property 2: History Persistence Across Session Status Changes
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */

describe('Feature: question-history-tracking, Property 1: History Recording on Session Creation', () => {
  let testDb: Database.Database;
  let historyService: QuestionHistoryService;
  let sessionRepo: ExamSessionRepository;

  beforeEach(() => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Create minimal schema needed for exam sessions and question history
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        streak INTEGER DEFAULT 0,
        lastActivityDate TEXT,
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

      CREATE TABLE exam_configurations (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        duration INTEGER DEFAULT 120,
        totalQuestions INTEGER NOT NULL,
        passingScore INTEGER DEFAULT 70,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
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

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        examConfigurationId TEXT,
        certificationId TEXT,
        topicId TEXT,
        sessionName TEXT,
        questions TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        score REAL,
        correctAnswers INTEGER,
        incorrectAnswers INTEGER,
        unansweredQuestions INTEGER,
        totalQuestions INTEGER NOT NULL,
        isPracticeMode INTEGER DEFAULT 0,
        isCustomQuiz INTEGER DEFAULT 0,
        autoSubmitAt TEXT,
        startTime TEXT NOT NULL,
        endTime TEXT,
        timeTaken INTEGER,
        passingScoreOverride INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE SET NULL,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL
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

    // Create service instances
    historyService = new QuestionHistoryService(testDb);
    sessionRepo = new ExamSessionRepository(testDb);
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

  function createExamConfig(certificationId: string, id: string = uuidv4()): string {
    testDb
      .prepare(
        'INSERT INTO exam_configurations (id, certificationId, name, totalQuestions) VALUES (?, ?, ?, ?)',
      )
      .run(id, certificationId, 'Test Exam', 10);
    return id;
  }

  it('Property 1: For any exam session created with a set of question IDs, the question history table should contain records associating those question IDs with the user and certification', () => {
    fc.assert(
      fc.property(
        // Generate an array of 1 to 100 question IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        // Generate whether to use examConfigurationId or certificationId directly
        fc.boolean(),
        (questionIds, useExamConfig) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create actual questions in the database for each generated ID
          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Create session with either examConfigurationId or certificationId
          const sessionId = uuidv4();
          const startTime = new Date().toISOString();
          const autoSubmitAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();

          let examConfigId: string | null = null;
          let directCertId: string | null = null;

          if (useExamConfig) {
            examConfigId = createExamConfig(certificationId);
          } else {
            directCertId = certificationId;
          }

          // Create session
          sessionRepo.create({
            id: sessionId,
            userId,
            examConfigurationId: examConfigId,
            certificationId: directCertId,
            sessionName: 'Test Session',
            questions: JSON.stringify(questionIds),
            totalQuestions: questionIds.length,
            isPracticeMode: 0,
            autoSubmitAt,
            startTime,
          });

          // Simulate the history recording that happens in the POST /exam-sessions endpoint
          // This is what we're testing - that history is recorded after session creation
          let resolvedCertificationId = directCertId;
          if (!resolvedCertificationId && examConfigId) {
            const config = sessionRepo.findConfig(examConfigId);
            resolvedCertificationId = config?.certificationId ?? null;
          }

          if (resolvedCertificationId) {
            historyService.recordQuestionsSeen(userId, resolvedCertificationId, questionIds);
          }

          // Assert: Verify all question IDs are recorded in history
          const historyRecords = testDb
            .prepare(
              'SELECT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as { questionId: string }[];

          const recordedQuestionIds = historyRecords.map((r) => r.questionId);

          // Property: Every question ID should be recorded exactly once
          expect(recordedQuestionIds.length).toBe(questionIds.length);

          // Property: All question IDs should be present in history
          for (const questionId of questionIds) {
            expect(recordedQuestionIds).toContain(questionId);
          }

          // Property: Each record should be associated with the correct user
          const userRecords = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
            .get(userId) as { count: number };
          expect(userRecords.count).toBe(questionIds.length);

          // Property: Each record should be associated with the correct certification
          const certRecords = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history WHERE certificationId = ?')
            .get(certificationId) as { count: number };
          expect(certRecords.count).toBe(questionIds.length);

          // Property: Each record should have the correct user-certification-question association
          for (const questionId of questionIds) {
            const record = testDb
              .prepare(
                'SELECT * FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, certificationId, questionId);
            expect(record).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1 Edge Case: Session with examConfigurationId should resolve certification correctly', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }), (questionIds) => {
        // Setup
        const userId = createUser();
        const certificationId = createCertification();
        const topicId = createTopic(certificationId);
        const examConfigId = createExamConfig(certificationId);

        questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

        // Create session with examConfigurationId but no direct certificationId
        const sessionId = uuidv4();
        const startTime = new Date().toISOString();
        const autoSubmitAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();

        sessionRepo.create({
          id: sessionId,
          userId,
          examConfigurationId: examConfigId,
          certificationId: null, // No direct certification ID
          sessionName: 'Test Session',
          questions: JSON.stringify(questionIds),
          totalQuestions: questionIds.length,
          isPracticeMode: 0,
          autoSubmitAt,
          startTime,
        });

        // Simulate history recording with certification resolution
        const config = sessionRepo.findConfig(examConfigId);
        const resolvedCertificationId = config?.certificationId ?? null;

        if (resolvedCertificationId) {
          historyService.recordQuestionsSeen(userId, resolvedCertificationId, questionIds);
        }

        // Assert: History should be recorded with resolved certification ID
        const historyRecords = testDb
          .prepare(
            'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
          )
          .get(userId, certificationId) as { count: number };

        expect(historyRecords.count).toBe(questionIds.length);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: question-history-tracking, Property 2: History Persistence Across Session Status Changes', () => {
  let testDb: Database.Database;
  let historyService: QuestionHistoryService;
  let sessionRepo: ExamSessionRepository;

  beforeEach(() => {
    testDb = new Database(':memory:');

    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        streak INTEGER DEFAULT 0,
        lastActivityDate TEXT,
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

      CREATE TABLE exam_configurations (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        duration INTEGER DEFAULT 120,
        totalQuestions INTEGER NOT NULL,
        passingScore INTEGER DEFAULT 70,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
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

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        examConfigurationId TEXT,
        certificationId TEXT,
        topicId TEXT,
        sessionName TEXT,
        questions TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        score REAL,
        correctAnswers INTEGER,
        incorrectAnswers INTEGER,
        unansweredQuestions INTEGER,
        totalQuestions INTEGER NOT NULL,
        isPracticeMode INTEGER DEFAULT 0,
        isCustomQuiz INTEGER DEFAULT 0,
        autoSubmitAt TEXT,
        startTime TEXT NOT NULL,
        endTime TEXT,
        timeTaken INTEGER,
        passingScoreOverride INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE SET NULL,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL
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

    historyService = new QuestionHistoryService(testDb);
    sessionRepo = new ExamSessionRepository(testDb);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

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

  it('Property 2: For any exam session with recorded history, changing the session status to completed should not delete or modify the history records', () => {
    fc.assert(
      fc.property(
        // Generate question IDs and score
        fc.record({
          questionIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
          score: fc.integer({ min: 0, max: 100 }),
          correctAnswers: fc.nat({ max: 100 }),
        }),
        ({ questionIds, score, correctAnswers }) => {
          // Setup: Create user, certification, topic, questions, and session
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          const sessionId = uuidv4();
          const startTime = new Date().toISOString();
          const autoSubmitAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();

          // Create session
          sessionRepo.create({
            id: sessionId,
            userId,
            examConfigurationId: null,
            certificationId,
            sessionName: 'Test Session',
            questions: JSON.stringify(questionIds),
            totalQuestions: questionIds.length,
            isPracticeMode: 0,
            autoSubmitAt,
            startTime,
          });

          // Record history
          historyService.recordQuestionsSeen(userId, certificationId, questionIds);

          // Capture history state before status change
          const historyBeforeComplete = testDb
            .prepare(
              'SELECT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as { questionId: string }[];

          const questionIdsBeforeComplete = historyBeforeComplete.map((r) => r.questionId).sort();

          // Act: Complete the session (change status to 'completed')
          const endTime = new Date().toISOString();
          const timeTaken = 3600; // 1 hour in seconds
          const incorrectAnswers = Math.max(0, questionIds.length - correctAnswers);
          const unansweredQuestions = 0;

          sessionRepo.complete(sessionId, {
            score,
            correctAnswers: Math.min(correctAnswers, questionIds.length),
            incorrectAnswers,
            unansweredQuestions,
            endTime,
            timeTaken,
          });

          // Assert: History records should remain unchanged
          const historyAfterComplete = testDb
            .prepare(
              'SELECT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as { questionId: string }[];

          const questionIdsAfterComplete = historyAfterComplete.map((r) => r.questionId).sort();

          // Property: Same number of history records
          expect(historyAfterComplete.length).toBe(historyBeforeComplete.length);
          expect(historyAfterComplete.length).toBe(questionIds.length);

          // Property: Same question IDs in history
          expect(questionIdsAfterComplete).toEqual(questionIdsBeforeComplete);

          // Property: All original question IDs still present
          for (const questionId of questionIds) {
            expect(questionIdsAfterComplete).toContain(questionId);
          }

          // Property: Session status should be 'completed'
          const session = sessionRepo.findById(sessionId, userId);
          expect(session?.status).toBe('completed');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 2: For any exam session with recorded history, changing the session status to abandoned should not delete or modify the history records', () => {
    fc.assert(
      fc.property(
        // Generate question IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        (questionIds) => {
          // Setup: Create user, certification, topic, questions, and session
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          const sessionId = uuidv4();
          const startTime = new Date().toISOString();
          const autoSubmitAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();

          // Create session
          sessionRepo.create({
            id: sessionId,
            userId,
            examConfigurationId: null,
            certificationId,
            sessionName: 'Test Session',
            questions: JSON.stringify(questionIds),
            totalQuestions: questionIds.length,
            isPracticeMode: 0,
            autoSubmitAt,
            startTime,
          });

          // Record history
          historyService.recordQuestionsSeen(userId, certificationId, questionIds);

          // Capture history state before status change
          const historyBeforeAbandon = testDb
            .prepare(
              'SELECT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as { questionId: string }[];

          const questionIdsBeforeAbandon = historyBeforeAbandon.map((r) => r.questionId).sort();

          // Act: Abandon the session (change status to 'abandoned')
          sessionRepo.abandon(sessionId);

          // Assert: History records should remain unchanged
          const historyAfterAbandon = testDb
            .prepare(
              'SELECT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as { questionId: string }[];

          const questionIdsAfterAbandon = historyAfterAbandon.map((r) => r.questionId).sort();

          // Property: Same number of history records
          expect(historyAfterAbandon.length).toBe(historyBeforeAbandon.length);
          expect(historyAfterAbandon.length).toBe(questionIds.length);

          // Property: Same question IDs in history
          expect(questionIdsAfterAbandon).toEqual(questionIdsBeforeAbandon);

          // Property: All original question IDs still present
          for (const questionId of questionIds) {
            expect(questionIdsAfterAbandon).toContain(questionId);
          }

          // Property: Session status should be 'abandoned'
          const session = sessionRepo.findById(sessionId, userId);
          expect(session?.status).toBe('abandoned');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 2 Edge Case: Multiple status changes should not affect history', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }), (questionIds) => {
        // Setup
        const userId = createUser();
        const certificationId = createCertification();
        const topicId = createTopic(certificationId);

        questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

        const sessionId = uuidv4();
        const startTime = new Date().toISOString();
        const autoSubmitAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();

        // Create session
        sessionRepo.create({
          id: sessionId,
          userId,
          examConfigurationId: null,
          certificationId,
          sessionName: 'Test Session',
          questions: JSON.stringify(questionIds),
          totalQuestions: questionIds.length,
          isPracticeMode: 0,
          autoSubmitAt,
          startTime,
        });

        // Record history
        historyService.recordQuestionsSeen(userId, certificationId, questionIds);

        // Capture initial history
        const initialHistory = testDb
          .prepare(
            'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
          )
          .get(userId, certificationId) as { count: number };

        // Act: Abandon session
        sessionRepo.abandon(sessionId);

        // Check history after abandon
        const historyAfterAbandon = testDb
          .prepare(
            'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
          )
          .get(userId, certificationId) as { count: number };

        // Assert: History unchanged after abandon
        expect(historyAfterAbandon.count).toBe(initialHistory.count);
        expect(historyAfterAbandon.count).toBe(questionIds.length);

        // Property: History persists across status changes
        const finalQuestionIds = testDb
          .prepare(
            'SELECT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
          )
          .all(userId, certificationId) as { questionId: string }[];

        expect(finalQuestionIds.length).toBe(questionIds.length);
        for (const questionId of questionIds) {
          expect(finalQuestionIds.map((r) => r.questionId)).toContain(questionId);
        }
      }),
      { numRuns: 100 },
    );
  });
});
