import { describe, it, beforeEach, expect } from 'vitest';
import Database from 'better-sqlite3';
import * as fc from 'fast-check';
import { QuestionRepository } from './QuestionRepository';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1
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
      isActive INTEGER DEFAULT 1
    )
  `);
  return db;
}

function insertQuestion(db: ReturnType<typeof Database>, id: string, topicId: string) {
  db.prepare(
    `
    INSERT INTO questions (id, topicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
    VALUES (?, ?, 'Q?', 'single', '[]', '[]', 'Medium', '[]', 1, 1)
  `,
  ).run(id, topicId);
}

describe('QuestionRepository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
    new QuestionRepository(db); // instantiate to verify constructor works
  });

  // Feature: custom-quiz-builder, Property 2: Difficulty filter returns only matching questions
  // Validates: Requirements 2.1, 2.4
  it('Property 2: findByCertificationAndDifficulty returns only active questions matching the given difficulty', () => {
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    fc.assert(
      fc.property(
        fc.record({
          certificationId: fc.uuid(),
          questions: fc.array(
            fc.record({
              id: fc.uuid(),
              difficulty: fc.constantFrom(...difficulties),
              isActive: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          filterDifficulty: fc.constantFrom(...difficulties),
        }),
        ({ certificationId, questions, filterDifficulty }) => {
          const testDb = createTestDb();
          const repo = new QuestionRepository(testDb);
          const topicId = crypto.randomUUID();
          testDb
            .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
            .run(topicId, certificationId, 'Topic');

          for (const q of questions) {
            testDb
              .prepare(
                `INSERT INTO questions (id, topicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
                 VALUES (?, ?, 'Q?', 'single', '[]', '[]', ?, '[]', 1, ?)`,
              )
              .run(q.id, topicId, q.difficulty, q.isActive ? 1 : 0);
          }

          const results = repo.findByCertificationAndDifficulty(certificationId, filterDifficulty);
          testDb.close();

          return results.every((r) => r.difficulty === filterDifficulty && r.isActive === 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: custom-quiz-builder, Property 3: No-filter returns all active questions
  // Validates: Requirements 2.2
  it('Property 3: findByCertificationAndDifficulty with null returns union of all difficulty-filtered results', () => {
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    fc.assert(
      fc.property(
        fc.record({
          certificationId: fc.uuid(),
          questions: fc.array(
            fc.record({
              id: fc.uuid(),
              difficulty: fc.constantFrom(...difficulties),
              isActive: fc.boolean(),
            }),
            { minLength: 0, maxLength: 20 },
          ),
        }),
        ({ certificationId, questions }) => {
          const testDb = createTestDb();
          const repo = new QuestionRepository(testDb);
          const topicId = crypto.randomUUID();
          testDb
            .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
            .run(topicId, certificationId, 'Topic');

          for (const q of questions) {
            testDb
              .prepare(
                `INSERT INTO questions (id, topicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
                 VALUES (?, ?, 'Q?', 'single', '[]', '[]', ?, '[]', 1, ?)`,
              )
              .run(q.id, topicId, q.difficulty, q.isActive ? 1 : 0);
          }

          const allResults = repo.findByCertificationAndDifficulty(certificationId, null);
          const easyIds = new Set(
            repo.findByCertificationAndDifficulty(certificationId, 'Easy').map((r) => r.id),
          );
          const mediumIds = new Set(
            repo.findByCertificationAndDifficulty(certificationId, 'Medium').map((r) => r.id),
          );
          const hardIds = new Set(
            repo.findByCertificationAndDifficulty(certificationId, 'Hard').map((r) => r.id),
          );
          const unionIds = new Set([...easyIds, ...mediumIds, ...hardIds]);

          testDb.close();

          const allResultIds = new Set(allResults.map((r) => r.id));
          return (
            allResultIds.size === unionIds.size && [...allResultIds].every((id) => unionIds.has(id))
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: codebase-refactoring, Property 5: QuestionRepository findByIds returns exactly the requested IDs
  // Validates: Requirements 6.3
  it('Property 5: findByIds returns exactly the requested IDs — no more, no less', () => {
    fc.assert(
      fc.property(
        // Generate between 1 and 10 unique IDs to seed, then pick a random subset to query
        fc
          .integer({ min: 1, max: 10 })
          .chain((_total) =>
            fc.tuple(
              fc.uniqueArray(fc.uuid(), { minLength: _total, maxLength: _total }),
              fc.integer({ min: 1, max: _total }),
            ),
          ),
        ([allIds, subsetSize]) => {
          // Fresh db for each run
          const testDb = createTestDb();
          const testRepo = new QuestionRepository(testDb);
          const topicId = crypto.randomUUID();
          testDb
            .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
            .run(topicId, 'cert-1', 'Topic');

          for (const id of allIds) {
            insertQuestion(testDb, id, topicId);
          }

          const requestedIds = allIds.slice(0, subsetSize);
          const results = testRepo.findByIds(requestedIds);

          const returnedIds = new Set(results.map((q) => q.id));
          const requestedSet = new Set(requestedIds);

          testDb.close();

          return (
            results.length === requestedIds.length &&
            requestedIds.every((id) => returnedIds.has(id)) &&
            results.every((q) => requestedSet.has(q.id))
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: question-history-tracking, Property 3: Seen Question Exclusion Across All Test Types
  // Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
  it('Property 3: Seen questions are excluded across all test types (certification, topic, subtopic)', () => {
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    fc.assert(
      fc.property(
        fc.record({
          certificationId: fc.uuid(),
          topicId: fc.uuid(),
          subTopicId: fc.uuid(),
          totalQuestions: fc.integer({ min: 5, max: 30 }),
          seenQuestionCount: fc.integer({ min: 1, max: 15 }),
          difficulty: fc.option(fc.constantFrom(...difficulties), { nil: null }),
        }),
        ({
          certificationId,
          topicId,
          subTopicId,
          totalQuestions,
          seenQuestionCount,
          difficulty,
        }) => {
          const testDb = createTestDb();

          // Add subtopics table to test schema
          testDb.exec(`
            CREATE TABLE subtopics (
              id TEXT PRIMARY KEY,
              topicId TEXT NOT NULL,
              title TEXT NOT NULL,
              orderIndex INTEGER DEFAULT 0,
              isActive INTEGER DEFAULT 1
            )
          `);

          const repo = new QuestionRepository(testDb);

          // Setup: Create certification, topic, and subtopic
          testDb
            .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
            .run(topicId, certificationId, 'Test Topic');

          testDb
            .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
            .run(subTopicId, topicId, 'Test Subtopic');

          // Create questions
          const allQuestionIds: string[] = [];
          for (let i = 0; i < totalQuestions; i++) {
            const questionId = crypto.randomUUID();
            const questionDifficulty = difficulties[i % difficulties.length];
            testDb
              .prepare(
                `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
                 VALUES (?, ?, ?, ?, 'single', '[]', '[]', ?, '[]', 1, 1)`,
              )
              .run(questionId, topicId, subTopicId, `Question ${i}`, questionDifficulty);
            allQuestionIds.push(questionId);
          }

          // Select random subset as "seen" questions
          const seenCount = Math.min(seenQuestionCount, totalQuestions);
          const seenQuestionIds = allQuestionIds.slice(0, seenCount);
          const seenSet = new Set(seenQuestionIds);

          // Test 1: findByCertificationExcludingSeen (Requirements 2.1, 2.2, 2.3)
          const certResults = repo.findByCertificationExcludingSeen(
            certificationId,
            seenQuestionIds,
            difficulty,
          );
          const certHasSeenQuestion = certResults.some((q) => seenSet.has(q.id));

          // Test 2: findByTopicExcludingSeen (Requirement 2.4)
          const topicResults = repo.findByTopicExcludingSeen(topicId, seenQuestionIds);
          const topicHasSeenQuestion = topicResults.some((q) => seenSet.has(q.id));

          // Test 3: findBySubTopicExcludingSeen (Requirement 2.5)
          const subtopicResults = repo.findBySubTopicExcludingSeen(subTopicId, seenQuestionIds);
          const subtopicHasSeenQuestion = subtopicResults.some((q) => seenSet.has(q.id));

          testDb.close();

          // Property: No selected question should be in the seen set
          return !certHasSeenQuestion && !topicHasSeenQuestion && !subtopicHasSeenQuestion;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Unit tests for QuestionRepository enhancements
  // Requirements: 2.1, 2.4, 2.5, 7.2, 8.1
  describe('QuestionRepository enhancements - Unit Tests', () => {
    let testDb: ReturnType<typeof createTestDb>;
    let repo: QuestionRepository;
    let certificationId: string;
    let topicId: string;
    let subTopicId: string;

    beforeEach(() => {
      testDb = createTestDb();

      // Add subtopics table
      testDb.exec(`
        CREATE TABLE subtopics (
          id TEXT PRIMARY KEY,
          topicId TEXT NOT NULL,
          title TEXT NOT NULL,
          orderIndex INTEGER DEFAULT 0,
          isActive INTEGER DEFAULT 1
        )
      `);

      repo = new QuestionRepository(testDb);

      // Setup test data
      certificationId = crypto.randomUUID();
      topicId = crypto.randomUUID();
      subTopicId = crypto.randomUUID();

      testDb
        .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
        .run(topicId, certificationId, 'Test Topic');

      testDb
        .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
        .run(subTopicId, topicId, 'Test Subtopic');
    });

    it('findByCertificationExcludingSeen with empty exclusion list returns all active questions', () => {
      // Create 5 active questions
      const questionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 1)`,
          )
          .run(qId, topicId, subTopicId, `Question ${i}`);
        questionIds.push(qId);
      }

      const results = repo.findByCertificationExcludingSeen(certificationId, [], null);

      // Should return all 5 questions
      if (results.length !== 5) return false;

      // All returned questions should be in our created set
      const returnedIds = new Set(results.map((q) => q.id));
      return questionIds.every((id) => returnedIds.has(id));
    });

    it('findByCertificationExcludingSeen with all questions excluded returns empty array', () => {
      // Create 5 active questions
      const questionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 1)`,
          )
          .run(qId, topicId, subTopicId, `Question ${i}`);
        questionIds.push(qId);
      }

      // Exclude all questions
      const results = repo.findByCertificationExcludingSeen(certificationId, questionIds, null);

      // Should return empty array
      return results.length === 0;
    });

    it('findByTopicExcludingSeen excludes seen questions correctly', () => {
      // Create 5 active questions
      const questionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 1)`,
          )
          .run(qId, topicId, subTopicId, `Question ${i}`);
        questionIds.push(qId);
      }

      // Exclude first 2 questions
      const excludeIds = questionIds.slice(0, 2);
      const results = repo.findByTopicExcludingSeen(topicId, excludeIds);

      // Should return 3 questions
      if (results.length !== 3) return false;

      // None of the returned questions should be in the exclude list
      const excludeSet = new Set(excludeIds);
      return results.every((q) => !excludeSet.has(q.id));
    });

    it('findBySubTopicExcludingSeen filters out inactive questions', () => {
      // Create 3 active and 2 inactive questions
      const activeIds: string[] = [];
      const inactiveIds: string[] = [];

      for (let i = 0; i < 3; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 1)`,
          )
          .run(qId, topicId, subTopicId, `Active Question ${i}`);
        activeIds.push(qId);
      }

      for (let i = 0; i < 2; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 0)`,
          )
          .run(qId, topicId, subTopicId, `Inactive Question ${i}`);
        inactiveIds.push(qId);
      }

      // Don't exclude any questions
      const results = repo.findBySubTopicExcludingSeen(subTopicId, []);

      // Should return only 3 active questions
      if (results.length !== 3) return false;

      // All returned questions should be active
      if (!results.every((q) => q.isActive === 1)) return false;

      // None of the returned questions should be inactive ones
      const inactiveSet = new Set(inactiveIds);
      return results.every((q) => !inactiveSet.has(q.id));
    });

    it('countByCertification counts only active questions', () => {
      // Create 4 active questions
      for (let i = 0; i < 4; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 1)`,
          )
          .run(qId, topicId, subTopicId, `Active Question ${i}`);
      }

      // Create 3 inactive questions
      for (let i = 0; i < 3; i++) {
        const qId = crypto.randomUUID();
        testDb
          .prepare(
            `INSERT INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'single', '[]', '[]', 'Medium', '[]', 1, 0)`,
          )
          .run(qId, topicId, subTopicId, `Inactive Question ${i}`);
      }

      const count = repo.countByCertification(certificationId);

      // Should count only the 4 active questions
      return count === 4;
    });
  });

  // Unit tests for findByUnitId and findByUnitExcludingSeen
  // Requirements: 8.1, 8.2, 8.3
  describe('findByUnitId and findByUnitExcludingSeen', () => {
    let testDb: ReturnType<typeof Database>;
    let repo: QuestionRepository;
    let unitId: string;
    let topicId: string;
    let subTopicId: string;

    function createTestDbWithUnits() {
      const db = new Database(':memory:');
      db.exec(`
        CREATE TABLE topics (
          id TEXT PRIMARY KEY,
          certificationId TEXT NOT NULL,
          title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
          orderIndex INTEGER DEFAULT 0,
          isActive INTEGER DEFAULT 1
        );
        CREATE TABLE subtopics (
          id TEXT PRIMARY KEY,
          topicId TEXT NOT NULL,
          title TEXT NOT NULL,
          orderIndex INTEGER DEFAULT 0,
          isActive INTEGER DEFAULT 1
        );
        CREATE TABLE units (
          id TEXT PRIMARY KEY,
          subTopicId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          orderIndex INTEGER DEFAULT 0,
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME,
          updatedAt DATETIME
        );
        CREATE TABLE questions (
          id TEXT PRIMARY KEY,
          topicId TEXT NOT NULL,
          subTopicId TEXT,
          unitId TEXT REFERENCES units(id) ON DELETE CASCADE,
          questionText TEXT NOT NULL,
          questionType TEXT DEFAULT 'single',
          options TEXT NOT NULL,
          correctAnswers TEXT NOT NULL,
          explanation TEXT,
          difficulty TEXT DEFAULT 'Medium',
          tags TEXT DEFAULT '[]',
          points INTEGER DEFAULT 1,
          isActive INTEGER DEFAULT 1
        )
      `);
      return db;
    }

    function insertUnitQuestion(
      db: ReturnType<typeof Database>,
      id: string,
      unitId: string,
      topicId: string,
      subTopicId: string,
      isActive = 1,
    ) {
      db.prepare(
        `INSERT INTO questions (id, topicId, subTopicId, unitId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
         VALUES (?, ?, ?, ?, 'Q?', 'single', '[]', '[]', 'Medium', '[]', 1, ?)`,
      ).run(id, topicId, subTopicId, unitId, isActive);
    }

    beforeEach(() => {
      testDb = createTestDbWithUnits();
      repo = new QuestionRepository(testDb);

      topicId = crypto.randomUUID();
      subTopicId = crypto.randomUUID();
      unitId = crypto.randomUUID();

      testDb
        .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
        .run(topicId, crypto.randomUUID(), 'Test Topic');
      testDb
        .prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)')
        .run(subTopicId, topicId, 'Test Subtopic');
      testDb
        .prepare(
          'INSERT INTO units (id, subTopicId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        )
        .run(unitId, subTopicId, 'Test Unit', new Date().toISOString(), new Date().toISOString());
    });

    // Requirement 8.1, 8.3: findByUnitId returns only active questions for the given unit
    it('findByUnitId returns only active questions for the given unitId', () => {
      const activeId1 = crypto.randomUUID();
      const activeId2 = crypto.randomUUID();
      const inactiveId = crypto.randomUUID();

      insertUnitQuestion(testDb, activeId1, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, activeId2, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, inactiveId, unitId, topicId, subTopicId, 0);

      const results = repo.findByUnitId(unitId);

      expect(results).toHaveLength(2);
      const returnedIds = results.map((q) => q.id);
      expect(returnedIds).toContain(activeId1);
      expect(returnedIds).toContain(activeId2);
      expect(returnedIds).not.toContain(inactiveId);
      expect(results.every((q) => q.isActive === 1)).toBe(true);
    });

    // Requirement 8.1: findByUnitId returns empty array for unknown unitId
    it('findByUnitId returns empty array for an unknown unitId', () => {
      // Insert a question for a different unit to ensure the DB is not empty
      const otherId = crypto.randomUUID();
      insertUnitQuestion(testDb, otherId, unitId, topicId, subTopicId, 1);

      const results = repo.findByUnitId('non-existent-unit-id');

      expect(results).toHaveLength(0);
    });

    // Requirement 8.2: findByUnitExcludingSeen excludes seen IDs correctly
    it('findByUnitExcludingSeen excludes questions whose IDs are in the seenIds array', () => {
      const q1 = crypto.randomUUID();
      const q2 = crypto.randomUUID();
      const q3 = crypto.randomUUID();

      insertUnitQuestion(testDb, q1, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, q2, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, q3, unitId, topicId, subTopicId, 1);

      const results = repo.findByUnitExcludingSeen(unitId, [q1, q2]);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(q3);
    });

    // Requirement 8.2, 8.3: findByUnitExcludingSeen returns only active questions
    it('findByUnitExcludingSeen returns only active questions, excluding both seen and inactive', () => {
      const activeUnseen = crypto.randomUUID();
      const activeSeen = crypto.randomUUID();
      const inactiveUnseen = crypto.randomUUID();

      insertUnitQuestion(testDb, activeUnseen, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, activeSeen, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, inactiveUnseen, unitId, topicId, subTopicId, 0);

      const results = repo.findByUnitExcludingSeen(unitId, [activeSeen]);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(activeUnseen);
      expect(results[0].isActive).toBe(1);
    });

    // Requirement 8.2: findByUnitExcludingSeen with empty seenIds returns all active questions
    it('findByUnitExcludingSeen with empty seenIds returns all active questions for the unit', () => {
      const q1 = crypto.randomUUID();
      const q2 = crypto.randomUUID();
      const inactiveId = crypto.randomUUID();

      insertUnitQuestion(testDb, q1, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, q2, unitId, topicId, subTopicId, 1);
      insertUnitQuestion(testDb, inactiveId, unitId, topicId, subTopicId, 0);

      const results = repo.findByUnitExcludingSeen(unitId, []);

      expect(results).toHaveLength(2);
      expect(results.every((q) => q.isActive === 1)).toBe(true);
    });
  });
});
