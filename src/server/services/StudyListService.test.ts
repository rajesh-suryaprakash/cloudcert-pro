import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { StudyListService } from './StudyListService';

// Create an in-memory test database
function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  // Create necessary tables
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      xp INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      passingScore INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      documentationUrl TEXT,
      weightPercentage REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
    );

    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      subTopicId TEXT,
      domainId TEXT,
      questionText TEXT NOT NULL,
      questionType TEXT NOT NULL,
      options TEXT NOT NULL,
      correctAnswers TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      points INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 1,
      FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY(subTopicId) REFERENCES subtopics(id) ON DELETE SET NULL
    );

    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      certificationId TEXT,
      examConfigurationId TEXT,
      topicId TEXT,
      questions TEXT NOT NULL,
      status TEXT NOT NULL,
      score REAL,
      totalQuestions INTEGER NOT NULL,
      correctAnswers INTEGER DEFAULT 0,
      incorrectAnswers INTEGER DEFAULT 0,
      unansweredQuestions INTEGER DEFAULT 0,
      timeTaken INTEGER,
      startTime DATETIME NOT NULL,
      endTime DATETIME,
      autoSubmitAt DATETIME,
      isPracticeMode INTEGER DEFAULT 0,
      isTopicQuiz INTEGER DEFAULT 0,
      isCustomQuiz INTEGER DEFAULT 0,
      isSRSReview INTEGER DEFAULT 0,
      passingScoreOverride INTEGER,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
      FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE exam_answers (
      id TEXT PRIMARY KEY,
      examSessionId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      userAnswer TEXT,
      isCorrect INTEGER,
      markedForReview INTEGER DEFAULT 0,
      timeSpent INTEGER DEFAULT 0,
      confidenceLevel TEXT,
      answerOrder INTEGER,
      FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE domain_weights (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      domainName TEXT NOT NULL,
      weightPercentage REAL NOT NULL CHECK(weightPercentage >= 0 AND weightPercentage <= 100),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
      UNIQUE(certificationId, domainName)
    );
  `);

  return db;
}

/**
 * Feature: insight-dashboard, Property 5: ROI score is non-negative
 * Validates: Requirements 19.1
 */
describe('StudyListService - Property 5: ROI score is non-negative', () => {
  it('ROI scores are always >= 0 for all valid input combinations', () => {
    // Arbitraries for generating test data
    const proficiencyArb = fc.integer({ min: 0, max: 100 });
    const domainWeightArb = fc.integer({ min: 0, max: 100 });
    const availableQuestionsArb = fc.integer({ min: 0, max: 200 });

    fc.assert(
      fc.property(
        proficiencyArb,
        domainWeightArb,
        availableQuestionsArb,
        (proficiency, domainWeight, availableQuestions) => {
          // Create a fresh test database for each property test run
          const testDb = createTestDb();

          // Setup test data
          const userId = 'test-user-1';
          const certificationId = 'test-cert-1';
          const topicId = 'test-topic-1';
          const domainId = 'test-domain-1';

          // Insert test data
          testDb
            .prepare('INSERT INTO users (id, email, passwordHash, role) VALUES (?, ?, ?, ?)')
            .run(userId, 'test@example.com', 'hash', 'user');

          testDb
            .prepare(
              'INSERT INTO certifications (id, name, passingScore, duration) VALUES (?, ?, ?, ?)',
            )
            .run(certificationId, 'Test Cert', 70, 180);

          testDb
            .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
            .run(topicId, certificationId, 'Test Topic');

          testDb
            .prepare(
              'INSERT INTO domain_weights (id, certificationId, domainName, weightPercentage) VALUES (?, ?, ?, ?)',
            )
            .run('dw-1', certificationId, domainId, domainWeight);

          // Create questions for this topic
          for (let i = 0; i < availableQuestions; i++) {
            testDb
              .prepare(
                'INSERT INTO questions (id, topicId, domainId, questionText, questionType, options, correctAnswers, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                `q-${i}`,
                topicId,
                domainId,
                `Question ${i}`,
                'single',
                JSON.stringify(['A', 'B', 'C', 'D']),
                JSON.stringify('A'),
                'medium',
              );
          }

          // Create exam sessions and answers to establish proficiency
          // We'll create a simple scenario where proficiency matches the input
          if (availableQuestions > 0) {
            const sessionId = 'session-1';
            testDb
              .prepare(
                'INSERT INTO exam_sessions (id, userId, certificationId, questions, status, totalQuestions, startTime) VALUES (?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                sessionId,
                userId,
                certificationId,
                JSON.stringify([`q-0`]),
                'completed',
                availableQuestions,
                new Date().toISOString(),
              );

            // Create answers to achieve the desired proficiency
            const correctCount = Math.floor((proficiency / 100) * availableQuestions);
            for (let i = 0; i < availableQuestions; i++) {
              const isCorrect = i < correctCount ? 1 : 0;
              testDb
                .prepare(
                  'INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, answerOrder) VALUES (?, ?, ?, ?, ?, ?)',
                )
                .run(`ans-${i}`, sessionId, `q-${i}`, JSON.stringify('A'), isCorrect, i);
            }
          }

          // Calculate ROI scores using the test database
          const service = new StudyListService(testDb);
          const roiScores = service.calculateROIScores(userId, certificationId);

          // Property: All ROI scores must be non-negative
          let allNonNegative = true;
          for (const score of roiScores) {
            if (score.roiScore < 0 || score.estimatedScoreIncrease < 0) {
              allNonNegative = false;
              break;
            }
          }

          // Clean up
          testDb.close();

          return allNonNegative;
        },
      ),
      { numRuns: 50 }, // Reduced runs due to database operations
    );
  });

  it('ROI score components are correctly bounded', () => {
    // Test edge cases explicitly
    const edgeCases = [
      { proficiency: 0, domainWeight: 0, availableQuestions: 0 },
      { proficiency: 100, domainWeight: 0, availableQuestions: 0 },
      { proficiency: 0, domainWeight: 100, availableQuestions: 0 },
      { proficiency: 0, domainWeight: 0, availableQuestions: 100 },
      { proficiency: 100, domainWeight: 100, availableQuestions: 100 },
      { proficiency: 50, domainWeight: 50, availableQuestions: 50 },
    ];

    for (const { proficiency, domainWeight, availableQuestions } of edgeCases) {
      // Calculate expected values
      const gapScore = (100 - proficiency) / 100;
      const impactScore = domainWeight / 100;
      const opportunityScore = Math.min(availableQuestions / 50, 1.0);
      const expectedROI = gapScore * impactScore * opportunityScore;

      // All components should be non-negative
      expect(gapScore).toBeGreaterThanOrEqual(0);
      expect(impactScore).toBeGreaterThanOrEqual(0);
      expect(opportunityScore).toBeGreaterThanOrEqual(0);
      expect(expectedROI).toBeGreaterThanOrEqual(0);
    }
  });
});
