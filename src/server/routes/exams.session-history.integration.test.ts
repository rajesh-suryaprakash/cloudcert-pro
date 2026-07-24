import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { ExamSessionRepository } from '../repositories/ExamSessionRepository';
import { ExamAnswerRepository } from '../repositories/ExamAnswerRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import { ExamGradingService } from '../services/ExamGradingService';
import { SrsService } from '../services/srs';
import { nowIso, nowMs } from '../utils/time';
import { NotFoundError, ValidationError } from '../errors';
import { validate, submitAnswerSchema, createSessionSchema } from '../middleware/validate';
import { requireUser } from '../middleware/auth';
import { computeAutoSubmitAt } from './exams';

/**
 * Integration tests for session creation with question history tracking
 *
 * Feature: question-history-tracking
 * Task: 8.3 Write integration test for session creation with history
 * Requirements: 1.1, 1.2, 1.4
 *
 * Tests cover:
 * - History records created when session is created
 * - History records persist when session is completed
 * - History records persist when session is abandoned
 */

describe('Exam Session History Integration Tests', () => {
  let app: Express;
  let testDb: Database.Database;
  let sessionRepo: ExamSessionRepository;
  let answerRepo: ExamAnswerRepository;
  let questionRepo: QuestionRepository;
  let userRepo: UserRepository;
  let questionHistoryService: QuestionHistoryService;
  let gradingService: ExamGradingService;
  let srsService: SrsService;
  let userToken: string;
  let testQuestionIds: string[] = [];
  const testUserId = uuidv4();
  const testCertificationId = uuidv4();
  const testJwtSecret = 'test-jwt-secret-with-at-least-32-characters-for-security';

  // Mock authenticate middleware
  const authenticate = (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new Error('Unauthorized'));
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, testJwtSecret) as {
        id: string;
        email: string;
        role: string;
      };
      req.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  };

  // Mock error handler
  const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  };

  beforeEach(() => {
    // Create in-memory database
    testDb = new Database(':memory:');

    // Set up test schema
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        streak INTEGER DEFAULT 0,
        lastActivityDate TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        provider TEXT,
        difficulty TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE topics (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        orderIndex INTEGER DEFAULT 0,
        weightPercentage REAL DEFAULT 0,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE sub_topics (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        orderIndex INTEGER DEFAULT 0,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        subTopicId TEXT,
        questionText TEXT NOT NULL,
        options TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        explanation TEXT,
        difficulty TEXT,
        tags TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        description TEXT,
        totalQuestions INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        passingScore INTEGER NOT NULL,
        difficulty TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        examConfigurationId TEXT,
        certificationId TEXT,
        sessionName TEXT,
        questions TEXT NOT NULL,
        totalQuestions INTEGER NOT NULL,
        isPracticeMode INTEGER DEFAULT 0,
        isCustomQuiz INTEGER DEFAULT 0,
        status TEXT DEFAULT 'in_progress',
        score INTEGER,
        correctAnswers INTEGER,
        incorrectAnswers INTEGER,
        unansweredQuestions INTEGER,
        xpAwarded INTEGER,
        startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        endTime DATETIME,
        timeTaken INTEGER,
        autoSubmitAt DATETIME,
        passingScoreOverride INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE SET NULL,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL
      );

      CREATE TABLE exam_answers (
        id TEXT PRIMARY KEY,
        examSessionId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        userAnswer TEXT,
        isCorrect INTEGER,
        markedForReview INTEGER DEFAULT 0,
        confidenceLevel TEXT,
        answerOrder INTEGER,
        timeSpent INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(examSessionId, questionId)
      );

      CREATE TABLE achievements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        xpReward INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE user_achievements (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        achievementId TEXT NOT NULL,
        earnedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(achievementId) REFERENCES achievements(id) ON DELETE CASCADE,
        UNIQUE(userId, achievementId)
      );

      CREATE TABLE srs_reviews (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        easeFactor REAL DEFAULT 2.5,
        interval INTEGER DEFAULT 0,
        repetitions INTEGER DEFAULT 0,
        nextReviewDate TEXT,
        lastReviewedAt TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(userId, questionId)
      );

      CREATE TABLE question_reviews (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        userId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        easeFactor REAL DEFAULT 2.5,
        interval INTEGER DEFAULT 0,
        repetitions INTEGER DEFAULT 0,
        nextReviewDate TEXT,
        lastReviewDate TEXT,
        quality INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
        UNIQUE(userId, questionId)
      );
    `);

    // Insert test data
    testDb
      .prepare('INSERT INTO users (id, email, passwordHash, role) VALUES (?, ?, ?, ?)')
      .run(testUserId, 'test@example.com', 'hashed-password', 'user');

    testDb
      .prepare(
        'INSERT INTO certifications (id, name, description, provider, difficulty) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        testCertificationId,
        'Test Certification',
        'A test certification',
        'Test Provider',
        'intermediate',
      );

    const topicId = uuidv4();
    testDb
      .prepare('INSERT INTO topics (id, certificationId, name) VALUES (?, ?, ?)')
      .run(topicId, testCertificationId, 'Test Topic');

    // Insert test questions with UUID IDs
    testQuestionIds = [];
    for (let i = 1; i <= 5; i++) {
      const questionId = uuidv4();
      testQuestionIds.push(questionId);
      testDb
        .prepare(
          `
        INSERT INTO questions (id, topicId, questionText, options, correctAnswers, difficulty, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          questionId,
          topicId,
          `Test Question ${i}`,
          JSON.stringify(['A', 'B', 'C', 'D']),
          JSON.stringify(['A']),
          'easy',
          1,
        );
    }

    // Initialize repositories and services with test database
    sessionRepo = new ExamSessionRepository(testDb);
    answerRepo = new ExamAnswerRepository(testDb);
    questionRepo = new QuestionRepository(testDb);
    userRepo = new UserRepository(testDb);
    questionHistoryService = new QuestionHistoryService(testDb);
    gradingService = new ExamGradingService();
    srsService = new SrsService(testDb);

    // Create Express app with test router
    const router = express.Router();

    // POST /exam-sessions - Create exam session
    router.post(
      '/exam-sessions',
      authenticate,
      validate(createSessionSchema),
      (req: Request, res: Response, next: NextFunction) => {
        try {
          const { examConfigurationId, certificationId, sessionName, questions, isPracticeMode } =
            req.body;

          // If tied to an exam config, verify all question IDs belong to that config
          if (examConfigurationId) {
            const validIds = questionRepo.findIdsByExamConfig(examConfigurationId, questions);
            if (validIds.length !== questions.length) {
              return next(
                new ValidationError(
                  'One or more question IDs do not belong to the specified exam configuration',
                ),
              );
            }
          }

          const id = crypto.randomUUID();
          const startMs = nowMs();
          const startIso = nowIso();

          // Determine duration: look up exam config, fall back to 120 minutes
          let durationMinutes = 120;
          if (examConfigurationId) {
            const duration = sessionRepo.findConfigDuration(examConfigurationId);
            if (duration !== null && duration !== undefined) {
              durationMinutes = duration;
            }
          }

          const autoSubmitAt = computeAutoSubmitAt(startMs, durationMinutes);

          sessionRepo.create({
            id,
            userId: requireUser(req).id,
            examConfigurationId: examConfigurationId ?? null,
            certificationId: certificationId ?? null,
            sessionName: sessionName ?? null,
            questions: JSON.stringify(questions),
            totalQuestions: questions.length,
            isPracticeMode: isPracticeMode ? 1 : 0,
            autoSubmitAt,
            startTime: startIso,
          });

          // Record question history after successful session creation
          // Requirements: 1.1, 1.2, 1.4
          try {
            // Resolve certification ID from exam configuration if needed
            let resolvedCertificationId = certificationId;
            if (!resolvedCertificationId && examConfigurationId) {
              const config = sessionRepo.findConfig(examConfigurationId);
              resolvedCertificationId = config?.certificationId ?? null;
            }

            // Record history if we have a certification ID
            if (resolvedCertificationId) {
              questionHistoryService.recordQuestionsSeen(
                requireUser(req).id,
                resolvedCertificationId,
                questions,
              );
            }
          } catch (historyError) {
            // Log error but don't block session creation
            console.error('Failed to record question history:', historyError);
          }

          res.json({ id, examConfigurationId, questions, status: 'in_progress', autoSubmitAt });
        } catch (err) {
          next(err);
        }
      },
    );

    // POST /exam-sessions/:id/answers - Submit answer
    router.post(
      '/exam-sessions/:id/answers',
      authenticate,
      validate(submitAnswerSchema),
      (req: Request, res: Response, next: NextFunction) => {
        try {
          const session = sessionRepo.findById(req.params.id, requireUser(req).id);
          if (!session) return next(new NotFoundError('Session not found'));

          const {
            questionId,
            userAnswer,
            markedForReview,
            confidenceLevel,
            answerOrder,
            timeSpent,
          } = req.body;

          const id = answerRepo.upsert({
            examSessionId: req.params.id,
            questionId,
            userAnswer,
            markedForReview: !!markedForReview,
            confidenceLevel: confidenceLevel ?? null,
            answerOrder,
            timeSpent,
          });

          res.json({ id });
        } catch (err) {
          next(err);
        }
      },
    );

    // POST /exam-sessions/:id/submit - Submit exam
    router.post('/exam-sessions/:id/submit', authenticate, (req: Request, res: Response) => {
      const session = sessionRepo.findById(req.params.id, requireUser(req).id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status !== 'in_progress')
        return res.status(400).json({ error: 'Session already submitted' });

      const nowMs_ = nowMs();
      const endTime = nowIso();
      const answers = answerRepo.findBySession(req.params.id);
      const questions = questionRepo.findByIds(JSON.parse(session.questions));

      const passingScore = session.examConfigurationId
        ? (sessionRepo.findConfigPassingScore(session.examConfigurationId) ?? 0)
        : 0;

      const result = gradingService.grade(session, answers, questions, passingScore);

      // Persist isCorrect on each answer and trigger SRS updates
      for (const detail of result.detailedResults) {
        const answer = answers.find((a) => a.questionId === detail.questionId);
        if (answer) answerRepo.markCorrect(answer.id, detail.isCorrect);
        if (detail.userAnswer !== null)
          srsService.updateQuestionReview(
            requireUser(req).id,
            detail.questionId,
            detail.isCorrect ? 5 : 1,
          );
      }

      const timeTaken = Math.floor((nowMs_ - new Date(session.startTime).getTime()) / 1000);
      sessionRepo.complete(req.params.id, { ...result, endTime, timeTaken });
      userRepo.updateXp(requireUser(req).id, result.xpAwarded);

      res.json(result);
    });

    // POST /exam-sessions/:id/abandon - Abandon exam
    router.post('/exam-sessions/:id/abandon', authenticate, (req: Request, res: Response) => {
      const session = sessionRepo.findById(req.params.id, requireUser(req).id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status !== 'in_progress') return res.json({ ok: true });
      sessionRepo.abandon(req.params.id);
      res.json({ ok: true });
    });

    app = express();
    app.use(express.json());
    app.use('/api', router);
    app.use(errorHandler);

    // Generate test token
    userToken = jwt.sign(
      { id: testUserId, email: 'test@example.com', role: 'user' },
      testJwtSecret,
      { expiresIn: '1h' },
    );
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  /**
   * Test: Create session and verify history records created
   * Requirement: 1.1, 1.2
   */
  it('should create history records when exam session is created', async () => {
    const questionIds = [testQuestionIds[0], testQuestionIds[1], testQuestionIds[2]];

    // Create exam session
    const response = await request(app)
      .post('/api/exam-sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        certificationId: testCertificationId,
        sessionName: 'Test Session',
        questions: questionIds,
        isPracticeMode: false,
      })
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('in_progress');

    // Verify history records were created
    const historyRecords = testDb
      .prepare(
        `
        SELECT * FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .all(testUserId, testCertificationId) as Array<{
      id: string;
      userId: string;
      certificationId: string;
      questionId: string;
      seenAt: string;
    }>;

    expect(historyRecords).toHaveLength(3);

    const recordedQuestionIds = historyRecords.map((r) => r.questionId).sort();
    expect(recordedQuestionIds).toEqual(questionIds.sort());

    // Verify all records have correct userId and certificationId
    historyRecords.forEach((record) => {
      expect(record.userId).toBe(testUserId);
      expect(record.certificationId).toBe(testCertificationId);
      expect(record.seenAt).toBeTruthy();
    });
  });

  /**
   * Test: Complete session and verify history records persist
   * Requirement: 1.4
   */
  it('should persist history records when session is completed', async () => {
    const questionIds = [testQuestionIds[0], testQuestionIds[1]];

    // Create exam session
    const createResponse = await request(app)
      .post('/api/exam-sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        certificationId: testCertificationId,
        sessionName: 'Test Session',
        questions: questionIds,
        isPracticeMode: false,
      })
      .expect(200);

    const sessionId = createResponse.body.id;

    // Verify history records exist before completion
    const historyBeforeComplete = testDb
      .prepare(
        `
        SELECT COUNT(*) as count FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .get(testUserId, testCertificationId) as { count: number };

    expect(historyBeforeComplete.count).toBe(2);

    // Submit answers for the questions
    for (const questionId of questionIds) {
      await request(app)
        .post(`/api/exam-sessions/${sessionId}/answers`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          questionId,
          userAnswer: ['A'],
          markedForReview: false,
          confidenceLevel: 5,
          answerOrder: 1,
          timeSpent: 30,
        })
        .expect(200);
    }

    // Complete the session
    await request(app)
      .post(`/api/exam-sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // Verify history records still exist after completion
    const historyAfterComplete = testDb
      .prepare(
        `
        SELECT * FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .all(testUserId, testCertificationId) as Array<{
      questionId: string;
    }>;

    expect(historyAfterComplete).toHaveLength(2);

    const recordedQuestionIds = historyAfterComplete.map((r) => r.questionId).sort();
    expect(recordedQuestionIds).toEqual(questionIds.sort());

    // Verify session status is completed
    const session = testDb
      .prepare('SELECT status FROM exam_sessions WHERE id = ?')
      .get(sessionId) as { status: string };

    expect(session.status).toBe('completed');
  });

  /**
   * Test: Abandon session and verify history records persist
   * Requirement: 1.4
   */
  it('should persist history records when session is abandoned', async () => {
    const questionIds = [testQuestionIds[3], testQuestionIds[4]];

    // Create exam session
    const createResponse = await request(app)
      .post('/api/exam-sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        certificationId: testCertificationId,
        sessionName: 'Test Session',
        questions: questionIds,
        isPracticeMode: false,
      })
      .expect(200);

    const sessionId = createResponse.body.id;

    // Verify history records exist before abandoning
    const historyBeforeAbandon = testDb
      .prepare(
        `
        SELECT COUNT(*) as count FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .get(testUserId, testCertificationId) as { count: number };

    expect(historyBeforeAbandon.count).toBe(2);

    // Abandon the session
    await request(app)
      .post(`/api/exam-sessions/${sessionId}/abandon`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // Verify history records still exist after abandoning
    const historyAfterAbandon = testDb
      .prepare(
        `
        SELECT * FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .all(testUserId, testCertificationId) as Array<{
      questionId: string;
    }>;

    expect(historyAfterAbandon).toHaveLength(2);

    const recordedQuestionIds = historyAfterAbandon.map((r) => r.questionId).sort();
    expect(recordedQuestionIds).toEqual(questionIds.sort());

    // Verify session status is abandoned
    const session = testDb
      .prepare('SELECT status FROM exam_sessions WHERE id = ?')
      .get(sessionId) as { status: string };

    expect(session.status).toBe('abandoned');
  });

  /**
   * Test: Create session with exam configuration and verify history records
   * Requirement: 1.1, 1.2
   */
  it('should create history records when session uses exam configuration', async () => {
    // Create exam configuration
    const examConfigId = uuidv4();
    testDb
      .prepare(
        `
      INSERT INTO exam_configurations (id, certificationId, name, totalQuestions, duration, passingScore)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(examConfigId, testCertificationId, 'Test Exam Config', 3, 60, 70);

    const questionIds = [testQuestionIds[0], testQuestionIds[1], testQuestionIds[2]];

    // Create exam session with exam configuration
    const response = await request(app)
      .post('/api/exam-sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        examConfigurationId: examConfigId,
        questions: questionIds,
        isPracticeMode: false,
      })
      .expect(200);

    expect(response.body).toHaveProperty('id');

    // Verify history records were created with resolved certification ID
    const historyRecords = testDb
      .prepare(
        `
        SELECT * FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .all(testUserId, testCertificationId) as Array<{
      questionId: string;
    }>;

    expect(historyRecords).toHaveLength(3);

    const recordedQuestionIds = historyRecords.map((r) => r.questionId).sort();
    expect(recordedQuestionIds).toEqual(questionIds.sort());
  });

  /**
   * Test: History recording doesn't block session creation on error
   * Requirement: 1.1
   */
  it('should create session even if history recording fails', async () => {
    const questionIds = [testQuestionIds[0], testQuestionIds[1]];

    // Drop the question_history table to simulate failure
    testDb.exec('DROP TABLE question_history');

    // Create exam session - should still succeed
    const response = await request(app)
      .post('/api/exam-sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        certificationId: testCertificationId,
        sessionName: 'Test Session',
        questions: questionIds,
        isPracticeMode: false,
      })
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('in_progress');

    // Verify session was created
    const session = testDb
      .prepare('SELECT * FROM exam_sessions WHERE id = ?')
      .get(response.body.id);

    expect(session).toBeTruthy();
  });
});
