import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import {
  buildCustomQuizQuestions,
  filterWrongAnswersByTopic,
  validateCustomQuizForm,
} from './customQuizUtils';
import { ExamSessionRepository } from '../server/repositories/ExamSessionRepository';
import type { Question } from '../types';
import type { DetailedResult } from '../server/services/ExamGradingService';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: crypto.randomUUID(),
    topicId: crypto.randomUUID(),
    questionText: 'Q?',
    questionType: 'single',
    options: ['A', 'B'],
    correctAnswers: 'A',
    difficulty: 'Medium',
    tags: [],
    points: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      examConfigurationId TEXT,
      certificationId TEXT,
      topicId TEXT,
      sessionName TEXT,
      questions TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',
      score REAL,
      totalQuestions INTEGER NOT NULL,
      correctAnswers INTEGER DEFAULT 0,
      incorrectAnswers INTEGER DEFAULT 0,
      unansweredQuestions INTEGER DEFAULT 0,
      timeTaken INTEGER,
      startTime DATETIME,
      endTime DATETIME,
      autoSubmitAt DATETIME NOT NULL,
      isPracticeMode INTEGER DEFAULT 0,
      isTopicQuiz INTEGER DEFAULT 0,
      isCustomQuiz INTEGER DEFAULT 0,
      isSRSReview INTEGER DEFAULT 0,
      passingScoreOverride INTEGER,
      createdAt DATETIME,
      updatedAt DATETIME
    )
  `);
  return db;
}

// Feature: custom-quiz-builder, Property 5: Custom quiz question count respects pool size
describe('buildCustomQuizQuestions', () => {
  it('Property 5: result length equals min(count, active pool size)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }).chain((activeCount) =>
          fc.tuple(
            fc
              .integer({ min: 0, max: 10 })
              .map((inactiveCount) =>
                [
                  ...Array.from({ length: activeCount }, () => makeQuestion({ isActive: true })),
                  ...Array.from({ length: inactiveCount }, () => makeQuestion({ isActive: false })),
                ].sort(() => Math.random() - 0.5),
              ),
            fc.integer({ min: 1, max: 50 }),
            fc.constant(activeCount),
          ),
        ),
        ([pool, requestedCount, activeCount]) => {
          const result = buildCustomQuizQuestions(pool, requestedCount);
          const expectedCount = Math.min(requestedCount, activeCount);
          return result.length === expectedCount;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 5 (edge): all returned questions are active', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.boolean().map((isActive) => makeQuestion({ isActive })),
          { minLength: 0, maxLength: 20 },
        ),
        fc.integer({ min: 1, max: 30 }),
        (pool, count) => {
          const result = buildCustomQuizQuestions(pool, count);
          return result.every((q) => q.isActive);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: custom-quiz-builder, Property 6: Custom quiz sessions are created in practice mode
// Validates: Requirements 1.7, 1.8
describe('ExamSessionRepository — custom quiz session flags', () => {
  it('Property 6: sessions created with isPracticeMode=1 and isCustomQuiz=1 are persisted correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          questionCount: fc.integer({ min: 1, max: 20 }),
        }),
        ({ userId, questionCount }) => {
          const db = createTestDb();
          const repo = new ExamSessionRepository(db);
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          const questions = JSON.stringify(
            Array.from({ length: questionCount }, () => crypto.randomUUID()),
          );

          repo.create({
            id,
            userId,
            examConfigurationId: null,
            questions,
            totalQuestions: questionCount,
            isPracticeMode: 1,
            isCustomQuiz: 1,
            autoSubmitAt: now,
            startTime: now,
          });

          const found = repo.findById(id, userId);
          db.close();

          return found !== undefined && found.isPracticeMode === 1 && found.isCustomQuiz === 1;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: custom-quiz-builder, Property 1: Validation rejects out-of-range question counts
// Validates: Requirements 1.3
describe('validateCustomQuizForm', () => {
  it('Property 1: accepts integers in [1, 100] when a cert is selected', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.uuid(), (count, certId) => {
        return validateCustomQuizForm(certId, count) === null;
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1: rejects integers outside [1, 100]', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 101 })),
        fc.uuid(),
        (count, certId) => {
          return validateCustomQuizForm(certId, count) !== null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1: rejects non-integer numbers', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100, noNaN: true }).filter((n) => !Number.isInteger(n)),
        fc.uuid(),
        (count, certId) => {
          return validateCustomQuizForm(certId, count) !== null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1: rejects non-number inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        fc.uuid(),
        (count, certId) => {
          return validateCustomQuizForm(certId, count) !== null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1: rejects valid count when no cert is selected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')),
        (count, certId) => {
          return validateCustomQuizForm(certId, count) !== null;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: study-plan-enhancements, Property 2: Wrong-answer filter correctness
// Validates: Requirements 1.2
describe('filterWrongAnswersByTopic', () => {
  it('Property 2: returns exactly the answers matching topicId and isCorrect=false', () => {
    const detailedResultArb = fc.record({
      questionId: fc.uuid(),
      topicId: fc.oneof(fc.uuid(), fc.uuid(), fc.constant(null)),
      userAnswer: fc.oneof(fc.string(), fc.constant(null)),
      isCorrect: fc.boolean(),
      correctAnswers: fc.string(),
      explanation: fc.oneof(fc.string(), fc.constant(null)),
      confidenceLevel: fc.oneof(fc.string(), fc.constant(null)),
    }) as fc.Arbitrary<DetailedResult>;

    fc.assert(
      fc.property(
        fc.array(detailedResultArb, { minLength: 0, maxLength: 30 }),
        fc.uuid(),
        (answers, topicId) => {
          const result = filterWrongAnswersByTopic(answers, topicId);

          // Every returned answer must match topicId and be incorrect
          const allMatch = result.every((a) => a.topicId === topicId && a.isCorrect === false);

          // No matching answer should be missing from the result
          const expected = answers.filter((a) => a.topicId === topicId && a.isCorrect === false);
          const noneOmitted = expected.length === result.length;

          return allMatch && noneOmitted;
        },
      ),
      { numRuns: 100 },
    );
  });
});
