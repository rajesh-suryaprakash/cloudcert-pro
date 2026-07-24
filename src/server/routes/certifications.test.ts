import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { isValidDifficulty, VALID_DIFFICULTIES } from './certifications';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { QuestionHistoryService } from '../services/QuestionHistoryService';

// Feature: custom-quiz-builder, Property 4: Invalid difficulty values produce a 400 error
// Validates: Requirements 2.3
describe('isValidDifficulty', () => {
  it('Property 4: accepts only Easy, Medium, Hard and rejects everything else', () => {
    const validSet = new Set<string>(VALID_DIFFICULTIES);

    // Arbitrary strings that are NOT one of the three valid values
    const invalidDifficultyArb = fc.string().filter((s) => !validSet.has(s));

    fc.assert(
      fc.property(invalidDifficultyArb, (value) => {
        expect(isValidDifficulty(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('accepts all valid difficulty values', () => {
    for (const d of VALID_DIFFICULTIES) {
      expect(isValidDifficulty(d)).toBe(true);
    }
  });
});

// ── Topic docUrl round-trip ───────────────────────────────────────────────────

function createTopicTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      vendor TEXT,
      description TEXT,
      level TEXT DEFAULT 'Associate',
      examCode TEXT,
      url TEXT,
      iconUrl TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(title, level)
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      docUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
      UNIQUE(certificationId, title)
    );
  `);
  return db;
}

/**
 * Feature: study-plan-enhancements, Property 5: Topic docUrl round-trip
 * Validates: Requirements 3.2
 */
describe('topic docUrl round-trip', () => {
  it('Property 5: saving a valid HTTPS docUrl and fetching the topic returns the same URL', () => {
    // Generate valid HTTPS URLs by building them from components
    const httpsUrlArb = fc
      .tuple(
        fc.stringMatching(/^[a-z0-9-]{3,20}$/), // host
        fc.stringMatching(/^[a-z0-9/-]{0,30}$/), // path
      )
      .map(([host, path]) => `https://${host}.example.com/${path}`);

    fc.assert(
      fc.property(httpsUrlArb, (docUrl) => {
        const db = createTopicTestDb();
        const repo = new CertificationRepository(db);

        const now = Date.now();
        const certId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
           VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
        ).run(certId, now, now);

        const topicId = repo.createTopic({
          certificationId: certId,
          title: 'Test Topic',
        });

        const before = repo.findTopicById(topicId);
        if (!before) return false;
        repo.updateTopic(topicId, { docUrl }, before);

        const after = repo.findTopicById(topicId);
        if (!after) return false;
        expect(after.docUrl).toBe(docUrl);

        db.close();
      }),
      { numRuns: 100 },
    );
  });
});

// ── Question History API Endpoints ────────────────────────────────────────────

function createQuestionHistoryTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      vendor TEXT,
      description TEXT,
      level TEXT DEFAULT 'Associate',
      examCode TEXT,
      url TEXT,
      iconUrl TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(title, level)
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      docUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
      UNIQUE(certificationId, title)
    );

    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
      UNIQUE(topicId, title)
    );

    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      subTopicId TEXT,
      unitId TEXT,
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
      UNIQUE(userId, certificationId, questionId)
    );

    CREATE INDEX idx_question_history_user_cert ON question_history(userId, certificationId);
    CREATE INDEX idx_question_history_lookup ON question_history(userId, certificationId, questionId);
  `);
  return db;
}

/**
 * Feature: question-history-tracking
 * Unit tests for question history API endpoints
 * Requirements: 7.1, 7.2, 7.3, 4.1, 4.2, 3.4, 10.1, 10.2, 10.3, 10.4
 */
describe('Question History API Endpoints', () => {
  it('getHistoryStats returns correct statistics', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 10 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 3 questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 3));

    // Get statistics
    const stats = historyService.getHistoryStats(userId, certId);

    expect(stats.seenCount).toBe(3);
    expect(stats.totalCount).toBe(10);
    expect(stats.percentageSeen).toBe(30);

    db.close();
  });

  it('resetHistory clears all records for user and certification', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 5 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark all questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds);

    // Verify records exist
    const seenBefore = historyService.getSeenQuestionIds(userId, certId);
    expect(seenBefore.length).toBe(5);

    // Reset history
    const recordsCleared = historyService.resetHistory(userId, certId);
    expect(recordsCleared).toBe(5);

    // Verify records are cleared
    const seenAfter = historyService.getSeenQuestionIds(userId, certId);
    expect(seenAfter.length).toBe(0);

    db.close();
  });

  it('getSeenQuestionIds returns correct unseen count', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 8 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 4 questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 4));

    // Get seen question IDs
    const seenIds = historyService.getSeenQuestionIds(userId, certId);

    // Get unseen questions
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(certId, seenIds, null);

    expect(unseenQuestions.length).toBe(4);
    expect(questionRepo.countByCertification(certId)).toBe(8);

    db.close();
  });

  // Task 6.5: Unit tests for API endpoints
  // Requirements: 3.4, 4.1, 4.4, 7.1, 10.1, 10.2, 10.3, 10.4

  it('GET /certifications/:id/question-history/stats - success case (Requirement 7.1, 10.2)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 15 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 15; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 6 questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 6));

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    const stats = historyService.getHistoryStats(userId, certId);

    // Verify response structure and values
    expect(stats).toHaveProperty('seenCount');
    expect(stats).toHaveProperty('totalCount');
    expect(stats).toHaveProperty('percentageSeen');
    expect(stats.seenCount).toBe(6);
    expect(stats.totalCount).toBe(15);
    expect(stats.percentageSeen).toBe(40);

    db.close();
  });

  it('GET /certifications/:id/question-history/stats - certification not found (Requirement 10.2)', () => {
    const db = createQuestionHistoryTestDb();
    const certRepo = new CertificationRepository(db);

    const nonExistentCertId = crypto.randomUUID();

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === nonExistentCertId);

    // Should not find certification
    expect(certification).toBeUndefined();

    db.close();
  });

  it('POST /certifications/:id/question-history/reset - success case (Requirement 4.1, 10.3)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 7 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark all questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds);

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    const recordsCleared = historyService.resetHistory(userId, certId);

    // Verify response structure and value
    expect(recordsCleared).toBe(7);

    // Verify history is actually cleared
    const seenAfter = historyService.getSeenQuestionIds(userId, certId);
    expect(seenAfter.length).toBe(0);

    db.close();
  });

  it('POST /certifications/:id/question-history/reset - unauthorized access (Requirement 4.4)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const user1Id = crypto.randomUUID();
    const user2Id = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 5 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // User 1 marks questions as seen
    historyService.recordQuestionsSeen(user1Id, certId, questionIds);

    // User 2 attempts to reset (only affects their own records)
    const recordsCleared = historyService.resetHistory(user2Id, certId);
    expect(recordsCleared).toBe(0); // No records for user2

    // User 1's records should still exist
    const user1Seen = historyService.getSeenQuestionIds(user1Id, certId);
    expect(user1Seen.length).toBe(5);

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - with filters (Requirement 3.4, 10.1, 10.4)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 12 questions with different difficulties
    const questionIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const difficulty = i < 4 ? 'Easy' : i < 8 ? 'Medium' : 'Hard';
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        difficulty,
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 3 Easy questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 3));

    // Simulate API endpoint logic - get unseen questions with difficulty filter
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenQuestionIds,
      'Easy',
    );
    const totalCount = questionRepo.countByCertification(certId);

    // Verify response
    expect(unseenQuestions.length).toBe(1); // 4 Easy total - 3 seen = 1 unseen
    expect(totalCount).toBe(12);

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - insufficient questions (Requirement 3.4, 10.1)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 10 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 8 questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 8));

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenQuestionIds,
      null,
    );
    const totalCount = questionRepo.countByCertification(certId);

    // Verify response structure
    const response = {
      unseenCount: unseenQuestions.length,
      totalCount,
      hasInsufficientQuestions: unseenQuestions.length < totalCount && unseenQuestions.length > 0,
    };

    expect(response.unseenCount).toBe(2);
    expect(response.totalCount).toBe(10);
    expect(response.hasInsufficientQuestions).toBe(true); // Warning flag should be set

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - with topic filter (Requirement 10.4)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topic1Id = certRepo.createTopic({
      certificationId: certId,
      title: 'Topic 1',
    });

    const topic2Id = certRepo.createTopic({
      certificationId: certId,
      title: 'Topic 2',
    });

    // Create 5 questions for topic 1
    const topic1QuestionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const qId = questionRepo.createQuestion({
        topicId: topic1Id,
        subTopicId: null,
        questionText: `Topic 1 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      topic1QuestionIds.push(qId);
    }

    // Create 3 questions for topic 2
    for (let i = 0; i < 3; i++) {
      questionRepo.createQuestion({
        topicId: topic2Id,
        subTopicId: null,
        questionText: `Topic 2 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
    }

    // Mark 2 questions from topic 1 as seen
    historyService.recordQuestionsSeen(userId, certId, topic1QuestionIds.slice(0, 2));

    // Simulate API endpoint logic with topic filter
    const topic = certRepo.findTopicById(topic1Id);
    expect(topic).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByTopicExcludingSeen(topic1Id, seenQuestionIds);
    const totalTopicQuestions = questionRepo
      .findByTopicId(topic1Id)
      .filter((q) => q.isActive === 1).length;

    // Verify response
    expect(unseenQuestions.length).toBe(3); // 5 total - 2 seen = 3 unseen
    expect(totalTopicQuestions).toBe(5);

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - with subtopic filter (Requirement 10.4)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    const subtopicId = certRepo.createSubTopic({
      topicId,
      title: 'Test Subtopic',
    });

    // Create 6 questions for subtopic
    const subtopicQuestionIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: subtopicId,
        questionText: `Subtopic Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      subtopicQuestionIds.push(qId);
    }

    // Mark 4 questions as seen
    historyService.recordQuestionsSeen(userId, certId, subtopicQuestionIds.slice(0, 4));

    // Simulate API endpoint logic with subtopic filter
    const subtopic = certRepo.findSubTopicById(subtopicId);
    expect(subtopic).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findBySubTopicExcludingSeen(subtopicId, seenQuestionIds);
    const totalSubtopicQuestions = questionRepo
      .findBySubTopicId(subtopicId)
      .filter((q) => q.isActive === 1).length;

    // Verify response
    expect(unseenQuestions.length).toBe(2); // 6 total - 4 seen = 2 unseen
    expect(totalSubtopicQuestions).toBe(6);

    db.close();
  });
});

/**
 * Feature: question-history-tracking, Task 11.5
 * Integration tests for modified endpoints with seen question exclusion
 * Requirements: 2.1, 2.4, 2.5, 5.4
 */
describe('Modified Endpoints - Seen Question Exclusion Integration Tests', () => {
  it('GET /certifications/:id/questions excludes seen questions (Requirement 2.1)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create certification
    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'AWS Solutions Architect', 'AWS', 'Test Cert', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    // Create topic
    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'EC2',
    });

    // Create 10 questions with different difficulties
    const questionIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const difficulty = i < 3 ? 'Easy' : i < 7 ? 'Medium' : 'Hard';
      const qId = questionRepo.createQuestion({
        topicId,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        difficulty,
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 5 questions as seen (2 Easy, 2 Medium, 1 Hard)
    const seenIds = [
      questionIds[0],
      questionIds[1],
      questionIds[3],
      questionIds[4],
      questionIds[7],
    ];
    historyService.recordQuestionsSeen(userId, certId, seenIds);

    // Test 1: Get all unseen questions (no difficulty filter)
    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const allUnseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenQuestionIds,
      null,
    );

    expect(allUnseenQuestions.length).toBe(5); // 10 total - 5 seen = 5 unseen
    expect(allUnseenQuestions.every((q) => !seenIds.includes(q.id))).toBe(true);

    // Test 2: Get unseen questions with difficulty filter (Medium)
    const mediumUnseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenQuestionIds,
      'Medium',
    );

    expect(mediumUnseenQuestions.length).toBe(2); // 4 Medium total - 2 seen = 2 unseen
    expect(mediumUnseenQuestions.every((q) => q.difficulty === 'Medium')).toBe(true);
    expect(mediumUnseenQuestions.every((q) => !seenIds.includes(q.id))).toBe(true);

    // Test 3: Verify exhausted pool returns empty array
    historyService.recordQuestionsSeen(userId, certId, questionIds);
    const seenAllIds = historyService.getSeenQuestionIds(userId, certId);
    const exhaustedQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenAllIds,
      null,
    );

    expect(exhaustedQuestions.length).toBe(0);

    db.close();
  });

  it('GET /topics/:id/questions excludes seen questions (Requirement 2.4)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create certification
    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'GCP Professional', 'Google', 'Test Cert', 'Professional', ?, ?)`,
    ).run(certId, now, now);

    // Create two topics
    const topic1Id = certRepo.createTopic({
      certificationId: certId,
      title: 'Compute Engine',
    });

    const topic2Id = certRepo.createTopic({
      certificationId: certId,
      title: 'Cloud Storage',
    });

    // Create 8 questions for topic1
    const topic1QuestionIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const qId = questionRepo.createQuestion({
        topicId: topic1Id,
        questionText: `Topic1 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      topic1QuestionIds.push(qId);
    }

    // Create 5 questions for topic2
    const topic2QuestionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const qId = questionRepo.createQuestion({
        topicId: topic2Id,
        questionText: `Topic2 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      topic2QuestionIds.push(qId);
    }

    // Mark 5 questions from topic1 as seen
    historyService.recordQuestionsSeen(userId, certId, topic1QuestionIds.slice(0, 5));

    // Test: Get unseen questions for topic1
    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenTopic1Questions = questionRepo.findByTopicExcludingSeen(topic1Id, seenQuestionIds);

    expect(unseenTopic1Questions.length).toBe(3); // 8 total - 5 seen = 3 unseen
    expect(unseenTopic1Questions.every((q) => q.topicId === topic1Id)).toBe(true);
    expect(unseenTopic1Questions.every((q) => !topic1QuestionIds.slice(0, 5).includes(q.id))).toBe(
      true,
    );

    // Test: Get unseen questions for topic2 (none marked as seen)
    const unseenTopic2Questions = questionRepo.findByTopicExcludingSeen(topic2Id, seenQuestionIds);

    expect(unseenTopic2Questions.length).toBe(5); // All questions unseen
    expect(unseenTopic2Questions.every((q) => q.topicId === topic2Id)).toBe(true);

    db.close();
  });

  it('GET /subtopics/:id/questions excludes seen questions (Requirement 2.5)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create certification
    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Azure Administrator', 'Microsoft', 'Test Cert', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    // Create topic
    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Virtual Machines',
    });

    // Create two subtopics
    const subtopic1Id = certRepo.createSubTopic({
      topicId,
      title: 'VM Configuration',
    });

    const subtopic2Id = certRepo.createSubTopic({
      topicId,
      title: 'VM Networking',
    });

    // Create 7 questions for subtopic1
    const subtopic1QuestionIds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: subtopic1Id,
        questionText: `Subtopic1 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      subtopic1QuestionIds.push(qId);
    }

    // Create 4 questions for subtopic2
    const subtopic2QuestionIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: subtopic2Id,
        questionText: `Subtopic2 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      subtopic2QuestionIds.push(qId);
    }

    // Mark 4 questions from subtopic1 as seen
    historyService.recordQuestionsSeen(userId, certId, subtopic1QuestionIds.slice(0, 4));

    // Test: Get unseen questions for subtopic1
    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenSubtopic1Questions = questionRepo.findBySubTopicExcludingSeen(
      subtopic1Id,
      seenQuestionIds,
    );

    expect(unseenSubtopic1Questions.length).toBe(3); // 7 total - 4 seen = 3 unseen
    expect(unseenSubtopic1Questions.every((q) => q.subTopicId === subtopic1Id)).toBe(true);
    expect(
      unseenSubtopic1Questions.every((q) => !subtopic1QuestionIds.slice(0, 4).includes(q.id)),
    ).toBe(true);

    // Test: Get unseen questions for subtopic2 (none marked as seen)
    const unseenSubtopic2Questions = questionRepo.findBySubTopicExcludingSeen(
      subtopic2Id,
      seenQuestionIds,
    );

    expect(unseenSubtopic2Questions.length).toBe(4); // All questions unseen
    expect(unseenSubtopic2Questions.every((q) => q.subTopicId === subtopic2Id)).toBe(true);

    db.close();
  });

  it('Cross-certification question independence (Requirement 5.4)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    const now = Date.now();
    const cert1Id = crypto.randomUUID();
    const cert2Id = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create two certifications
    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'AWS Solutions Architect', 'AWS', 'Cert 1', 'Associate', ?, ?)`,
    ).run(cert1Id, now, now);

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'AWS Developer', 'AWS', 'Cert 2', 'Associate', ?, ?)`,
    ).run(cert2Id, now, now);

    // Create topics for each certification
    const topic1Id = certRepo.createTopic({
      certificationId: cert1Id,
      title: 'EC2',
    });

    const topic2Id = certRepo.createTopic({
      certificationId: cert2Id,
      title: 'Lambda',
    });

    // Create questions for cert1
    const cert1QuestionIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const qId = questionRepo.createQuestion({
        topicId: topic1Id,
        questionText: `Cert1 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      cert1QuestionIds.push(qId);
    }

    // Create questions for cert2 (reuse some question IDs to simulate shared questions)
    const cert2QuestionIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const qId = questionRepo.createQuestion({
        topicId: topic2Id,
        questionText: `Cert2 Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      cert2QuestionIds.push(qId);
    }

    // Mark 6 questions as seen in cert1
    historyService.recordQuestionsSeen(userId, cert1Id, cert1QuestionIds.slice(0, 6));

    // Mark 3 questions as seen in cert2
    historyService.recordQuestionsSeen(userId, cert2Id, cert2QuestionIds.slice(0, 3));

    // Test 1: Verify cert1 history is independent
    const seenCert1Ids = historyService.getSeenQuestionIds(userId, cert1Id);
    expect(seenCert1Ids.length).toBe(6);
    expect(seenCert1Ids.every((id) => cert1QuestionIds.slice(0, 6).includes(id))).toBe(true);

    const unseenCert1Questions = questionRepo.findByCertificationExcludingSeen(
      cert1Id,
      seenCert1Ids,
      null,
    );
    expect(unseenCert1Questions.length).toBe(4); // 10 - 6 = 4

    // Test 2: Verify cert2 history is independent
    const seenCert2Ids = historyService.getSeenQuestionIds(userId, cert2Id);
    expect(seenCert2Ids.length).toBe(3);
    expect(seenCert2Ids.every((id) => cert2QuestionIds.slice(0, 3).includes(id))).toBe(true);

    const unseenCert2Questions = questionRepo.findByCertificationExcludingSeen(
      cert2Id,
      seenCert2Ids,
      null,
    );
    expect(unseenCert2Questions.length).toBe(5); // 8 - 3 = 5

    // Test 3: Verify no cross-contamination
    // Seen questions in cert1 should not affect cert2
    expect(seenCert2Ids.every((id) => !cert1QuestionIds.includes(id))).toBe(true);
    expect(seenCert1Ids.every((id) => !cert2QuestionIds.includes(id))).toBe(true);

    // Test 4: Reset cert1 history should not affect cert2
    historyService.resetHistory(userId, cert1Id);
    const seenCert1IdsAfterReset = historyService.getSeenQuestionIds(userId, cert1Id);
    const seenCert2IdsAfterCert1Reset = historyService.getSeenQuestionIds(userId, cert2Id);

    expect(seenCert1IdsAfterReset.length).toBe(0);
    expect(seenCert2IdsAfterCert1Reset.length).toBe(3); // Unchanged

    db.close();
  });

  it('Inactive questions are excluded from selection (Requirement 8.1)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create certification
    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    // Create topic
    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 10 active questions
    const activeQuestionIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        questionText: `Active Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      activeQuestionIds.push(qId);
    }

    // Create 5 inactive questions
    const inactiveQuestionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        questionText: `Inactive Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: false,
      });
      inactiveQuestionIds.push(qId);
    }

    // Mark 3 active questions and 2 inactive questions as seen
    historyService.recordQuestionsSeen(userId, certId, [
      ...activeQuestionIds.slice(0, 3),
      ...inactiveQuestionIds.slice(0, 2),
    ]);

    // Test: Get unseen questions (should only return active questions)
    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenQuestionIds,
      null,
    );

    // Should return 7 active unseen questions (10 active - 3 seen active)
    // Inactive questions should not be included even if unseen
    expect(unseenQuestions.length).toBe(7);
    expect(unseenQuestions.every((q) => q.isActive === 1)).toBe(true);
    expect(unseenQuestions.every((q) => !inactiveQuestionIds.includes(q.id))).toBe(true);

    db.close();
  });
});

/**
 * Feature: question-history-tracking, Task 14.4
 * Unit tests for error handling scenarios
 * Requirements: 3.1, 3.2, 3.3, 4.4
 */
describe('Question History Error Handling Tests', () => {
  it('GET /certifications/:id/questions/unseen - exhausted question pool error (Requirement 3.3)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 5 questions
    const questionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark ALL questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds);

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByCertificationExcludingSeen(
      certId,
      seenQuestionIds,
      null,
    );
    const totalCount = questionRepo.countByCertification(certId);

    // Verify exhausted pool response
    expect(unseenQuestions.length).toBe(0);
    expect(totalCount).toBe(5);

    // When unseenCount is 0, the API should indicate exhausted pool
    const response = {
      unseenCount: unseenQuestions.length,
      totalCount,
      hasInsufficientQuestions: unseenQuestions.length < totalCount && unseenQuestions.length > 0,
    };

    expect(response.unseenCount).toBe(0);
    expect(response.hasInsufficientQuestions).toBe(false); // False because count is 0, not just insufficient

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - invalid topic ID error (Requirement 4.4)', () => {
    const db = createQuestionHistoryTestDb();
    const certRepo = new CertificationRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const nonExistentTopicId = crypto.randomUUID();

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    // Validate topic exists
    const topic = certRepo.findTopicById(nonExistentTopicId);

    // Should not find topic
    expect(topic).toBeUndefined();

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - invalid subtopic ID error (Requirement 4.4)', () => {
    const db = createQuestionHistoryTestDb();
    const certRepo = new CertificationRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const nonExistentSubtopicId = crypto.randomUUID();

    // Simulate API endpoint logic
    const certification = certRepo.findAll().find((c) => c.id === certId);
    expect(certification).toBeDefined();

    // Validate subtopic exists
    const subtopic = certRepo.findSubTopicById(nonExistentSubtopicId);

    // Should not find subtopic
    expect(subtopic).toBeUndefined();

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - insufficient questions warning with topic filter (Requirements 3.1, 3.2)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 6 questions for the topic
    const questionIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 5 questions as seen (leaving only 1 unseen)
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 5));

    // Simulate API endpoint logic with topic filter
    const topic = certRepo.findTopicById(topicId);
    expect(topic).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByTopicExcludingSeen(topicId, seenQuestionIds);
    const totalTopicQuestions = questionRepo
      .findByTopicId(topicId)
      .filter((q) => q.isActive === 1).length;

    // Verify insufficient questions warning
    const response = {
      unseenCount: unseenQuestions.length,
      totalCount: totalTopicQuestions,
      hasInsufficientQuestions:
        unseenQuestions.length < totalTopicQuestions && unseenQuestions.length > 0,
    };

    expect(response.unseenCount).toBe(1);
    expect(response.totalCount).toBe(6);
    expect(response.hasInsufficientQuestions).toBe(true); // Warning flag should be set

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - insufficient questions warning with subtopic filter (Requirements 3.1, 3.2)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    const subtopicId = certRepo.createSubTopic({
      topicId,
      title: 'Test Subtopic',
    });

    // Create 8 questions for the subtopic
    const questionIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: subtopicId,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark 6 questions as seen (leaving only 2 unseen)
    historyService.recordQuestionsSeen(userId, certId, questionIds.slice(0, 6));

    // Simulate API endpoint logic with subtopic filter
    const subtopic = certRepo.findSubTopicById(subtopicId);
    expect(subtopic).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findBySubTopicExcludingSeen(subtopicId, seenQuestionIds);
    const totalSubtopicQuestions = questionRepo
      .findBySubTopicId(subtopicId)
      .filter((q) => q.isActive === 1).length;

    // Verify insufficient questions warning
    const response = {
      unseenCount: unseenQuestions.length,
      totalCount: totalSubtopicQuestions,
      hasInsufficientQuestions:
        unseenQuestions.length < totalSubtopicQuestions && unseenQuestions.length > 0,
    };

    expect(response.unseenCount).toBe(2);
    expect(response.totalCount).toBe(8);
    expect(response.hasInsufficientQuestions).toBe(true); // Warning flag should be set

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - exhausted pool with topic filter (Requirement 3.3)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    // Create 4 questions for the topic
    const questionIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: null,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark ALL questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds);

    // Simulate API endpoint logic with topic filter
    const topic = certRepo.findTopicById(topicId);
    expect(topic).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findByTopicExcludingSeen(topicId, seenQuestionIds);
    const totalTopicQuestions = questionRepo
      .findByTopicId(topicId)
      .filter((q) => q.isActive === 1).length;

    // Verify exhausted pool response
    expect(unseenQuestions.length).toBe(0);
    expect(totalTopicQuestions).toBe(4);

    db.close();
  });

  it('GET /certifications/:id/questions/unseen - exhausted pool with subtopic filter (Requirement 3.3)', () => {
    const db = createQuestionHistoryTestDb();
    const historyService = new QuestionHistoryService(db);
    const certRepo = new CertificationRepository(db);
    const questionRepo = new QuestionRepository(db);

    // Create test data
    const now = Date.now();
    const certId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
       VALUES (?, 'Test Cert', 'Vendor', 'Desc', 'Associate', ?, ?)`,
    ).run(certId, now, now);

    const topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    const subtopicId = certRepo.createSubTopic({
      topicId,
      title: 'Test Subtopic',
    });

    // Create 3 questions for the subtopic
    const questionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const qId = questionRepo.createQuestion({
        topicId,
        subTopicId: subtopicId,
        questionText: `Question ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctAnswers: 'A',
        isActive: true,
      });
      questionIds.push(qId);
    }

    // Mark ALL questions as seen
    historyService.recordQuestionsSeen(userId, certId, questionIds);

    // Simulate API endpoint logic with subtopic filter
    const subtopic = certRepo.findSubTopicById(subtopicId);
    expect(subtopic).toBeDefined();

    const seenQuestionIds = historyService.getSeenQuestionIds(userId, certId);
    const unseenQuestions = questionRepo.findBySubTopicExcludingSeen(subtopicId, seenQuestionIds);
    const totalSubtopicQuestions = questionRepo
      .findBySubTopicId(subtopicId)
      .filter((q) => q.isActive === 1).length;

    // Verify exhausted pool response
    expect(unseenQuestions.length).toBe(0);
    expect(totalSubtopicQuestions).toBe(3);

    db.close();
  });
});
