import { describe, it, beforeEach, expect } from 'vitest';
import Database from 'better-sqlite3';
import { ExamSessionRepository } from './ExamSessionRepository';
import { CertificationRepository } from './CertificationRepository';
import { QuestionRepository } from './QuestionRepository';

function setupDatabase() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT,
      xp INTEGER DEFAULT 0
    );
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      vendor TEXT,
      level TEXT DEFAULT 'Associate',
      examCode TEXT,
      url TEXT,
      iconUrl TEXT,
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
    CREATE TABLE exam_configurations (
      id TEXT PRIMARY KEY,
      certificationId TEXT,
      name TEXT,
      duration INTEGER,
      totalQuestions INTEGER,
      passingScore INTEGER,
      questionSelectionStrategy TEXT,
      topicWeights TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      examConfigurationId TEXT,
      certificationId TEXT,
      topicId TEXT,
      sessionName TEXT,
      questions TEXT NOT NULL,
      status TEXT CHECK(status IN ('in_progress', 'completed', 'abandoned', 'paused')),
      score REAL,
      totalQuestions INTEGER NOT NULL,
      correctAnswers INTEGER DEFAULT 0,
      incorrectAnswers INTEGER DEFAULT 0,
      unansweredQuestions INTEGER DEFAULT 0,
      timeTaken INTEGER,
      startTime TEXT NOT NULL,
      endTime TEXT,
      autoSubmitAt TEXT NOT NULL,
      isPracticeMode INTEGER DEFAULT 0,
      isTopicQuiz INTEGER DEFAULT 0,
      isCustomQuiz INTEGER DEFAULT 0,
      isSRSReview INTEGER DEFAULT 0,
      passingScoreOverride REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      subTopicId TEXT,
      questionText TEXT NOT NULL,
      questionType TEXT CHECK(questionType IN ('single', 'multiple')),
      options TEXT NOT NULL,
      correctAnswers TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
      tags TEXT NOT NULL,
      points INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(topicId) REFERENCES topics(id)
    );
  `);
  return db;
}

describe('Repository Server-Side Pagination Tests', () => {
  let db: Database.Database;
  let sessionRepo: ExamSessionRepository;
  let certRepo: CertificationRepository;
  let questionRepo: QuestionRepository;

  beforeEach(() => {
    db = setupDatabase();
    sessionRepo = new ExamSessionRepository(db);
    certRepo = new CertificationRepository(db);
    questionRepo = new QuestionRepository(db);
  });

  describe('CertificationRepository pagination', () => {
    beforeEach(() => {
      // Seed 5 certifications
      const stmt = db.prepare(`
        INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 1; i <= 5; i++) {
        stmt.run(
          `cert-${i}`,
          `AWS Certified Solutions Architect Associate ${i}`,
          'AWS',
          'AWS SA desc',
          'Associate',
          Date.now(),
          Date.now(),
        );
      }
    });

    it('returns all when no limit is specified', () => {
      const results = certRepo.findAll();
      expect(results).toHaveLength(5);
      expect(certRepo.countAll()).toBe(5);
    });

    it('applies limit correctly', () => {
      const results = certRepo.findAll(2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('cert-1');
      expect(results[1].id).toBe('cert-2');
    });

    it('applies limit and offset correctly', () => {
      const results = certRepo.findAll(2, 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('cert-3');
      expect(results[1].id).toBe('cert-4');
    });
  });

  describe('ExamSessionRepository pagination', () => {
    const userId = 'user-123';

    beforeEach(() => {
      const stmt = db.prepare(`
        INSERT INTO exam_sessions (id, userId, questions, status, totalQuestions, startTime, autoSubmitAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 1; i <= 5; i++) {
        // use descending timestamps so order by createdAt DESC works consistently
        const timeStr = `2026-06-28T07:00:0${6 - i}Z`;
        stmt.run(`session-${i}`, userId, '[]', 'completed', 0, timeStr, timeStr, timeStr, timeStr);
      }
    });

    it('returns all when no limit is specified', () => {
      const results = sessionRepo.findByUser(userId);
      expect(results).toHaveLength(5);
      expect(sessionRepo.countByUser(userId)).toBe(5);
    });

    it('applies limit correctly', () => {
      const results = sessionRepo.findByUser(userId, 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('session-1');
      expect(results[1].id).toBe('session-2');
    });

    it('applies limit and offset correctly', () => {
      const results = sessionRepo.findByUser(userId, 2, 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('session-3');
      expect(results[1].id).toBe('session-4');
    });
  });

  describe('QuestionRepository pagination', () => {
    const topicId = 'topic-123';

    beforeEach(() => {
      // Seed a topic first
      db.prepare(
        `
        INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
        VALUES ('cert-123', 'AWS', 'AWS', 'desc', 'Associate', 0, 0)
      `,
      ).run();
      db.prepare(
        `
        INSERT INTO topics (id, certificationId, title, orderIndex)
        VALUES (?, 'cert-123', 'EC2', 1)
      `,
      ).run(topicId);

      const stmt = db.prepare(`
        INSERT INTO questions (id, topicId, questionText, questionType, options, correctAnswers, tags, createdAt, updatedAt)
        VALUES (?, ?, ?, 'single', '[]', '[]', '[]', '2026-06-28', '2026-06-28')
      `);
      for (let i = 1; i <= 5; i++) {
        stmt.run(`q-${i}`, topicId, `Question Text ${i}`);
      }
    });

    it('returns all when no limit is specified', () => {
      const results = questionRepo.findByTopicId(topicId);
      expect(results).toHaveLength(5);
      expect(questionRepo.countByTopicId(topicId)).toBe(5);
    });

    it('applies limit correctly', () => {
      const results = questionRepo.findByTopicId(topicId, 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('q-1');
      expect(results[1].id).toBe('q-2');
    });

    it('applies limit and offset correctly', () => {
      const results = questionRepo.findByTopicId(topicId, 2, 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('q-3');
      expect(results[1].id).toBe('q-4');
    });
  });
});
