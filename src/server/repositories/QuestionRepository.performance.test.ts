import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuestionRepository } from './QuestionRepository';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import crypto from 'crypto';

/**
 * Performance optimization tests for QuestionRepository
 * Tests Requirements: 6.1, 6.3, 6.4
 */
describe('QuestionRepository Performance Optimizations', () => {
  let db: Database.Database;
  let questionRepo: QuestionRepository;
  let historyService: QuestionHistoryService;
  let certificationId: string;
  let topicId: string;
  let subTopicId: string;
  let userId: string;

  beforeEach(() => {
    db = new Database(':memory:');

    // Create minimal schema for testing
    db.exec(`
      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        level TEXT DEFAULT 'Associate',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE topics (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE subtopics (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        title TEXT NOT NULL,
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
        FOREIGN KEY(subTopicId) REFERENCES subtopics(id) ON DELETE CASCADE
      );

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT
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

    questionRepo = new QuestionRepository(db);
    historyService = new QuestionHistoryService(db);

    // Create test data
    certificationId = crypto.randomUUID();
    topicId = crypto.randomUUID();
    subTopicId = crypto.randomUUID();
    userId = crypto.randomUUID();

    db.prepare(
      'INSERT INTO certifications (id, title, level, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    ).run(certificationId, 'Test Cert', 'Associate', Date.now(), Date.now());

    db.prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)').run(
      topicId,
      certificationId,
      'Test Topic',
    );

    db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
      subTopicId,
      topicId,
      'Test Subtopic',
    );

    db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)').run(
      userId,
      'test@example.com',
      'password',
      'Test User',
    );
  });

  afterEach(() => {
    db.close();
  });

  describe('Task 16.1: Verify database indexes are used in queries', () => {
    it('should use an index for seen questions lookup', () => {
      // Requirements: 6.1, 6.4

      // Add some history records
      const questionIds = Array.from({ length: 10 }, () => crypto.randomUUID());
      for (const qId of questionIds) {
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]');
      }

      historyService.recordQuestionsSeen(userId, certificationId, questionIds);

      // Verify index usage
      const indexUsage = historyService.verifyIndexUsage(userId, certificationId);

      // The query plan should mention using an index (SQLite may choose any appropriate index)
      // It could be idx_question_history_user_cert or idx_question_history_lookup (covering index)
      expect(indexUsage.seenQuestionsQuery).toMatch(/USING (COVERING )?INDEX/i);
      expect(indexUsage.seenQuestionsQuery).toMatch(/idx_question_history/i);
    });

    it('should use an index for individual question lookups', () => {
      // Requirements: 6.1, 6.4

      const questionId = crypto.randomUUID();
      db.prepare(
        `
        INSERT INTO questions (id, topicId, questionText, options, correctAnswers)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(questionId, topicId, 'Test question', '[]', '[]');

      historyService.recordQuestionsSeen(userId, certificationId, [questionId]);

      // Verify index usage
      const indexUsage = historyService.verifyIndexUsage(userId, certificationId);

      // The lookup query plan should mention using an index
      // SQLite may use idx_question_history_lookup or the auto-generated unique constraint index
      expect(indexUsage.lookupQuery).toMatch(/USING (COVERING )?INDEX/i);
    });
  });

  describe('Task 16.2: Optimize question exclusion for large seen sets', () => {
    it('should use NOT IN clause for small exclusion lists (<= 1000)', () => {
      // Requirements: 6.3, 6.4

      // Create 100 questions
      const questionIds = Array.from({ length: 100 }, () => {
        const qId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive)
          VALUES (?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]');
        return qId;
      });

      // Exclude 50 questions (small list)
      const excludeIds = questionIds.slice(0, 50);

      const results = questionRepo.findByCertificationExcludingSeen(certificationId, excludeIds);

      // Should return 50 questions (100 - 50 excluded)
      expect(results).toHaveLength(50);

      // Verify none of the excluded IDs are in results
      const resultIds = results.map((q) => q.id);
      for (const excludedId of excludeIds) {
        expect(resultIds).not.toContain(excludedId);
      }
    });

    it('should use temporary table approach for large exclusion lists (> 1000)', () => {
      // Requirements: 6.3, 6.4

      // Create 2000 questions
      const questionIds = Array.from({ length: 2000 }, () => {
        const qId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive)
          VALUES (?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]');
        return qId;
      });

      // Exclude 1500 questions (large list)
      const excludeIds = questionIds.slice(0, 1500);

      const results = questionRepo.findByCertificationExcludingSeen(certificationId, excludeIds);

      // Should return 500 questions (2000 - 1500 excluded)
      expect(results).toHaveLength(500);

      // Verify none of the excluded IDs are in results
      const resultIds = results.map((q) => q.id);
      for (const excludedId of excludeIds) {
        expect(resultIds).not.toContain(excludedId);
      }
    });

    it('should use temporary table for topic queries with large exclusion lists', () => {
      // Requirements: 6.3, 6.4

      // Create 1500 questions
      const questionIds = Array.from({ length: 1500 }, () => {
        const qId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive)
          VALUES (?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]');
        return qId;
      });

      // Exclude 1200 questions
      const excludeIds = questionIds.slice(0, 1200);

      const results = questionRepo.findByTopicExcludingSeen(topicId, excludeIds);

      // Should return 300 questions (1500 - 1200 excluded)
      expect(results).toHaveLength(300);

      // Verify none of the excluded IDs are in results
      const resultIds = results.map((q) => q.id);
      for (const excludedId of excludeIds) {
        expect(resultIds).not.toContain(excludedId);
      }
    });

    it('should use temporary table for subtopic queries with large exclusion lists', () => {
      // Requirements: 6.3, 6.4

      // Create 1200 questions
      const questionIds = Array.from({ length: 1200 }, () => {
        const qId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO questions (id, topicId, subTopicId, questionText, options, correctAnswers, isActive)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, subTopicId, 'Test question', '[]', '[]');
        return qId;
      });

      // Exclude 1100 questions
      const excludeIds = questionIds.slice(0, 1100);

      const results = questionRepo.findBySubTopicExcludingSeen(subTopicId, excludeIds);

      // Should return 100 questions (1200 - 1100 excluded)
      expect(results).toHaveLength(100);

      // Verify none of the excluded IDs are in results
      const resultIds = results.map((q) => q.id);
      for (const excludedId of excludeIds) {
        expect(resultIds).not.toContain(excludedId);
      }
    });

    it('should handle difficulty filter with large exclusion lists', () => {
      // Requirements: 6.3, 6.4

      // Create 1500 questions with different difficulties
      const questionIds = Array.from({ length: 1500 }, (_, i) => {
        const qId = crypto.randomUUID();
        const difficulty = i < 500 ? 'Easy' : i < 1000 ? 'Medium' : 'Hard';
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers, difficulty, isActive)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]', difficulty);
        return qId;
      });

      // Exclude 1200 questions
      const excludeIds = questionIds.slice(0, 1200);

      const results = questionRepo.findByCertificationExcludingSeen(
        certificationId,
        excludeIds,
        'Hard',
      );

      // Should return only Hard questions that weren't excluded
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((q) => q.difficulty === 'Hard')).toBe(true);

      // Verify none of the excluded IDs are in results
      const resultIds = results.map((q) => q.id);
      for (const excludedId of excludeIds) {
        expect(resultIds).not.toContain(excludedId);
      }
    });
  });

  describe('Performance benchmarks', () => {
    it('should complete seen question query within 200ms for 1000+ question pool', () => {
      // Requirements: 6.4

      // Create 1500 questions
      const questionIds = Array.from({ length: 1500 }, () => {
        const qId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive)
          VALUES (?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]');
        return qId;
      });

      // Mark 800 as seen
      historyService.recordQuestionsSeen(userId, certificationId, questionIds.slice(0, 800));

      // Benchmark the query
      const startTime = performance.now();
      const seenIds = historyService.getSeenQuestionIds(userId, certificationId);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(seenIds).toHaveLength(800);
      expect(duration).toBeLessThan(200); // Target: <200ms
    });

    it('should complete question selection with 500+ seen questions within 300ms', () => {
      // Requirements: 6.4

      // Create 1000 questions
      const questionIds = Array.from({ length: 1000 }, () => {
        const qId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO questions (id, topicId, questionText, options, correctAnswers, isActive)
          VALUES (?, ?, ?, ?, ?, 1)
        `,
        ).run(qId, topicId, 'Test question', '[]', '[]');
        return qId;
      });

      // Mark 600 as seen
      const seenIds = questionIds.slice(0, 600);

      // Benchmark the query
      const startTime = performance.now();
      const results = questionRepo.findByCertificationExcludingSeen(certificationId, seenIds);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(400);
      expect(duration).toBeLessThan(300); // Target: <300ms
    });
  });
});
