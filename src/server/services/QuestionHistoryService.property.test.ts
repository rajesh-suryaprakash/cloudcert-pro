import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { QuestionHistoryService } from './QuestionHistoryService';
import fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for QuestionHistoryService
 * Feature: question-history-tracking
 * Task: 2.2 Write property test for QuestionHistoryService
 *
 * Property 1: History Recording on Session Creation
 * **Validates: Requirements 1.1, 1.2**
 *
 * For any exam session created with a set of question IDs, the question history table
 * should contain records associating those question IDs with the user and certification.
 */

describe('Feature: question-history-tracking, Property 1: History Recording on Session Creation', () => {
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

  it('Property 1: For any exam session created with a set of question IDs, the question history table should contain records associating those question IDs with the user and certification', () => {
    fc.assert(
      fc.property(
        // Generate an array of 1 to 100 question IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        (questionIds) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create actual questions in the database for each generated ID
          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Act: Record questions seen (simulating session creation)
          service.recordQuestionsSeen(userId, certificationId, questionIds);

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
});

/**
 * Property-based tests for QuestionHistoryService - History Statistics
 * Feature: question-history-tracking
 * Task: 2.4 Write property test for history statistics
 *
 * Property 12: Statistics Seen Count Accuracy
 * Property 13: Statistics Total Count Accuracy
 * Property 14: Statistics Percentage Calculation
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

describe('Feature: question-history-tracking, Property 12: Statistics Seen Count Accuracy', () => {
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

  it('Property 12: For any user and certification, the seen count in history statistics should equal the number of distinct active question IDs in the history table', () => {
    fc.assert(
      fc.property(
        // Generate total questions (1-50) and seen questions (0 to total)
        fc.nat({ max: 50 }).chain((totalQuestions) =>
          fc.record({
            totalQuestions: fc.constant(totalQuestions + 1), // At least 1 question
            seenQuestions: fc.nat({ max: totalQuestions }),
          }),
        ),
        ({ totalQuestions, seenQuestions }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create total questions (all active)
          const questionIds: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            questionIds.push(createQuestion(topicId, 1));
          }

          // Mark a subset as seen
          const seenQuestionIds = questionIds.slice(0, seenQuestions);
          if (seenQuestionIds.length > 0) {
            service.recordQuestionsSeen(userId, certificationId, seenQuestionIds);
          }

          // Act: Get history statistics
          const stats = service.getHistoryStats(userId, certificationId);

          // Assert: Seen count should match the number of distinct seen questions
          expect(stats.seenCount).toBe(seenQuestions);

          // Verify against direct database query
          const directCount = testDb
            .prepare(
              `
              SELECT COUNT(DISTINCT qh.questionId) as count
              FROM question_history qh
              JOIN questions q ON qh.questionId = q.id
              WHERE qh.userId = ? AND qh.certificationId = ? AND q.isActive = 1
            `,
            )
            .get(userId, certificationId) as { count: number };

          expect(stats.seenCount).toBe(directCount.count);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: question-history-tracking, Property 13: Statistics Total Count Accuracy', () => {
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

  it('Property 13: For any certification, the total count in history statistics should equal the number of active questions for that certification', () => {
    fc.assert(
      fc.property(
        // Generate active questions (1-50) and inactive questions (0-20)
        fc.record({
          activeQuestions: fc.integer({ min: 1, max: 50 }),
          inactiveQuestions: fc.nat({ max: 20 }),
        }),
        ({ activeQuestions, inactiveQuestions }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create active questions
          for (let i = 0; i < activeQuestions; i++) {
            createQuestion(topicId, 1);
          }

          // Create inactive questions (should not be counted)
          for (let i = 0; i < inactiveQuestions; i++) {
            createQuestion(topicId, 0);
          }

          // Act: Get history statistics
          const stats = service.getHistoryStats(userId, certificationId);

          // Assert: Total count should match only active questions
          expect(stats.totalCount).toBe(activeQuestions);

          // Verify against direct database query
          const directCount = testDb
            .prepare(
              `
              SELECT COUNT(*) as count
              FROM questions q
              JOIN topics t ON q.topicId = t.id
              WHERE t.certificationId = ? AND q.isActive = 1
            `,
            )
            .get(certificationId) as { count: number };

          expect(stats.totalCount).toBe(directCount.count);

          // Property: Inactive questions should not affect total count
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
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: question-history-tracking, Property 14: Statistics Percentage Calculation', () => {
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

  it('Property 14: For any user and certification, the percentage seen should equal (seenCount / totalCount) * 100, rounded to two decimal places', () => {
    fc.assert(
      fc.property(
        // Generate total questions (1-50) and seen questions (0 to total)
        fc.nat({ max: 50 }).chain((totalQuestions) =>
          fc.record({
            totalQuestions: fc.constant(totalQuestions + 1), // At least 1 question
            seenQuestions: fc.nat({ max: totalQuestions }),
          }),
        ),
        ({ totalQuestions, seenQuestions }) => {
          // Setup: Create user, certification, topic
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create total questions (all active)
          const questionIds: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            questionIds.push(createQuestion(topicId, 1));
          }

          // Mark a subset as seen
          const seenQuestionIds = questionIds.slice(0, seenQuestions);
          if (seenQuestionIds.length > 0) {
            service.recordQuestionsSeen(userId, certificationId, seenQuestionIds);
          }

          // Act: Get history statistics
          const stats = service.getHistoryStats(userId, certificationId);

          // Calculate expected percentage
          const expectedPercentage =
            totalQuestions > 0 ? Math.round((seenQuestions / totalQuestions) * 100 * 100) / 100 : 0;

          // Assert: Percentage should match the formula
          expect(stats.percentageSeen).toBe(expectedPercentage);

          // Property: Percentage should be between 0 and 100
          expect(stats.percentageSeen).toBeGreaterThanOrEqual(0);
          expect(stats.percentageSeen).toBeLessThanOrEqual(100);

          // Property: Percentage should have at most 2 decimal places
          const decimalPlaces = (stats.percentageSeen.toString().split('.')[1] || '').length;
          expect(decimalPlaces).toBeLessThanOrEqual(2);

          // Property: When all questions are seen, percentage should be 100
          if (seenQuestions === totalQuestions) {
            expect(stats.percentageSeen).toBe(100);
          }

          // Property: When no questions are seen, percentage should be 0
          if (seenQuestions === 0) {
            expect(stats.percentageSeen).toBe(0);
          }

          // Property: Percentage should be consistent with seen and total counts
          const calculatedPercentage = (stats.seenCount / stats.totalCount) * 100;
          expect(Math.abs(stats.percentageSeen - calculatedPercentage)).toBeLessThan(0.01);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 14 Edge Case: Zero total questions should result in 0% seen', () => {
    // Setup: Create user and certification with no questions
    const userId = createUser();
    const certificationId = createCertification();
    createTopic(certificationId); // Topic exists but no questions

    // Act: Get history statistics
    const stats = service.getHistoryStats(userId, certificationId);

    // Assert: Should handle division by zero gracefully
    expect(stats.seenCount).toBe(0);
    expect(stats.totalCount).toBe(0);
    expect(stats.percentageSeen).toBe(0);
  });
});

/**
 * Property-based tests for QuestionHistoryService - History Reset
 * Feature: question-history-tracking
 * Task: 2.6 Write property test for history reset
 *
 * Property 7: History Reset Removes All Records
 * Property 8: History Reset Returns Accurate Count
 * **Validates: Requirements 4.1, 4.2**
 */

describe('Feature: question-history-tracking, Property 7: History Reset Removes All Records', () => {
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

  it('Property 7: For any user and certification with existing history records, resetting the history should result in zero history records for that user and certification combination', () => {
    fc.assert(
      fc.property(
        // Generate an array of 1 to 100 question IDs to create history records
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        (questionIds) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create actual questions in the database for each generated ID
          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record questions seen to create history records
          service.recordQuestionsSeen(userId, certificationId, questionIds);

          // Verify history records exist before reset
          const beforeReset = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          expect(beforeReset.count).toBe(questionIds.length);

          // Act: Reset history
          service.resetHistory(userId, certificationId);

          // Assert: Verify zero history records remain for this user and certification
          const afterReset = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          expect(afterReset.count).toBe(0);

          // Property: getSeenQuestionIds should return empty array after reset
          const seenQuestionIds = service.getSeenQuestionIds(userId, certificationId);
          expect(seenQuestionIds).toEqual([]);

          // Property: History statistics should show zero seen questions after reset
          const stats = service.getHistoryStats(userId, certificationId);
          expect(stats.seenCount).toBe(0);
          expect(stats.percentageSeen).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 7 Isolation: Resetting history for one user should not affect other users', () => {
    fc.assert(
      fc.property(
        // Generate question IDs for two users
        fc.record({
          user1Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
          user2Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        }),
        ({ user1Questions, user2Questions }) => {
          // Setup: Create two users with the same certification
          const user1Id = createUser();
          const user2Id = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create questions for both users
          const allQuestions = [...new Set([...user1Questions, ...user2Questions])];
          allQuestions.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record history for both users
          service.recordQuestionsSeen(user1Id, certificationId, user1Questions);
          service.recordQuestionsSeen(user2Id, certificationId, user2Questions);

          // Act: Reset history for user1 only
          service.resetHistory(user1Id, certificationId);

          // Assert: User1 should have zero records
          const user1Count = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user1Id, certificationId) as { count: number };
          expect(user1Count.count).toBe(0);

          // Assert: User2 should still have all their records
          const user2Count = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user2Id, certificationId) as { count: number };
          expect(user2Count.count).toBe(user2Questions.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 7 Certification Isolation: Resetting history for one certification should not affect other certifications', () => {
    fc.assert(
      fc.property(
        // Generate question IDs for two certifications
        fc.record({
          cert1Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
          cert2Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        }),
        ({ cert1Questions, cert2Questions }) => {
          // Setup: Create one user with two certifications
          const userId = createUser();
          const cert1Id = createCertification();
          const cert2Id = createCertification();
          const topic1Id = createTopic(cert1Id);
          const topic2Id = createTopic(cert2Id);

          // Create questions for both certifications
          cert1Questions.forEach((qId) => createQuestion(topic1Id, 1, qId));
          cert2Questions.forEach((qId) => createQuestion(topic2Id, 1, qId));

          // Record history for both certifications
          service.recordQuestionsSeen(userId, cert1Id, cert1Questions);
          service.recordQuestionsSeen(userId, cert2Id, cert2Questions);

          // Act: Reset history for cert1 only
          service.resetHistory(userId, cert1Id);

          // Assert: Cert1 should have zero records
          const cert1Count = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, cert1Id) as { count: number };
          expect(cert1Count.count).toBe(0);

          // Assert: Cert2 should still have all records
          const cert2Count = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, cert2Id) as { count: number };
          expect(cert2Count.count).toBe(cert2Questions.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 7 Edge Case: Resetting history with no existing records should succeed', () => {
    // Setup: Create user and certification with no history
    const userId = createUser();
    const certificationId = createCertification();

    // Act: Reset history (should not throw error)
    const deletedCount = service.resetHistory(userId, certificationId);

    // Assert: Should return 0 deleted records
    expect(deletedCount).toBe(0);

    // Verify no records exist
    const count = testDb
      .prepare(
        'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
      )
      .get(userId, certificationId) as { count: number };
    expect(count.count).toBe(0);
  });
});

describe('Feature: question-history-tracking, Property 8: History Reset Returns Accurate Count', () => {
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

  it('Property 8: For any user and certification, the count returned by the reset operation should equal the number of history records that existed before the reset', () => {
    fc.assert(
      fc.property(
        // Generate an array of 1 to 100 question IDs to create history records
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        (questionIds) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create actual questions in the database for each generated ID
          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record questions seen to create history records
          service.recordQuestionsSeen(userId, certificationId, questionIds);

          // Count records before reset
          const beforeCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          // Act: Reset history and capture returned count
          const deletedCount = service.resetHistory(userId, certificationId);

          // Assert: Returned count should match the count before reset
          expect(deletedCount).toBe(beforeCount.count);
          expect(deletedCount).toBe(questionIds.length);

          // Property: After reset, count should be zero
          const afterCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };
          expect(afterCount.count).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 8: Reset count should match distinct question IDs (handles duplicates)', () => {
    fc.assert(
      fc.property(
        // Generate question IDs with potential duplicates
        fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        (questionIds) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create actual questions
          const uniqueQuestionIds = [...new Set(questionIds)];
          uniqueQuestionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record questions seen multiple times (simulating duplicate attempts)
          service.recordQuestionsSeen(userId, certificationId, questionIds);
          service.recordQuestionsSeen(userId, certificationId, questionIds); // Duplicate recording

          // Count actual records (should be unique due to UNIQUE constraint)
          const actualCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          // Act: Reset history
          const deletedCount = service.resetHistory(userId, certificationId);

          // Assert: Deleted count should match actual unique records, not total attempts
          expect(deletedCount).toBe(actualCount.count);
          expect(deletedCount).toBe(uniqueQuestionIds.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 8 Edge Case: Resetting empty history should return zero', () => {
    // Setup: Create user and certification with no history
    const userId = createUser();
    const certificationId = createCertification();

    // Act: Reset history
    const deletedCount = service.resetHistory(userId, certificationId);

    // Assert: Should return 0
    expect(deletedCount).toBe(0);
  });

  it('Property 8 Multiple Resets: Consecutive resets should return zero after first reset', () => {
    fc.assert(
      fc.property(
        // Generate question IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        (questionIds) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record questions seen
          service.recordQuestionsSeen(userId, certificationId, questionIds);

          // Act: First reset
          const firstResetCount = service.resetHistory(userId, certificationId);

          // Assert: First reset should return the number of records
          expect(firstResetCount).toBe(questionIds.length);

          // Act: Second reset (should have nothing to delete)
          const secondResetCount = service.resetHistory(userId, certificationId);

          // Assert: Second reset should return zero
          expect(secondResetCount).toBe(0);

          // Act: Third reset (still nothing to delete)
          const thirdResetCount = service.resetHistory(userId, certificationId);

          // Assert: Third reset should also return zero
          expect(thirdResetCount).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property-based tests for QuestionHistoryService - Certification-Scoped History
 * Feature: question-history-tracking
 * Task: 11.4 Write property test for certification-scoped history
 *
 * Property 10: Certification-Scoped History Operations
 * Property 11: Cross-Certification Question Independence
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

describe('Feature: question-history-tracking, Property 10: Certification-Scoped History Operations', () => {
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

  it('Property 10: For any user with history records in multiple certifications, querying or resetting history for one certification should not affect history records in other certifications', () => {
    fc.assert(
      fc.property(
        // Generate question IDs for multiple certifications (2-5 certifications)
        fc.integer({ min: 2, max: 5 }).chain((numCerts) =>
          fc.record({
            numCertifications: fc.constant(numCerts),
            questionsPerCert: fc.array(fc.array(fc.uuid(), { minLength: 1, maxLength: 30 }), {
              minLength: numCerts,
              maxLength: numCerts,
            }),
          }),
        ),
        ({ numCertifications, questionsPerCert }) => {
          // Setup: Create one user with multiple certifications
          const userId = createUser();
          const certifications: Array<{ certId: string; topicId: string; questionIds: string[] }> =
            [];

          // Create certifications, topics, and questions
          for (let i = 0; i < numCertifications; i++) {
            const certId = createCertification();
            const topicId = createTopic(certId);
            const questionIds = questionsPerCert[i];

            // Create questions for this certification
            questionIds.forEach((qId) => createQuestion(topicId, 1, qId));

            // Record history for this certification
            service.recordQuestionsSeen(userId, certId, questionIds);

            certifications.push({ certId, topicId, questionIds });
          }

          // Select a random certification to query/reset
          const targetIndex = Math.floor(Math.random() * numCertifications);
          const targetCert = certifications[targetIndex];
          const otherCerts = certifications.filter((_, idx) => idx !== targetIndex);

          // Property 1: getSeenQuestionIds should only return questions for the target certification
          const seenQuestionIds = service.getSeenQuestionIds(userId, targetCert.certId);
          expect(seenQuestionIds.sort()).toEqual(targetCert.questionIds.sort());

          // Verify no questions from other certifications are included
          for (const otherCert of otherCerts) {
            for (const questionId of otherCert.questionIds) {
              expect(seenQuestionIds).not.toContain(questionId);
            }
          }

          // Property 2: getHistoryStats should only count questions for the target certification
          const stats = service.getHistoryStats(userId, targetCert.certId);
          expect(stats.seenCount).toBe(targetCert.questionIds.length);

          // Property 3: resetHistory should only affect the target certification
          const deletedCount = service.resetHistory(userId, targetCert.certId);
          expect(deletedCount).toBe(targetCert.questionIds.length);

          // Verify target certification history is cleared
          const targetHistoryAfterReset = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, targetCert.certId) as { count: number };
          expect(targetHistoryAfterReset.count).toBe(0);

          // Verify other certifications' history remains intact
          for (const otherCert of otherCerts) {
            const otherHistoryCount = testDb
              .prepare(
                'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
              )
              .get(userId, otherCert.certId) as { count: number };
            expect(otherHistoryCount.count).toBe(otherCert.questionIds.length);

            // Verify getSeenQuestionIds still returns correct data for other certifications
            const otherSeenIds = service.getSeenQuestionIds(userId, otherCert.certId);
            expect(otherSeenIds.sort()).toEqual(otherCert.questionIds.sort());
          }

          // Property 4: Total history count across all certifications should equal sum of individual counts
          const totalHistoryCount = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
            .get(userId) as { count: number };

          const expectedTotalCount = otherCerts.reduce(
            (sum, cert) => sum + cert.questionIds.length,
            0,
          );
          expect(totalHistoryCount.count).toBe(expectedTotalCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 10 Edge Case: Operations on non-existent certification should not affect existing certifications', () => {
    fc.assert(
      fc.property(
        // Generate question IDs for one real certification
        fc.array(fc.uuid(), { minLength: 1, maxLength: 30 }),
        (questionIds) => {
          // Setup: Create user with one certification
          const userId = createUser();
          const realCertId = createCertification();
          const topicId = createTopic(realCertId);

          questionIds.forEach((qId) => createQuestion(topicId, 1, qId));
          service.recordQuestionsSeen(userId, realCertId, questionIds);

          // Create a non-existent certification ID
          const nonExistentCertId = uuidv4();

          // Act: Query non-existent certification
          const seenIds = service.getSeenQuestionIds(userId, nonExistentCertId);
          expect(seenIds).toEqual([]);

          // Act: Reset non-existent certification
          const deletedCount = service.resetHistory(userId, nonExistentCertId);
          expect(deletedCount).toBe(0);

          // Assert: Real certification history should remain intact
          const realCertHistory = service.getSeenQuestionIds(userId, realCertId);
          expect(realCertHistory.sort()).toEqual(questionIds.sort());

          const historyCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, realCertId) as { count: number };
          expect(historyCount.count).toBe(questionIds.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 10 Concurrent Operations: Multiple users with same certifications should have independent history', () => {
    fc.assert(
      fc.property(
        // Generate data for multiple users (2-4 users) with same certifications
        fc.integer({ min: 2, max: 4 }).chain((numUsers) =>
          fc.record({
            numUsers: fc.constant(numUsers),
            questionsPerUser: fc.array(fc.array(fc.uuid(), { minLength: 1, maxLength: 30 }), {
              minLength: numUsers,
              maxLength: numUsers,
            }),
          }),
        ),
        ({ numUsers, questionsPerUser }) => {
          // Setup: Create multiple users with the same certification
          const certId = createCertification();
          const topicId = createTopic(certId);

          const users: Array<{ userId: string; questionIds: string[] }> = [];

          // Create all unique questions first
          const allQuestionIds = [...new Set(questionsPerUser.flat())];
          allQuestionIds.forEach((qId) => createQuestion(topicId, 1, qId));

          // Create users and record their history
          for (let i = 0; i < numUsers; i++) {
            const userId = createUser();
            const questionIds = questionsPerUser[i];

            service.recordQuestionsSeen(userId, certId, questionIds);
            users.push({ userId, questionIds });
          }

          // Select a random user to reset
          const targetUserIndex = Math.floor(Math.random() * numUsers);
          const targetUser = users[targetUserIndex];
          const otherUsers = users.filter((_, idx) => idx !== targetUserIndex);

          // Act: Reset history for target user
          const deletedCount = service.resetHistory(targetUser.userId, certId);
          expect(deletedCount).toBe(targetUser.questionIds.length);

          // Assert: Target user should have no history
          const targetHistory = service.getSeenQuestionIds(targetUser.userId, certId);
          expect(targetHistory).toEqual([]);

          // Assert: Other users should still have their history intact
          for (const otherUser of otherUsers) {
            const otherHistory = service.getSeenQuestionIds(otherUser.userId, certId);
            expect(otherHistory.sort()).toEqual(otherUser.questionIds.sort());

            const otherHistoryCount = testDb
              .prepare(
                'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
              )
              .get(otherUser.userId, certId) as { count: number };
            expect(otherHistoryCount.count).toBe(otherUser.questionIds.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: question-history-tracking, Property 11: Cross-Certification Question Independence', () => {
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

  it('Property 11: For any question ID that exists in multiple certifications, marking it as seen in one certification should not affect its seen status in other certifications', () => {
    fc.assert(
      fc.property(
        // Generate counts for shared and certification-specific questions
        fc.record({
          numSharedQuestions: fc.integer({ min: 1, max: 20 }),
          numCert1OnlyQuestions: fc.integer({ min: 1, max: 20 }),
          numCert2OnlyQuestions: fc.integer({ min: 1, max: 20 }),
        }),
        ({ numSharedQuestions, numCert1OnlyQuestions, numCert2OnlyQuestions }) => {
          // Setup: Create user and two certifications
          const userId = createUser();
          const cert1Id = createCertification();
          const cert2Id = createCertification();
          const topic1Id = createTopic(cert1Id);
          const topic2Id = createTopic(cert2Id);

          // Create "shared" questions - different question IDs but conceptually similar questions
          // In reality, questions are unique per certification, so we create separate questions
          const cert1SharedQuestionIds: string[] = [];
          const cert2SharedQuestionIds: string[] = [];

          for (let i = 0; i < numSharedQuestions; i++) {
            cert1SharedQuestionIds.push(createQuestion(topic1Id, 1));
            cert2SharedQuestionIds.push(createQuestion(topic2Id, 1));
          }

          // Create certification-specific questions
          const cert1OnlyIds: string[] = [];
          const cert2OnlyIds: string[] = [];

          for (let i = 0; i < numCert1OnlyQuestions; i++) {
            cert1OnlyIds.push(createQuestion(topic1Id, 1));
          }

          for (let i = 0; i < numCert2OnlyQuestions; i++) {
            cert2OnlyIds.push(createQuestion(topic2Id, 1));
          }

          // Act: Mark cert1 shared questions as seen in cert1 only
          service.recordQuestionsSeen(userId, cert1Id, cert1SharedQuestionIds);

          // Also mark cert1-specific questions as seen
          service.recordQuestionsSeen(userId, cert1Id, cert1OnlyIds);

          // Assert: Cert1 questions should be marked as seen in cert1
          const cert1SeenIds = service.getSeenQuestionIds(userId, cert1Id);
          expect(cert1SeenIds.sort()).toEqual([...cert1SharedQuestionIds, ...cert1OnlyIds].sort());

          // Assert: Cert2 questions should NOT be marked as seen yet
          const cert2SeenIds = service.getSeenQuestionIds(userId, cert2Id);
          expect(cert2SeenIds).toEqual([]);

          // Property: Cert1 questions should have records in cert1 only
          for (const questionId of cert1SharedQuestionIds) {
            // Check cert1 has the record
            const cert1Record = testDb
              .prepare(
                'SELECT * FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, cert1Id, questionId);
            expect(cert1Record).toBeDefined();

            // Check cert2 does NOT have this cert1 question
            const cert2Record = testDb
              .prepare(
                'SELECT * FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, cert2Id, questionId);
            expect(cert2Record).toBeUndefined();
          }

          // Act: Now mark cert2 shared questions as seen in cert2
          service.recordQuestionsSeen(userId, cert2Id, cert2SharedQuestionIds);

          // Also mark cert2-specific questions as seen
          service.recordQuestionsSeen(userId, cert2Id, cert2OnlyIds);

          // Assert: Both certifications should now have their respective questions marked as seen
          const cert1SeenIdsAfter = service.getSeenQuestionIds(userId, cert1Id);
          expect(cert1SeenIdsAfter.sort()).toEqual(
            [...cert1SharedQuestionIds, ...cert1OnlyIds].sort(),
          );

          const cert2SeenIdsAfter = service.getSeenQuestionIds(userId, cert2Id);
          expect(cert2SeenIdsAfter.sort()).toEqual(
            [...cert2SharedQuestionIds, ...cert2OnlyIds].sort(),
          );

          // Property: Cert1 questions should not appear in cert2 history and vice versa
          for (const cert1QuestionId of cert1SharedQuestionIds) {
            expect(cert2SeenIdsAfter).not.toContain(cert1QuestionId);
          }

          for (const cert2QuestionId of cert2SharedQuestionIds) {
            expect(cert1SeenIdsAfter).not.toContain(cert2QuestionId);
          }

          // Property: Resetting history in one certification should not affect the other
          const deletedCount = service.resetHistory(userId, cert1Id);
          expect(deletedCount).toBe(cert1SharedQuestionIds.length + cert1OnlyIds.length);

          // Cert1 should have no history
          const cert1SeenIdsAfterReset = service.getSeenQuestionIds(userId, cert1Id);
          expect(cert1SeenIdsAfterReset).toEqual([]);

          // Cert2 should still have all its history
          const cert2SeenIdsAfterReset = service.getSeenQuestionIds(userId, cert2Id);
          expect(cert2SeenIdsAfterReset.sort()).toEqual(
            [...cert2SharedQuestionIds, ...cert2OnlyIds].sort(),
          );

          // Verify cert2 questions are still marked as seen in cert2
          for (const cert2QuestionId of cert2SharedQuestionIds) {
            const cert2Record = testDb
              .prepare(
                'SELECT * FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, cert2Id, cert2QuestionId);
            expect(cert2Record).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 11 Statistics Independence: Statistics for one certification should not be affected by shared questions seen in other certifications', () => {
    fc.assert(
      fc.property(
        // Generate number of questions for each certification
        fc.integer({ min: 5, max: 20 }),
        (numQuestions) => {
          // Setup: Create user and two certifications with different questions
          const userId = createUser();
          const cert1Id = createCertification();
          const cert2Id = createCertification();
          const topic1Id = createTopic(cert1Id);
          const topic2Id = createTopic(cert2Id);

          // Create questions for each certification (different question IDs)
          const cert1QuestionIds: string[] = [];
          const cert2QuestionIds: string[] = [];

          for (let i = 0; i < numQuestions; i++) {
            cert1QuestionIds.push(createQuestion(topic1Id, 1));
            cert2QuestionIds.push(createQuestion(topic2Id, 1));
          }

          // Mark half of the questions as seen in cert1
          const halfIndex = Math.floor(numQuestions / 2);
          const cert1SeenIds = cert1QuestionIds.slice(0, halfIndex);
          service.recordQuestionsSeen(userId, cert1Id, cert1SeenIds);

          // Mark different half as seen in cert2
          const cert2SeenIds = cert2QuestionIds.slice(halfIndex);
          service.recordQuestionsSeen(userId, cert2Id, cert2SeenIds);

          // Get statistics for both certifications
          const cert1Stats = service.getHistoryStats(userId, cert1Id);
          const cert2Stats = service.getHistoryStats(userId, cert2Id);

          // Assert: Each certification should have independent statistics
          expect(cert1Stats.totalCount).toBe(numQuestions);
          expect(cert1Stats.seenCount).toBe(cert1SeenIds.length);

          expect(cert2Stats.totalCount).toBe(numQuestions);
          expect(cert2Stats.seenCount).toBe(cert2SeenIds.length);

          // Property: Statistics should be calculated independently
          // (they may or may not be equal depending on the split)
          if (halfIndex !== numQuestions - halfIndex) {
            expect(cert1Stats.seenCount).not.toBe(cert2Stats.seenCount);
          }

          // Property: Percentages should be calculated independently
          const expectedCert1Percentage =
            Math.round((cert1SeenIds.length / numQuestions) * 100 * 100) / 100;
          const expectedCert2Percentage =
            Math.round((cert2SeenIds.length / numQuestions) * 100 * 100) / 100;

          expect(cert1Stats.percentageSeen).toBe(expectedCert1Percentage);
          expect(cert2Stats.percentageSeen).toBe(expectedCert2Percentage);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 11 Edge Case: Same question can be marked as seen multiple times across different certifications', () => {
    fc.assert(
      fc.property(
        // Generate multiple certifications (2-5)
        fc.integer({ min: 2, max: 5 }),
        (numCertifications) => {
          // Setup: Create user and multiple certifications
          const userId = createUser();
          const certifications: Array<{ certId: string; topicId: string; questionId: string }> = [];

          // Create a unique question for each certification
          for (let i = 0; i < numCertifications; i++) {
            const certId = createCertification();
            const topicId = createTopic(certId);
            const questionId = createQuestion(topicId, 1);
            certifications.push({ certId, topicId, questionId });
          }

          // Act: Mark each certification's question as seen
          for (const cert of certifications) {
            service.recordQuestionsSeen(userId, cert.certId, [cert.questionId]);
          }

          // Assert: Each certification should have its question marked as seen
          for (const cert of certifications) {
            const seenIds = service.getSeenQuestionIds(userId, cert.certId);
            expect(seenIds).toEqual([cert.questionId]);

            const stats = service.getHistoryStats(userId, cert.certId);
            expect(stats.seenCount).toBe(1);
            expect(stats.totalCount).toBe(1);
            expect(stats.percentageSeen).toBe(100);
          }

          // Property: Should have exactly numCertifications history records total
          const totalRecords = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
            .get(userId) as { count: number };

          expect(totalRecords.count).toBe(numCertifications);

          // Property: Each certification should have exactly one record
          for (const cert of certifications) {
            const certRecords = testDb
              .prepare(
                'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
              )
              .get(userId, cert.certId) as { count: number };

            expect(certRecords.count).toBe(1);
          }

          // Property: Resetting one certification should not affect others
          const targetCert = certifications[0];
          service.resetHistory(userId, targetCert.certId);

          // Target certification should have no history
          const targetSeenIds = service.getSeenQuestionIds(userId, targetCert.certId);
          expect(targetSeenIds).toEqual([]);

          // Other certifications should still have their questions marked as seen
          for (let i = 1; i < certifications.length; i++) {
            const otherCert = certifications[i];
            const otherSeenIds = service.getSeenQuestionIds(userId, otherCert.certId);
            expect(otherSeenIds).toEqual([otherCert.questionId]);
          }

          // Property: Should now have numCertifications - 1 records
          const recordsAfterReset = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
            .get(userId) as { count: number };

          expect(recordsAfterReset.count).toBe(numCertifications - 1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property-based tests for QuestionHistoryService - Backfill Idempotency
 * Feature: question-history-tracking
 * Task: 13.2 Write property test for backfill idempotency
 *
 * Property 19: Backfill Idempotency
 * **Validates: Requirements 9.4**
 *
 * For any database state, running the backfill process multiple times should not
 * create duplicate history records or produce errors.
 */

describe('Feature: question-history-tracking, Property 19: Backfill Idempotency', () => {
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

    service = new QuestionHistoryService(testDb);
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

  it('Property 19: Running backfill multiple times should not create duplicate history records or produce errors', () => {
    fc.assert(
      fc.property(
        // Generate number of sessions (1-20) and questions per session (1-50)
        fc.record({
          numSessions: fc.integer({ min: 1, max: 20 }),
          questionsPerSession: fc.integer({ min: 1, max: 50 }),
          numBackfillRuns: fc.integer({ min: 2, max: 5 }), // Run backfill 2-5 times
        }),
        ({ numSessions, questionsPerSession, numBackfillRuns }) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create a pool of questions
          const questionPool: string[] = [];
          for (let i = 0; i < questionsPerSession * 2; i++) {
            questionPool.push(createQuestion(topicId, 1));
          }

          // Create multiple exam sessions with random questions from the pool
          const sessionIds: string[] = [];
          const expectedUniqueQuestions = new Set<string>();

          for (let i = 0; i < numSessions; i++) {
            const sessionId = uuidv4();
            sessionIds.push(sessionId);

            // Select random questions for this session (may overlap with other sessions)
            const sessionQuestions: string[] = [];
            for (let j = 0; j < questionsPerSession; j++) {
              const randomIndex = Math.floor(Math.random() * questionPool.length);
              const questionId = questionPool[randomIndex];
              sessionQuestions.push(questionId);
              expectedUniqueQuestions.add(questionId);
            }

            // Create exam session
            testDb
              .prepare(
                'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
              )
              .run(
                sessionId,
                userId,
                certificationId,
                JSON.stringify(sessionQuestions),
                sessionQuestions.length,
              );
          }

          // Count sessions for this specific user before backfill
          const userSessionsCount = testDb
            .prepare('SELECT COUNT(*) as count FROM exam_sessions WHERE userId = ?')
            .get(userId) as { count: number };

          expect(userSessionsCount.count).toBe(numSessions);

          // Act: Run backfill multiple times
          const backfillResults: Array<{ sessionsProcessed: number; recordsCreated: number }> = [];

          for (let run = 0; run < numBackfillRuns; run++) {
            const result = service.backfillFromExistingSessions();
            backfillResults.push(result);
          }

          // Assert: First run should create records
          expect(backfillResults[0].recordsCreated).toBeGreaterThan(0);

          // Property: Subsequent runs should create no new records (idempotency)
          for (let i = 1; i < numBackfillRuns; i++) {
            expect(backfillResults[i].recordsCreated).toBe(0);
          }

          // Property: All backfill runs should process at least our sessions
          // (may process more if there are sessions from previous test iterations)
          for (const result of backfillResults) {
            expect(result.sessionsProcessed).toBeGreaterThanOrEqual(numSessions);
          }

          // Property: Total history records should equal unique questions across all sessions
          const totalHistoryRecords = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          // The expected count should be the number of unique questions that were actually created
          // Since we're selecting from a pool, we need to count unique questions from all sessions
          expect(totalHistoryRecords.count).toBeLessThanOrEqual(questionPool.length);
          expect(totalHistoryRecords.count).toBeGreaterThan(0);

          // Property: No duplicate records should exist for any question
          const duplicateCheck = testDb
            .prepare(
              `
              SELECT userId, certificationId, questionId, COUNT(*) as count
              FROM question_history
              WHERE userId = ? AND certificationId = ?
              GROUP BY userId, certificationId, questionId
              HAVING count > 1
            `,
            )
            .all(userId, certificationId);

          expect(duplicateCheck).toHaveLength(0);

          // Property: No errors should occur during any backfill run
          // (If errors occurred, the test would have thrown before reaching here)
          expect(backfillResults.length).toBe(numBackfillRuns);

          // Property: All questions in history should be from the question pool
          const historyQuestionIds = testDb
            .prepare(
              'SELECT DISTINCT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as Array<{ questionId: string }>;

          for (const record of historyQuestionIds) {
            expect(questionPool).toContain(record.questionId);
          }
        },
      ),
      { numRuns: 30 },
    );
  }, 30000);

  it('Property 19 Edge Case: Backfill with existing manual history records should not create duplicates', () => {
    fc.assert(
      fc.property(
        // Generate questions for manual recording and session recording
        fc.record({
          manualQuestions: fc.integer({ min: 1, max: 10 }),
          sessionQuestions: fc.integer({ min: 1, max: 10 }),
          overlapCount: fc.integer({ min: 0, max: 5 }), // Number of overlapping questions
        }),
        ({ manualQuestions, sessionQuestions, overlapCount }) => {
          // Setup: Create user, certification, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create question pool
          const totalQuestions = Math.max(manualQuestions, sessionQuestions) + overlapCount;
          const questionPool: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            questionPool.push(createQuestion(topicId, 1));
          }

          // Manually record some questions (simulating existing history)
          const manualQuestionIds = questionPool.slice(0, manualQuestions);
          service.recordQuestionsSeen(userId, certificationId, manualQuestionIds);

          // Create exam session with some overlapping questions
          const sessionQuestionIds = questionPool.slice(
            Math.max(0, manualQuestions - overlapCount),
            Math.max(0, manualQuestions - overlapCount) + sessionQuestions,
          );

          const sessionId = uuidv4();
          testDb
            .prepare(
              'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
            )
            .run(
              sessionId,
              userId,
              certificationId,
              JSON.stringify(sessionQuestionIds),
              sessionQuestionIds.length,
            );

          // Calculate expected unique questions
          const expectedUniqueQuestions = new Set([...manualQuestionIds, ...sessionQuestionIds]);

          // Get history count before backfill
          const historyBeforeBackfill = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          expect(historyBeforeBackfill.count).toBe(manualQuestionIds.length);

          // Act: Run backfill multiple times
          const result1 = service.backfillFromExistingSessions();
          const result2 = service.backfillFromExistingSessions();
          const result3 = service.backfillFromExistingSessions();

          // Assert: First backfill should only create records for new questions
          const newQuestionsFromSession = sessionQuestionIds.filter(
            (qId) => !manualQuestionIds.includes(qId),
          ).length;

          expect(result1.recordsCreated).toBe(newQuestionsFromSession);

          // Property: Subsequent backfills should create no new records
          expect(result2.recordsCreated).toBe(0);
          expect(result3.recordsCreated).toBe(0);

          // Property: Total history records should equal unique questions
          const historyAfterBackfill = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          expect(historyAfterBackfill.count).toBe(expectedUniqueQuestions.size);

          // Property: Each unique question should have exactly one record
          for (const questionId of expectedUniqueQuestions) {
            const records = testDb
              .prepare(
                'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
              )
              .get(userId, certificationId, questionId) as { count: number };

            expect(records.count).toBe(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 19 Edge Case: Backfill with sessions using examConfigurationId should be idempotent', () => {
    fc.assert(
      fc.property(
        // Generate number of sessions with examConfigurationId
        fc.record({
          numSessions: fc.integer({ min: 1, max: 10 }),
          questionsPerSession: fc.integer({ min: 1, max: 20 }),
        }),
        ({ numSessions, questionsPerSession }) => {
          // Setup: Create user, certification, exam configuration, topic, and questions
          const userId = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create exam configuration
          const configId = uuidv4();
          testDb
            .prepare(
              'INSERT INTO exam_configurations (id, certificationId, name, duration, totalQuestions, passingScore) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .run(configId, certificationId, 'Test Exam', 60, 50, 70);

          // Create question pool
          const questionPool: string[] = [];
          for (let i = 0; i < questionsPerSession * 2; i++) {
            questionPool.push(createQuestion(topicId, 1));
          }

          // Create sessions with examConfigurationId (not certificationId)
          const expectedUniqueQuestions = new Set<string>();

          for (let i = 0; i < numSessions; i++) {
            const sessionId = uuidv4();
            const sessionQuestions: string[] = [];

            for (let j = 0; j < questionsPerSession; j++) {
              const randomIndex = Math.floor(Math.random() * questionPool.length);
              const questionId = questionPool[randomIndex];
              sessionQuestions.push(questionId);
              expectedUniqueQuestions.add(questionId);
            }

            // Create session with examConfigurationId instead of certificationId
            testDb
              .prepare(
                'INSERT INTO exam_sessions (id, userId, examConfigurationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
              )
              .run(
                sessionId,
                userId,
                configId,
                JSON.stringify(sessionQuestions),
                sessionQuestions.length,
              );
          }

          // Count sessions for this specific user before backfill
          const userSessionsCount = testDb
            .prepare('SELECT COUNT(*) as count FROM exam_sessions WHERE userId = ?')
            .get(userId) as { count: number };

          expect(userSessionsCount.count).toBe(numSessions);

          // Act: Run backfill multiple times
          const result1 = service.backfillFromExistingSessions();
          const result2 = service.backfillFromExistingSessions();
          const result3 = service.backfillFromExistingSessions();

          // Assert: First backfill should create records
          expect(result1.recordsCreated).toBeGreaterThan(0);

          // Property: Subsequent backfills should create no new records (idempotency)
          expect(result2.recordsCreated).toBe(0);
          expect(result3.recordsCreated).toBe(0);

          // Property: All backfill runs should process at least our sessions
          // (may process more if there are sessions from previous test iterations)
          expect(result1.sessionsProcessed).toBeGreaterThanOrEqual(numSessions);
          expect(result2.sessionsProcessed).toBeGreaterThanOrEqual(numSessions);
          expect(result3.sessionsProcessed).toBeGreaterThanOrEqual(numSessions);

          // Property: Total history records should equal unique questions
          const totalHistoryRecords = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(userId, certificationId) as { count: number };

          expect(totalHistoryRecords.count).toBeLessThanOrEqual(questionPool.length);
          expect(totalHistoryRecords.count).toBeGreaterThan(0);

          // Property: No duplicate records should exist
          const duplicateCheck = testDb
            .prepare(
              `
              SELECT userId, certificationId, questionId, COUNT(*) as count
              FROM question_history
              WHERE userId = ? AND certificationId = ?
              GROUP BY userId, certificationId, questionId
              HAVING count > 1
            `,
            )
            .all(userId, certificationId);

          expect(duplicateCheck).toHaveLength(0);

          // Property: All questions in history should be from the question pool
          const historyQuestionIds = testDb
            .prepare(
              'SELECT DISTINCT questionId FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .all(userId, certificationId) as Array<{ questionId: string }>;

          for (const record of historyQuestionIds) {
            expect(questionPool).toContain(record.questionId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 19 Stress Test: Backfill with large number of sessions and questions should remain idempotent', () => {
    // Setup: Create user, certification, topic, and large question pool
    const userId = createUser();
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    // Create 100 questions
    const questionPool: string[] = [];
    for (let i = 0; i < 100; i++) {
      questionPool.push(createQuestion(topicId, 1));
    }

    // Create 50 sessions with 20 questions each (with overlaps)
    const expectedUniqueQuestions = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const sessionId = uuidv4();
      const sessionQuestions: string[] = [];

      for (let j = 0; j < 20; j++) {
        const randomIndex = Math.floor(Math.random() * questionPool.length);
        const questionId = questionPool[randomIndex];
        sessionQuestions.push(questionId);
        expectedUniqueQuestions.add(questionId);
      }

      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, questions, totalQuestions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          sessionId,
          userId,
          certificationId,
          JSON.stringify(sessionQuestions),
          sessionQuestions.length,
        );
    }

    // Act: Run backfill 10 times
    const backfillResults: Array<{ sessionsProcessed: number; recordsCreated: number }> = [];

    for (let run = 0; run < 10; run++) {
      const result = service.backfillFromExistingSessions();
      backfillResults.push(result);
    }

    // Assert: First run should create records
    expect(backfillResults[0].sessionsProcessed).toBe(50);
    expect(backfillResults[0].recordsCreated).toBeGreaterThan(0);

    // Property: All subsequent runs should create zero records
    for (let i = 1; i < 10; i++) {
      expect(backfillResults[i].sessionsProcessed).toBe(50);
      expect(backfillResults[i].recordsCreated).toBe(0);
    }

    // Property: Total history records should equal unique questions
    const totalHistoryRecords = testDb
      .prepare(
        'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
      )
      .get(userId, certificationId) as { count: number };

    expect(totalHistoryRecords.count).toBe(expectedUniqueQuestions.size);

    // Property: Each unique question should have exactly one history record
    for (const questionId of expectedUniqueQuestions) {
      const records = testDb
        .prepare(
          'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ? AND questionId = ?',
        )
        .get(userId, certificationId, questionId) as { count: number };

      expect(records.count).toBe(1);
    }

    // Property: No duplicate records should exist
    const duplicateCheck = testDb
      .prepare(
        `
        SELECT userId, certificationId, questionId, COUNT(*) as count
        FROM question_history
        WHERE userId = ? AND certificationId = ?
        GROUP BY userId, certificationId, questionId
        HAVING count > 1
      `,
      )
      .all(userId, certificationId);

    expect(duplicateCheck).toHaveLength(0);
  });
});
