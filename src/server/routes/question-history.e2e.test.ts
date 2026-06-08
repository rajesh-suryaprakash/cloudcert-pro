import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import { QuestionRepository } from '../repositories/QuestionRepository';

/**
 * End-to-end tests for complete question history tracking flow
 *
 * Feature: question-history-tracking
 * Task: 17.1 Write end-to-end test for complete flow
 * Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 3.3, 4.1, 7.1, 9.1
 *
 * Tests cover:
 * - Create session → Record history → Query seen questions → Verify exclusion
 * - Create multiple sessions → Check statistics → Reset history → Verify cleared
 * - Backfill from existing sessions → Verify history populated correctly
 * - Start test with insufficient questions → Verify warning displayed
 * - Exhaust question pool → Verify error → Reset → Verify can start test
 */

describe('Feature: question-history-tracking - End-to-End Tests', () => {
  let testDb: Database.Database;
  let questionHistoryService: QuestionHistoryService;
  let questionRepo: QuestionRepository;

  beforeEach(() => {
    testDb = new Database(':memory:');

    // Create complete schema
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

      CREATE TABLE exam_configurations (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        name TEXT NOT NULL,
        totalQuestions INTEGER NOT NULL,
        passingScore INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT,
        examConfigurationId TEXT,
        questions TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        endTime DATETIME,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL,
        FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE SET NULL
      );
    `);

    questionHistoryService = new QuestionHistoryService(testDb);
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

  function createExamSession(
    userId: string,
    certificationId: string,
    questionIds: string[],
    status: string = 'in_progress',
  ): string {
    const sessionId = uuidv4();
    testDb
      .prepare(
        'INSERT INTO exam_sessions (id, userId, certificationId, questions, status) VALUES (?, ?, ?, ?, ?)',
      )
      .run(sessionId, userId, certificationId, JSON.stringify(questionIds), status);
    return sessionId;
  }

  it('E2E Test 1: Create session → Record history → Query seen questions → Verify exclusion', () => {
    // Setup: Create user, certification, topic, and 20 questions
    const userId = createUser();
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    const allQuestionIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      allQuestionIds.push(createQuestion(topicId, 1));
    }

    // Step 1: Create first session with 10 questions
    const firstSessionQuestions = allQuestionIds.slice(0, 10);
    questionHistoryService.recordQuestionsSeen(userId, certificationId, firstSessionQuestions);

    // Step 2: Query seen questions
    const seenQuestionIds = questionHistoryService.getSeenQuestionIds(userId, certificationId);
    expect(seenQuestionIds.length).toBe(10);
    expect(seenQuestionIds.sort()).toEqual(firstSessionQuestions.sort());

    // Step 3: Verify exclusion - get unseen questions
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certificationId,
      seenQuestionIds,
    );

    // Assert: Should return only the 10 unseen questions
    expect(unseenQuestions.length).toBe(10);
    const unseenQuestionIds = unseenQuestions.map((q) => q.id);

    // Verify no seen questions are in unseen list
    for (const seenId of firstSessionQuestions) {
      expect(unseenQuestionIds).not.toContain(seenId);
    }

    // Verify all unseen questions are from the remaining set
    const expectedUnseenIds = allQuestionIds.slice(10);
    expect(unseenQuestionIds.sort()).toEqual(expectedUnseenIds.sort());
  });

  it('E2E Test 2: Create multiple sessions → Check statistics → Reset history → Verify cleared', () => {
    // Setup: Create user, certification, topic, and 30 questions
    const userId = createUser();
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    const allQuestionIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      allQuestionIds.push(createQuestion(topicId, 1));
    }

    // Step 1: Create first session with 10 questions
    const firstSessionQuestions = allQuestionIds.slice(0, 10);
    questionHistoryService.recordQuestionsSeen(userId, certificationId, firstSessionQuestions);

    // Step 2: Create second session with 10 more questions (some overlap)
    const secondSessionQuestions = allQuestionIds.slice(5, 15);
    questionHistoryService.recordQuestionsSeen(userId, certificationId, secondSessionQuestions);

    // Step 3: Create third session with 10 more questions
    const thirdSessionQuestions = allQuestionIds.slice(15, 25);
    questionHistoryService.recordQuestionsSeen(userId, certificationId, thirdSessionQuestions);

    // Step 4: Check statistics
    const statsBeforeReset = questionHistoryService.getHistoryStats(userId, certificationId);
    expect(statsBeforeReset.totalCount).toBe(30);
    expect(statsBeforeReset.seenCount).toBe(25); // 0-24 (25 unique questions)
    expect(statsBeforeReset.percentageSeen).toBeCloseTo(83.33, 1);

    // Step 5: Reset history
    const deletedCount = questionHistoryService.resetHistory(userId, certificationId);
    expect(deletedCount).toBe(25);

    // Step 6: Verify cleared
    const seenAfterReset = questionHistoryService.getSeenQuestionIds(userId, certificationId);
    expect(seenAfterReset.length).toBe(0);

    const statsAfterReset = questionHistoryService.getHistoryStats(userId, certificationId);
    expect(statsAfterReset.totalCount).toBe(30);
    expect(statsAfterReset.seenCount).toBe(0);
    expect(statsAfterReset.percentageSeen).toBe(0);

    // Verify all questions are now available again
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(certificationId, []);
    expect(unseenQuestions.length).toBe(30);
  });

  it('E2E Test 3: Backfill from existing sessions → Verify history populated correctly', () => {
    // Setup: Create user, certification, topic, and questions
    const userId = createUser();
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    const allQuestionIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      allQuestionIds.push(createQuestion(topicId, 1));
    }

    // Step 1: Create exam sessions WITHOUT recording history (simulating old data)
    const session1Questions = allQuestionIds.slice(0, 10);
    const session2Questions = allQuestionIds.slice(10, 20);
    const session3Questions = allQuestionIds.slice(15, 25); // Some overlap

    createExamSession(userId, certificationId, session1Questions, 'completed');
    createExamSession(userId, certificationId, session2Questions, 'completed');
    createExamSession(userId, certificationId, session3Questions, 'in_progress');

    // Verify no history exists yet
    const historyBeforeBackfill = questionHistoryService.getSeenQuestionIds(
      userId,
      certificationId,
    );
    expect(historyBeforeBackfill.length).toBe(0);

    // Step 2: Run backfill
    const backfillResult = questionHistoryService.backfillFromExistingSessions();
    expect(backfillResult.sessionsProcessed).toBe(3);
    expect(backfillResult.recordsCreated).toBe(25); // 0-24 (25 unique questions)

    // Step 3: Verify history populated correctly
    const historyAfterBackfill = questionHistoryService.getSeenQuestionIds(userId, certificationId);
    expect(historyAfterBackfill.length).toBe(25);

    // Verify all questions from sessions are in history
    const expectedQuestionIds = [
      ...new Set([...session1Questions, ...session2Questions, ...session3Questions]),
    ];
    expect(historyAfterBackfill.sort()).toEqual(expectedQuestionIds.sort());

    // Step 4: Verify statistics reflect backfilled data
    const stats = questionHistoryService.getHistoryStats(userId, certificationId);
    expect(stats.seenCount).toBe(25);
    expect(stats.totalCount).toBe(30);
    expect(stats.percentageSeen).toBeCloseTo(83.33, 1);

    // Step 5: Verify backfill is idempotent (running again doesn't create duplicates)
    const secondBackfillResult = questionHistoryService.backfillFromExistingSessions();
    expect(secondBackfillResult.sessionsProcessed).toBe(3);
    expect(secondBackfillResult.recordsCreated).toBe(0); // No new records created

    const historyAfterSecondBackfill = questionHistoryService.getSeenQuestionIds(
      userId,
      certificationId,
    );
    expect(historyAfterSecondBackfill.length).toBe(25); // Still 25
  });

  it('E2E Test 4: Start test with insufficient questions → Verify warning scenario', () => {
    // Setup: Create user, certification, topic, and only 5 questions
    const userId = createUser();
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    const allQuestionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      allQuestionIds.push(createQuestion(topicId, 1));
    }

    // Step 1: Mark 3 questions as seen
    const seenQuestions = allQuestionIds.slice(0, 3);
    questionHistoryService.recordQuestionsSeen(userId, certificationId, seenQuestions);

    // Step 2: Try to get 5 questions (but only 2 are unseen)
    const seenQuestionIds = questionHistoryService.getSeenQuestionIds(userId, certificationId);
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certificationId,
      seenQuestionIds,
    );

    // Assert: Should return only 2 unseen questions (warning scenario)
    expect(unseenQuestions.length).toBe(2);
    expect(unseenQuestions.length).toBeLessThan(5); // Insufficient for a 5-question test

    // Verify the unseen questions are correct
    const expectedUnseenIds = allQuestionIds.slice(3);
    const unseenQuestionIds = unseenQuestions.map((q) => q.id);
    expect(unseenQuestionIds.sort()).toEqual(expectedUnseenIds.sort());

    // Step 3: Check statistics to understand the situation
    const stats = questionHistoryService.getHistoryStats(userId, certificationId);
    expect(stats.totalCount).toBe(5);
    expect(stats.seenCount).toBe(3);
    expect(stats.percentageSeen).toBe(60);

    // This scenario would trigger a warning in the frontend:
    // "Only 2 unseen questions available. Proceed with 2 questions?"
  });

  it('E2E Test 5: Exhaust question pool → Verify error → Reset → Verify can start test', () => {
    // Setup: Create user, certification, topic, and 10 questions
    const userId = createUser();
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    const allQuestionIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      allQuestionIds.push(createQuestion(topicId, 1));
    }

    // Step 1: Mark all questions as seen (exhaust the pool)
    questionHistoryService.recordQuestionsSeen(userId, certificationId, allQuestionIds);

    // Step 2: Try to get unseen questions
    const seenQuestionIds = questionHistoryService.getSeenQuestionIds(userId, certificationId);
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certificationId,
      seenQuestionIds,
    );

    // Assert: No unseen questions available (error scenario)
    expect(unseenQuestions.length).toBe(0);

    // Step 3: Check statistics
    const statsBeforeReset = questionHistoryService.getHistoryStats(userId, certificationId);
    expect(statsBeforeReset.totalCount).toBe(10);
    expect(statsBeforeReset.seenCount).toBe(10);
    expect(statsBeforeReset.percentageSeen).toBe(100);

    // This scenario would trigger an error in the frontend:
    // "No unseen questions available for this certification. Consider resetting your question history."

    // Step 4: Reset history to allow starting a new test
    const deletedCount = questionHistoryService.resetHistory(userId, certificationId);
    expect(deletedCount).toBe(10);

    // Step 5: Verify can now start test
    const seenAfterReset = questionHistoryService.getSeenQuestionIds(userId, certificationId);
    const unseenAfterReset = questionRepo.findByCertificationExcludingSeen(
      certificationId,
      seenAfterReset,
    );

    // Assert: All questions are now available again
    expect(unseenAfterReset.length).toBe(10);
    expect(seenAfterReset.length).toBe(0);

    const statsAfterReset = questionHistoryService.getHistoryStats(userId, certificationId);
    expect(statsAfterReset.totalCount).toBe(10);
    expect(statsAfterReset.seenCount).toBe(0);
    expect(statsAfterReset.percentageSeen).toBe(0);
  });

  it('E2E Test 6: Complete flow with multiple users and certifications', () => {
    // Setup: Create two users and two certifications
    const user1Id = createUser();
    const user2Id = createUser();
    const cert1Id = createCertification();
    const cert2Id = createCertification();
    const topic1Id = createTopic(cert1Id);
    const topic2Id = createTopic(cert2Id);

    // Create 15 questions for each certification
    const cert1Questions: string[] = [];
    const cert2Questions: string[] = [];
    for (let i = 0; i < 15; i++) {
      cert1Questions.push(createQuestion(topic1Id, 1));
      cert2Questions.push(createQuestion(topic2Id, 1));
    }

    // User 1 sees 10 questions from cert1
    const user1Cert1Seen = cert1Questions.slice(0, 10);
    questionHistoryService.recordQuestionsSeen(user1Id, cert1Id, user1Cert1Seen);

    // User 1 sees 5 questions from cert2
    const user1Cert2Seen = cert2Questions.slice(0, 5);
    questionHistoryService.recordQuestionsSeen(user1Id, cert2Id, user1Cert2Seen);

    // User 2 sees 8 questions from cert1
    const user2Cert1Seen = cert1Questions.slice(5, 13);
    questionHistoryService.recordQuestionsSeen(user2Id, cert1Id, user2Cert1Seen);

    // Verify isolation: User 1's cert1 history
    const user1Cert1Stats = questionHistoryService.getHistoryStats(user1Id, cert1Id);
    expect(user1Cert1Stats.seenCount).toBe(10);
    expect(user1Cert1Stats.totalCount).toBe(15);

    // Verify isolation: User 1's cert2 history
    const user1Cert2Stats = questionHistoryService.getHistoryStats(user1Id, cert2Id);
    expect(user1Cert2Stats.seenCount).toBe(5);
    expect(user1Cert2Stats.totalCount).toBe(15);

    // Verify isolation: User 2's cert1 history
    const user2Cert1Stats = questionHistoryService.getHistoryStats(user2Id, cert1Id);
    expect(user2Cert1Stats.seenCount).toBe(8);
    expect(user2Cert1Stats.totalCount).toBe(15);

    // Reset user1's cert1 history
    questionHistoryService.resetHistory(user1Id, cert1Id);

    // Verify user1's cert1 history is cleared
    const user1Cert1AfterReset = questionHistoryService.getHistoryStats(user1Id, cert1Id);
    expect(user1Cert1AfterReset.seenCount).toBe(0);

    // Verify user1's cert2 history is NOT affected
    const user1Cert2AfterReset = questionHistoryService.getHistoryStats(user1Id, cert2Id);
    expect(user1Cert2AfterReset.seenCount).toBe(5);

    // Verify user2's cert1 history is NOT affected
    const user2Cert1AfterReset = questionHistoryService.getHistoryStats(user2Id, cert1Id);
    expect(user2Cert1AfterReset.seenCount).toBe(8);
  });
});
