import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { AnalyticsService } from './AnalyticsService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Unit tests for AnalyticsService time analysis methods
 * Feature: insight-dashboard
 * Task: 2.4 Write unit tests for time analysis
 *
 * Tests verify:
 * - Danger zone warning triggers when avgTimeIncorrect > 180 seconds
 * - Pacing alert calculation with various time scenarios
 * - Edge cases with zero or missing time data
 *
 * Requirements: 4.4, 7.3
 */

describe('AnalyticsService - Time Analysis', () => {
  let testDb: Database.Database;
  let analyticsService: AnalyticsService;

  beforeEach(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Mock the db module to use our test database
    const dbModule = await import('../db/connection');
    vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

    // Create minimal schema needed for time analysis
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE exam_configurations (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        duration INTEGER NOT NULL,
        totalQuestions INTEGER NOT NULL,
        passingScore INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        questionText TEXT NOT NULL,
        questionType TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        status TEXT NOT NULL,
        examName TEXT,
        isPracticeMode INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_answers (
        id TEXT PRIMARY KEY,
        examSessionId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        userAnswer TEXT,
        isCorrect INTEGER,
        timeSpent INTEGER DEFAULT 0,
        confidenceLevel TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_exam_sessions_user_cert ON exam_sessions(userId, certificationId, status, createdAt);
      CREATE INDEX idx_exam_answers_session ON exam_answers(examSessionId);
    `);

    // Create AnalyticsService instance
    analyticsService = new AnalyticsService();
  });

  afterEach(() => {
    testDb.close();
    vi.restoreAllMocks();
  });

  // Helper function to create test data
  function createTestData(config: {
    userId: string;
    certificationId: string;
    examDuration: number;
    totalQuestions: number;
    sessions: Array<{
      correctAnswers: Array<{ timeSpent: number }>;
      incorrectAnswers: Array<{ timeSpent: number }>;
    }>;
  }) {
    // Insert user
    testDb
      .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
      .run(config.userId, 'test@example.com', 'hash');

    // Insert certification
    testDb
      .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
      .run(config.certificationId, 'Test Certification');

    // Insert exam configuration
    testDb
      .prepare(
        'INSERT INTO exam_configurations (id, certificationId, duration, totalQuestions, passingScore) VALUES (?, ?, ?, ?, ?)',
      )
      .run(uuidv4(), config.certificationId, config.examDuration, config.totalQuestions, 70);

    // Insert sessions and answers
    config.sessions.forEach((session, index) => {
      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, status, isPracticeMode, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          sessionId,
          config.userId,
          config.certificationId,
          'completed',
          0,
          new Date(Date.now() - (config.sessions.length - index) * 86400000).toISOString(),
        );

      // Insert correct answers
      session.correctAnswers.forEach((answer) => {
        const questionId = uuidv4();
        testDb
          .prepare(
            'INSERT INTO questions (id, certificationId, questionText, questionType, correctAnswers) VALUES (?, ?, ?, ?, ?)',
          )
          .run(questionId, config.certificationId, 'Test question', 'multiple-choice', 'A');

        testDb
          .prepare(
            'INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, timeSpent) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(uuidv4(), sessionId, questionId, 'A', 1, answer.timeSpent);
      });

      // Insert incorrect answers
      session.incorrectAnswers.forEach((answer) => {
        const questionId = uuidv4();
        testDb
          .prepare(
            'INSERT INTO questions (id, certificationId, questionText, questionType, correctAnswers) VALUES (?, ?, ?, ?, ?)',
          )
          .run(questionId, config.certificationId, 'Test question', 'multiple-choice', 'A');

        testDb
          .prepare(
            'INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, timeSpent) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(uuidv4(), sessionId, questionId, 'B', 0, answer.timeSpent);
      });
    });
  }

  describe('analyzeTimePerQuestion', () => {
    it('should calculate average time for correct and incorrect answers', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 60 }, { timeSpent: 80 }, { timeSpent: 70 }],
            incorrectAnswers: [{ timeSpent: 120 }, { timeSpent: 140 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeCorrect).toBe(70); // (60 + 80 + 70) / 3
      expect(result.avgTimeIncorrect).toBe(130); // (120 + 140) / 2
    });

    it('should trigger danger zone warning when avgTimeIncorrect > 180 seconds', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 60 }],
            incorrectAnswers: [{ timeSpent: 200 }, { timeSpent: 220 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeIncorrect).toBe(210); // (200 + 220) / 2
      expect(result.dangerZoneWarning).toBe(true);
    });

    it('should not trigger danger zone warning when avgTimeIncorrect <= 180 seconds', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 60 }],
            incorrectAnswers: [{ timeSpent: 150 }, { timeSpent: 170 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeIncorrect).toBe(160); // (150 + 170) / 2
      expect(result.dangerZoneWarning).toBe(false);
    });

    it('should trigger pacing alert when projected time > 90% of exam duration', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      // Exam: 120 minutes = 7200 seconds
      // 60 questions
      // 90% of duration = 6480 seconds
      // Average time per question: 110 seconds
      // Projected time: 110 * 60 = 6600 seconds > 6480
      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 100 }, { timeSpent: 110 }, { timeSpent: 120 }],
            incorrectAnswers: [{ timeSpent: 110 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.pacingAlert).toBe(true);
      expect(result.projectedCompletionTime).toBeGreaterThan(6480);
    });

    it('should not trigger pacing alert when projected time <= 90% of exam duration', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      // Exam: 120 minutes = 7200 seconds
      // 60 questions
      // 90% of duration = 6480 seconds
      // Average time per question: 60 seconds
      // Projected time: 60 * 60 = 3600 seconds < 6480
      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 50 }, { timeSpent: 60 }, { timeSpent: 70 }],
            incorrectAnswers: [{ timeSpent: 60 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.pacingAlert).toBe(false);
      expect(result.projectedCompletionTime).toBeLessThanOrEqual(6480);
    });

    it('should handle edge case with zero time data', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 0 }],
            incorrectAnswers: [{ timeSpent: 0 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeCorrect).toBe(0);
      expect(result.avgTimeIncorrect).toBe(0);
      expect(result.dangerZoneWarning).toBe(false);
      expect(result.pacingAlert).toBe(false);
    });

    it('should handle edge case with no exam sessions', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      // Insert user and certification but no sessions
      testDb
        .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
        .run(userId, 'test@example.com', 'hash');

      testDb
        .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
        .run(certificationId, 'Test Certification');

      testDb
        .prepare(
          'INSERT INTO exam_configurations (id, certificationId, duration, totalQuestions, passingScore) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, 120, 60, 70);

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeCorrect).toBe(0);
      expect(result.avgTimeIncorrect).toBe(0);
      expect(result.dangerZoneWarning).toBe(false);
      expect(result.projectedCompletionTime).toBe(0);
      expect(result.pacingAlert).toBe(false);
    });

    it('should handle edge case with only correct answers', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 60 }, { timeSpent: 70 }, { timeSpent: 80 }],
            incorrectAnswers: [],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeCorrect).toBe(70);
      expect(result.avgTimeIncorrect).toBe(0);
      expect(result.dangerZoneWarning).toBe(false);
    });

    it('should handle edge case with only incorrect answers', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [],
            incorrectAnswers: [{ timeSpent: 200 }, { timeSpent: 220 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeCorrect).toBe(0);
      expect(result.avgTimeIncorrect).toBe(210);
      expect(result.dangerZoneWarning).toBe(true);
    });

    it('should handle missing exam configuration gracefully', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      // Insert user and certification but no exam configuration
      testDb
        .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
        .run(userId, 'test@example.com', 'hash');

      testDb
        .prepare('INSERT INTO certifications (id, title) VALUES (?, ?)')
        .run(certificationId, 'Test Certification');

      const sessionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_sessions (id, userId, certificationId, status, isPracticeMode) VALUES (?, ?, ?, ?, ?)',
        )
        .run(sessionId, userId, certificationId, 'completed', 0);

      const questionId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO questions (id, certificationId, questionText, questionType, correctAnswers) VALUES (?, ?, ?, ?, ?)',
        )
        .run(questionId, certificationId, 'Test question', 'multiple-choice', 'A');

      testDb
        .prepare(
          'INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, timeSpent) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), sessionId, questionId, 'A', 1, 60);

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(result.avgTimeCorrect).toBe(60);
      expect(result.projectedCompletionTime).toBe(0);
      expect(result.pacingAlert).toBe(false);
    });

    it('should calculate pacing alert at exactly 90% threshold', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      // Exam: 120 minutes = 7200 seconds
      // 60 questions
      // 90% of duration = 6480 seconds
      // Average time per question: 108 seconds
      // Projected time: 108 * 60 = 6480 seconds (exactly at threshold)
      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [{ timeSpent: 108 }],
            incorrectAnswers: [{ timeSpent: 108 }],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      // At exactly 90%, should not trigger alert (only > 90%)
      expect(result.projectedCompletionTime).toBe(6480);
      expect(result.pacingAlert).toBe(false);
    });

    it('should filter out answers with zero timeSpent from averages', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions: [
          {
            correctAnswers: [
              { timeSpent: 60 },
              { timeSpent: 0 }, // Should be filtered out
              { timeSpent: 80 },
            ],
            incorrectAnswers: [
              { timeSpent: 120 },
              { timeSpent: 0 }, // Should be filtered out
              { timeSpent: 140 },
            ],
          },
        ],
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      // Only non-zero values should be included
      expect(result.avgTimeCorrect).toBe(70); // (60 + 80) / 2
      expect(result.avgTimeIncorrect).toBe(130); // (120 + 140) / 2
    });

    it('should limit analysis to most recent 50 sessions', () => {
      const userId = uuidv4();
      const certificationId = uuidv4();

      // Create 51 sessions - oldest should be ignored
      const sessions = [];
      for (let i = 0; i < 51; i++) {
        sessions.push({
          correctAnswers: [{ timeSpent: i === 0 ? 1000 : 60 }], // First (oldest) has very high time
          incorrectAnswers: [],
        });
      }

      createTestData({
        userId,
        certificationId,
        examDuration: 120,
        totalQuestions: 60,
        sessions,
      });

      const result = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      // If oldest session (1000 seconds) was included, average would be much higher
      // With only recent 50 sessions, average should be close to 60
      expect(result.avgTimeCorrect).toBeLessThan(100);
    });
  });
});
