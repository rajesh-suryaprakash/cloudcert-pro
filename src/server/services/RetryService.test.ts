import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { RetryService } from './RetryService';
import { ValidationError, NotFoundError } from '../errors';

describe('RetryService', () => {
  let testDb: Database.Database;
  let service: RetryService;

  beforeEach(() => {
    testDb = new Database(':memory:');

    // Create minimal schema needed for retry service
    testDb.exec(`
      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        sessionName TEXT,
        questions TEXT,
        totalQuestions INTEGER,
        isPracticeMode INTEGER,
        autoSubmitAt TEXT,
        startTime TEXT,
        endTime TEXT,
        status TEXT,
        timeLeftSeconds INTEGER,
        passingScoreOverride REAL
      );

      CREATE TABLE exam_answers (
        id TEXT PRIMARY KEY,
        examSessionId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        userAnswer TEXT,
        isCorrect INTEGER,
        markedForReview INTEGER,
        confidenceLevel INTEGER,
        answerOrder INTEGER,
        timeSpent INTEGER
      );
    `);

    service = new RetryService(testDb);
  });

  describe('getIncorrectAnswers', () => {
    it('returns questionIds of incorrect answers for a given session', () => {
      // Setup some answers
      testDb
        .prepare(
          `
        INSERT INTO exam_answers (id, examSessionId, questionId, isCorrect, answerOrder)
        VALUES 
          ('a-1', 'session-1', 'q-1', 1, 0),
          ('a-2', 'session-1', 'q-2', 0, 1),
          ('a-3', 'session-1', 'q-3', 0, 2)
      `,
        )
        .run();

      const incorrect = service.getIncorrectAnswers('session-1');
      expect(incorrect).toEqual(['q-2', 'q-3']);
    });

    it('returns empty array if all answers were correct', () => {
      testDb
        .prepare(
          `
        INSERT INTO exam_answers (id, examSessionId, questionId, isCorrect, answerOrder)
        VALUES ('a-1', 'session-1', 'q-1', 1, 0)
      `,
        )
        .run();

      const incorrect = service.getIncorrectAnswers('session-1');
      expect(incorrect).toEqual([]);
    });
  });

  describe('randomizeQuestionOrder', () => {
    it('returns a new array with same items', () => {
      const input = ['q-1', 'q-2', 'q-3', 'q-4'];
      const output = service.randomizeQuestionOrder(input);

      expect(output.length).toBe(input.length);
      expect([...output].sort()).toEqual([...input].sort());
    });
  });

  describe('createRetrySession', () => {
    it('creates a new in_progress retry session record in database', () => {
      const sessionId = service.createRetrySession('user-1', 'cert-1', ['q-2', 'q-3']);
      expect(sessionId).toBeDefined();

      const session = testDb
        .prepare('SELECT * FROM exam_sessions WHERE id = ?')
        .get(sessionId) as any;
      expect(session).toBeDefined();
      expect(session.userId).toBe('user-1');
      expect(session.certificationId).toBe('cert-1');
      expect(session.status).toBe('in_progress');
      expect(JSON.parse(session.questions)).toEqual(['q-2', 'q-3']);
      expect(session.totalQuestions).toBe(2);
      expect(session.isPracticeMode).toBe(1);
    });
  });

  describe('verifySession', () => {
    it('throws NotFoundError if session does not exist', () => {
      expect(() => service.verifySession('non-existent', 'user-1')).toThrow(NotFoundError);
    });

    it('throws ValidationError if session status is not completed', () => {
      testDb
        .prepare(
          `
        INSERT INTO exam_sessions (id, userId, certificationId, status)
        VALUES ('session-1', 'user-1', 'cert-1', 'in_progress')
      `,
        )
        .run();

      expect(() => service.verifySession('session-1', 'user-1')).toThrow(ValidationError);
    });

    it('returns session details if valid and completed', () => {
      testDb
        .prepare(
          `
        INSERT INTO exam_sessions (id, userId, certificationId, status, questions)
        VALUES ('session-1', 'user-1', 'cert-1', 'completed', '["q-1"]')
      `,
        )
        .run();

      const session = service.verifySession('session-1', 'user-1');
      expect(session.id).toBe('session-1');
      expect(session.status).toBe('completed');
    });
  });

  describe('createRetryFromSession', () => {
    it('verifies, extracts incorrect answers, shuffles, and starts retry session', () => {
      testDb
        .prepare(
          `
        INSERT INTO exam_sessions (id, userId, certificationId, status, questions)
        VALUES ('session-1', 'user-1', 'cert-1', 'completed', '["q-1", "q-2"]')
      `,
        )
        .run();

      testDb
        .prepare(
          `
        INSERT INTO exam_answers (id, examSessionId, questionId, isCorrect, answerOrder)
        VALUES 
          ('a-1', 'session-1', 'q-1', 1, 0),
          ('a-2', 'session-1', 'q-2', 0, 1)
      `,
        )
        .run();

      const result = service.createRetryFromSession('session-1', 'user-1');
      expect(result.questionCount).toBe(1);

      const newSession = testDb
        .prepare('SELECT * FROM exam_sessions WHERE id = ?')
        .get(result.newSessionId) as any;
      expect(newSession).toBeDefined();
      expect(JSON.parse(newSession.questions)).toEqual(['q-2']);
    });

    it('throws ValidationError if no incorrect answers to retry', () => {
      testDb
        .prepare(
          `
        INSERT INTO exam_sessions (id, userId, certificationId, status, questions)
        VALUES ('session-1', 'user-1', 'cert-1', 'completed', '["q-1"]')
      `,
        )
        .run();

      testDb
        .prepare(
          `
        INSERT INTO exam_answers (id, examSessionId, questionId, isCorrect, answerOrder)
        VALUES ('a-1', 'session-1', 'q-1', 1, 0)
      `,
        )
        .run();

      expect(() => service.createRetryFromSession('session-1', 'user-1')).toThrow(ValidationError);
    });
  });
});
