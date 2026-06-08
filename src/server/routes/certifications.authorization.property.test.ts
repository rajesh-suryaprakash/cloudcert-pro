import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based tests for API Authorization
 * Feature: question-history-tracking
 * Task: 6.4 Write property test for API authorization
 *
 * Property 9: History Reset Authorization
 * **Validates: Requirements 4.3**
 *
 * For any user attempting to reset history, the operation should only affect
 * history records belonging to that user, not other users' records.
 */

describe('Feature: question-history-tracking, Property 9: History Reset Authorization', () => {
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

  it('Property 9: For any user attempting to reset history, the operation should only affect history records belonging to that user, not other users records', () => {
    fc.assert(
      fc.property(
        // Generate question IDs for multiple users
        fc.record({
          user1Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
          user2Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
          user3Questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        }),
        ({ user1Questions, user2Questions, user3Questions }) => {
          // Setup: Create three users with the same certification
          const user1Id = createUser();
          const user2Id = createUser();
          const user3Id = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create all unique questions
          const allQuestions = [
            ...new Set([...user1Questions, ...user2Questions, ...user3Questions]),
          ];
          allQuestions.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record history for all three users
          service.recordQuestionsSeen(user1Id, certificationId, user1Questions);
          service.recordQuestionsSeen(user2Id, certificationId, user2Questions);
          service.recordQuestionsSeen(user3Id, certificationId, user3Questions);

          // Verify all users have their history records before reset
          const user1CountBefore = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user1Id, certificationId) as { count: number };
          const user2CountBefore = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user2Id, certificationId) as { count: number };
          const user3CountBefore = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user3Id, certificationId) as { count: number };

          expect(user1CountBefore.count).toBe(user1Questions.length);
          expect(user2CountBefore.count).toBe(user2Questions.length);
          expect(user3CountBefore.count).toBe(user3Questions.length);

          // Act: User1 resets their history (simulating authenticated API call)
          const deletedCount = service.resetHistory(user1Id, certificationId);

          // Assert: Only user1's records should be deleted
          expect(deletedCount).toBe(user1Questions.length);

          // Property: User1 should have zero records after reset
          const user1CountAfter = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user1Id, certificationId) as { count: number };
          expect(user1CountAfter.count).toBe(0);

          // Property: User2's records should remain unchanged
          const user2CountAfter = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user2Id, certificationId) as { count: number };
          expect(user2CountAfter.count).toBe(user2Questions.length);

          // Property: User3's records should remain unchanged
          const user3CountAfter = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user3Id, certificationId) as { count: number };
          expect(user3CountAfter.count).toBe(user3Questions.length);

          // Property: Verify user2 and user3 can still retrieve their seen questions
          const user2SeenQuestions = service.getSeenQuestionIds(user2Id, certificationId);
          const user3SeenQuestions = service.getSeenQuestionIds(user3Id, certificationId);

          expect(user2SeenQuestions.length).toBe(user2Questions.length);
          expect(user3SeenQuestions.length).toBe(user3Questions.length);

          // Property: Verify the specific question IDs are preserved for other users
          for (const questionId of user2Questions) {
            expect(user2SeenQuestions).toContain(questionId);
          }
          for (const questionId of user3Questions) {
            expect(user3SeenQuestions).toContain(questionId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 9 Cross-User Isolation: Multiple users resetting history should not interfere with each other', () => {
    fc.assert(
      fc.property(
        // Generate question IDs for multiple users
        fc.array(
          fc.record({
            userId: fc.uuid(),
            questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 30 }),
          }),
          { minLength: 2, maxLength: 5 },
        ),
        (userDataArray) => {
          // Setup: Create certification and topic
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create all users and their questions
          const userData = userDataArray.map((data) => ({
            userId: createUser(data.userId),
            questions: data.questions,
          }));

          // Create all unique questions
          const allQuestions = [...new Set(userData.flatMap((u) => u.questions))];
          allQuestions.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record history for all users
          userData.forEach(({ userId, questions }) => {
            service.recordQuestionsSeen(userId, certificationId, questions);
          });

          // Store initial counts
          const initialCounts = userData.map(({ userId, questions }) => ({
            userId,
            expectedCount: questions.length,
            actualCount: (
              testDb
                .prepare(
                  'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
                )
                .get(userId, certificationId) as { count: number }
            ).count,
          }));

          // Verify initial state
          initialCounts.forEach(({ expectedCount, actualCount }) => {
            expect(actualCount).toBe(expectedCount);
          });

          // Act: Each user resets their own history in sequence
          userData.forEach(({ userId, questions }) => {
            const deletedCount = service.resetHistory(userId, certificationId);

            // Property: Deleted count should match the user's question count
            expect(deletedCount).toBe(questions.length);

            // Property: This user should have zero records
            const userCount = testDb
              .prepare(
                'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
              )
              .get(userId, certificationId) as { count: number };
            expect(userCount.count).toBe(0);
          });

          // Assert: All users should have zero records after their individual resets
          userData.forEach(({ userId }) => {
            const finalCount = testDb
              .prepare(
                'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
              )
              .get(userId, certificationId) as { count: number };
            expect(finalCount.count).toBe(0);
          });

          // Property: Total history records should be zero
          const totalRecords = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history WHERE certificationId = ?')
            .get(certificationId) as { count: number };
          expect(totalRecords.count).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 9 Authorization Boundary: User cannot affect another users history through any combination of operations', () => {
    fc.assert(
      fc.property(
        // Generate operations for two users
        fc.record({
          user1Questions: fc.array(fc.uuid(), { minLength: 5, maxLength: 20 }),
          user2Questions: fc.array(fc.uuid(), { minLength: 5, maxLength: 20 }),
          sharedQuestions: fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        }),
        ({ user1Questions, user2Questions, sharedQuestions }) => {
          // Setup: Create two users with the same certification
          const user1Id = createUser();
          const user2Id = createUser();
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          // Create questions: some unique to each user, some shared
          const allQuestions = [
            ...new Set([...user1Questions, ...user2Questions, ...sharedQuestions]),
          ];
          allQuestions.forEach((qId) => createQuestion(topicId, 1, qId));

          // Both users see their own questions plus shared questions
          const user1AllQuestions = [...user1Questions, ...sharedQuestions];
          const user2AllQuestions = [...user2Questions, ...sharedQuestions];

          service.recordQuestionsSeen(user1Id, certificationId, user1AllQuestions);
          service.recordQuestionsSeen(user2Id, certificationId, user2AllQuestions);

          // Store user2's initial state
          const user2InitialCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user2Id, certificationId) as { count: number };
          const user2InitialQuestions = service.getSeenQuestionIds(user2Id, certificationId);

          expect(user2InitialCount.count).toBe(user2AllQuestions.length);

          // Act: User1 performs various operations
          // 1. User1 resets their history
          service.resetHistory(user1Id, certificationId);

          // 2. User1 records new questions
          const newQuestions = [uuidv4(), uuidv4()];
          newQuestions.forEach((qId) => createQuestion(topicId, 1, qId));
          service.recordQuestionsSeen(user1Id, certificationId, newQuestions);

          // 3. User1 queries their seen questions
          service.getSeenQuestionIds(user1Id, certificationId);

          // Assert: User2's history should remain completely unchanged
          const user2FinalCount = testDb
            .prepare(
              'SELECT COUNT(*) as count FROM question_history WHERE userId = ? AND certificationId = ?',
            )
            .get(user2Id, certificationId) as { count: number };
          const user2FinalQuestions = service.getSeenQuestionIds(user2Id, certificationId);

          // Property: User2's record count should be unchanged
          expect(user2FinalCount.count).toBe(user2InitialCount.count);

          // Property: User2's question IDs should be unchanged
          expect(user2FinalQuestions.sort()).toEqual(user2InitialQuestions.sort());

          // Property: User2 should still have all their original questions
          for (const questionId of user2AllQuestions) {
            expect(user2FinalQuestions).toContain(questionId);
          }

          // Property: User2 should not have any of user1's new questions
          for (const questionId of newQuestions) {
            expect(user2FinalQuestions).not.toContain(questionId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 9 Edge Case: Resetting history for non-existent user should not affect any records', () => {
    // Setup: Create users with history
    const user1Id = createUser();
    const user2Id = createUser();
    const nonExistentUserId = uuidv4(); // User that doesn't exist in database
    const certificationId = createCertification();
    const topicId = createTopic(certificationId);

    const questions = [uuidv4(), uuidv4(), uuidv4()];
    questions.forEach((qId) => createQuestion(topicId, 1, qId));

    service.recordQuestionsSeen(user1Id, certificationId, questions);
    service.recordQuestionsSeen(user2Id, certificationId, questions);

    // Store initial state
    const totalRecordsBefore = testDb
      .prepare('SELECT COUNT(*) as count FROM question_history')
      .get() as { count: number };

    // Act: Attempt to reset history for non-existent user
    const deletedCount = service.resetHistory(nonExistentUserId, certificationId);

    // Assert: No records should be deleted
    expect(deletedCount).toBe(0);

    // Property: Total records should remain unchanged
    const totalRecordsAfter = testDb
      .prepare('SELECT COUNT(*) as count FROM question_history')
      .get() as { count: number };
    expect(totalRecordsAfter.count).toBe(totalRecordsBefore.count);

    // Property: Both existing users should still have their records
    const user1Count = testDb
      .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
      .get(user1Id) as { count: number };
    const user2Count = testDb
      .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
      .get(user2Id) as { count: number };

    expect(user1Count.count).toBe(questions.length);
    expect(user2Count.count).toBe(questions.length);
  });

  it('Property 9 Concurrent Operations: Simultaneous resets by different users should maintain isolation', () => {
    fc.assert(
      fc.property(
        // Generate data for multiple users
        fc.array(
          fc.record({
            questions: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
          }),
          { minLength: 3, maxLength: 6 },
        ),
        (usersData) => {
          // Setup: Create certification and users
          const certificationId = createCertification();
          const topicId = createTopic(certificationId);

          const users = usersData.map((data) => ({
            userId: createUser(),
            questions: data.questions,
          }));

          // Create all questions
          const allQuestions = [...new Set(users.flatMap((u) => u.questions))];
          allQuestions.forEach((qId) => createQuestion(topicId, 1, qId));

          // Record history for all users
          users.forEach(({ userId, questions }) => {
            service.recordQuestionsSeen(userId, certificationId, questions);
          });

          // Simulate concurrent resets (in sequence, but verify isolation)
          const resetResults = users.map(({ userId, questions }) => {
            const deletedCount = service.resetHistory(userId, certificationId);
            return { userId, expectedDeleted: questions.length, actualDeleted: deletedCount };
          });

          // Property: Each reset should delete exactly the user's own records
          resetResults.forEach(({ expectedDeleted, actualDeleted }) => {
            expect(actualDeleted).toBe(expectedDeleted);
          });

          // Property: All users should have zero records after their resets
          users.forEach(({ userId }) => {
            const count = testDb
              .prepare('SELECT COUNT(*) as count FROM question_history WHERE userId = ?')
              .get(userId) as { count: number };
            expect(count.count).toBe(0);
          });

          // Property: No orphaned records should exist
          const totalRecords = testDb
            .prepare('SELECT COUNT(*) as count FROM question_history')
            .get() as { count: number };
          expect(totalRecords.count).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
