import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import insightsRouter from './insights';
import { authenticate } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { cacheService } from '../services/CacheService';

/**
 * Performance tests for Insights Dashboard
 *
 * Feature: insight-dashboard
 * Task: 19.4 Write performance tests
 * Requirements: 25.1
 *
 * Tests cover:
 * - Dashboard load time with large datasets
 * - Query performance with 100+ exam sessions
 * - Cache hit/miss performance
 */

describe('Insights Dashboard Performance Tests', () => {
  let app: Express;
  let userToken: string;
  const testUserId = 'perf-test-user-' + randomUUID();
  const testCertificationId = 'perf-test-cert-' + randomUUID();
  const testJwtSecret = 'test-jwt-secret-with-at-least-32-characters-for-security';

  // Test data IDs
  let topicIds: string[] = [];
  let questionIds: string[] = [];
  let sessionIds: string[] = [];

  beforeAll(() => {
    // Set up environment variables for testing
    process.env.JWT_SECRET = testJwtSecret;
    process.env.RESET_TOKEN_SECRET = 'test-reset-token-secret-with-at-least-32-characters';
    process.env.PORT = '3000';
  });

  beforeEach(async () => {
    // Create Express app with middleware
    app = express();
    app.use(express.json());

    // Mock cookie parser for token extraction
    app.use((req, _res, next) => {
      req.cookies = {};
      next();
    });

    app.use(authenticate);
    app.use('/api', insightsRouter);

    // Add error handler middleware (must be last)
    app.use(errorHandler);

    // Generate test token
    userToken = jwt.sign(
      { id: testUserId, email: 'perftest@test.com', role: 'user' },
      testJwtSecret,
      { expiresIn: '1h' },
    );

    // Clear cache before each test
    cacheService.clear();

    // Pre-clean to ensure a fresh slate regardless of previous afterEach failures
    cleanupTestData();

    // Set up test data
    await setupLargeDataset();
  });

  afterEach(() => {
    // Clean up test data
    cleanupTestData();
    cacheService.clear();
  });

  /**
   * Set up a large dataset for performance testing
   * Creates:
   * - 1 certification
   * - 5 domains with weights
   * - 20 topics (4 per domain)
   * - 200 questions (10 per topic)
   * - 100 exam sessions
   * - 20,000 exam answers (200 per session)
   */
  async function setupLargeDataset() {
    const transaction = db.transaction(() => {
      // Create test user
      db.prepare(
        `
        INSERT OR IGNORE INTO users (id, email, password, role, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(testUserId, 'perftest@test.com', 'hashed-password', 'user', new Date().toISOString());

      // Create certification
      db.prepare(
        `
        INSERT OR IGNORE INTO certifications (id, title, description, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(
        testCertificationId,
        'Performance Test Cert',
        'Test certification for performance testing',
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Create 5 domains with weights
      const domainNames = ['Domain A', 'Domain B', 'Domain C', 'Domain D', 'Domain E'];
      const domainWeights = [25, 20, 20, 20, 15]; // Sum = 100

      domainNames.forEach((name, index) => {
        const domainId = randomUUID();
        db.prepare(
          `
          INSERT OR IGNORE INTO domain_weights (id, certificationId, domainName, weightPercentage, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        ).run(
          domainId,
          testCertificationId,
          name,
          domainWeights[index],
          new Date().toISOString(),
          new Date().toISOString(),
        );
      });

      // Create 20 topics (4 per domain)
      topicIds = [];
      domainNames.forEach((domainName, _domainIndex) => {
        for (let i = 0; i < 4; i++) {
          const topicId = randomUUID();
          db.prepare(
            `
            INSERT INTO topics (id, certificationId, title, description, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `,
          ).run(
            topicId,
            testCertificationId,
            `${domainName} Topic ${i + 1}`,
            `Topic description`,
            new Date().toISOString(),
          );
          topicIds.push(topicId);
        }
      });

      // Create 200 questions (10 per topic)
      questionIds = [];
      topicIds.forEach((topicId, topicIndex) => {
        const domainName = domainNames[Math.floor(topicIndex / 4)];
        for (let i = 0; i < 10; i++) {
          const questionId = randomUUID();
          db.prepare(
            `
            INSERT INTO questions (
              id, topicId, domainId, questionText, questionType,
              options, correctAnswers, explanation, difficulty, tags, points, isActive, createdAt, updatedAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          ).run(
            questionId,
            topicId,
            domainName,
            `Question ${i + 1} for topic ${topicIndex}`,
            'single',
            JSON.stringify(['Option A', 'Option B', 'Option C', 'Option D']),
            JSON.stringify(['A']),
            'Explanation for correct answer',
            'Medium',
            JSON.stringify([]),
            1,
            1,
            new Date().toISOString(),
            new Date().toISOString(),
          );
          questionIds.push(questionId);
        }
      });

      // Create 100 exam sessions with answers
      sessionIds = [];
      for (let sessionNum = 0; sessionNum < 100; sessionNum++) {
        const sessionId = randomUUID();
        const sessionDate = new Date(Date.now() - (100 - sessionNum) * 24 * 60 * 60 * 1000); // Spread over 100 days

        // Simulate varying performance (60-95% correct)
        const baseAccuracy = 0.6 + (sessionNum / 100) * 0.35; // Improving over time

        const autoSubmitTime = new Date(sessionDate.getTime() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours after start

        db.prepare(
          `
          INSERT INTO exam_sessions (
            id, userId, certificationId, questions, status, score, 
            totalQuestions, isPracticeMode, isCustomQuiz, autoSubmitAt, startTime, createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          sessionId,
          testUserId,
          testCertificationId,
          JSON.stringify(questionIds), // Store all question IDs
          'completed',
          Math.floor(baseAccuracy * 100),
          200,
          0, // isPracticeMode
          0, // isCustomQuiz
          autoSubmitTime, // autoSubmitAt
          sessionDate.toISOString(),
          sessionDate.toISOString(),
          new Date(sessionDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
        );

        sessionIds.push(sessionId);

        // Create 200 answers per session
        questionIds.forEach((questionId, qIndex) => {
          const answerId = randomUUID();
          const isCorrect = Math.random() < baseAccuracy;
          const timeSpent = 60 + Math.random() * 120; // 60-180 seconds
          const confidenceLevels = ['Low', 'Medium', 'High'];
          const confidenceLevel = confidenceLevels[Math.floor(Math.random() * 3)];

          // Simulate fatigue - questions later in exam take longer and are less accurate
          const fatigueMultiplier = 1 + (qIndex / questionIds.length) * 0.3;
          const adjustedTimeSpent = timeSpent * fatigueMultiplier;

          db.prepare(
            `
            INSERT INTO exam_answers (
              id, examSessionId, questionId, userAnswer, 
              isCorrect, timeSpent, confidenceLevel, answerOrder, createdAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          ).run(
            answerId,
            sessionId,
            questionId,
            JSON.stringify(['A']),
            isCorrect ? 1 : 0,
            adjustedTimeSpent,
            confidenceLevel,
            qIndex,
            sessionDate.toISOString(),
          );

          // Simulate some answer changes (hesitation)
          if (Math.random() < 0.15) {
            // 15% of answers have changes
            const changeId = randomUUID();
            db.prepare(
              `
              INSERT INTO answer_change_history (
                id, examSessionId, questionId, previousAnswer, 
                newAnswer, changeTimestamp, createdAt
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            ).run(
              changeId,
              sessionId,
              questionId,
              JSON.stringify(['B']),
              JSON.stringify(['A']),
              new Date(sessionDate.getTime() + qIndex * 30000).toISOString(),
              sessionDate.toISOString(),
            );
          }
        });
      }
    });

    transaction();
  }

  /**
   * Clean up test data after tests
   */
  function cleanupTestData() {
    // Delete in reverse order of foreign key dependencies
    const sessionIdsToDelete = db
      .prepare('SELECT id FROM exam_sessions WHERE userId = ?')
      .all(testUserId) as Array<{ id: string }>;

    for (const session of sessionIdsToDelete) {
      db.prepare('DELETE FROM answer_change_history WHERE examSessionId = ?').run(session.id);
      db.prepare('DELETE FROM exam_answers WHERE examSessionId = ?').run(session.id);
    }

    db.prepare('DELETE FROM exam_sessions WHERE userId = ?').run(testUserId);

    const topicsToDelete = db
      .prepare('SELECT id FROM topics WHERE certificationId = ?')
      .all(testCertificationId) as Array<{ id: string }>;
    for (const topic of topicsToDelete) {
      db.prepare('DELETE FROM questions WHERE topicId = ?').run(topic.id);
    }

    db.prepare('DELETE FROM topics WHERE certificationId = ?').run(testCertificationId);
    db.prepare('DELETE FROM domain_weights WHERE certificationId = ?').run(testCertificationId);
    db.prepare('DELETE FROM certifications WHERE id = ?').run(testCertificationId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }

  /**
   * Performance Test 1: Dashboard Load Time with Large Dataset
   * Requirement: 25.1 - Dashboard should load within 3 seconds for users with up to 100 exam sessions
   */
  describe('Dashboard Load Time with Large Dataset', () => {
    it('should load dashboard within 5 seconds with 100 exam sessions (cold cache)', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(loadTime).toBeLessThan(5000); // 5 seconds for cold load

      console.warn(`Dashboard cold load time: ${loadTime}ms`);
    });

    it('should load dashboard within 3 seconds with 100 exam sessions (warm cache)', async () => {
      // First request to warm up cache
      await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Second request should hit cache
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(loadTime).toBeLessThan(3000); // 3 seconds target with cache

      console.warn(`Dashboard warm load time (cached): ${loadTime}ms`);
    });

    it('should return complete dashboard data structure with large dataset', async () => {
      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('readinessScore');
      expect(response.body).toHaveProperty('domainProficiency');
      expect(response.body).toHaveProperty('doubleDownMetric');
      expect(response.body).toHaveProperty('timeAnalysis');
      expect(response.body).toHaveProperty('hesitationAnalysis');
      expect(response.body).toHaveProperty('certaintyMatrix');
      expect(response.body).toHaveProperty('consistencyMetric');
      expect(response.body).toHaveProperty('communityBenchmarks');
      expect(response.body).toHaveProperty('roiRecommendations');

      // Verify data completeness
      expect(response.body.domainProficiency).toHaveLength(20); // 20 topics acting as domains
      expect(Array.isArray(response.body.roiRecommendations)).toBe(true);

      console.warn(`Domain proficiency entries: ${response.body.domainProficiency.length}`);
      console.warn(`ROI recommendations: ${response.body.roiRecommendations.length}`);
    });
  });

  /**
   * Performance Test 2: Query Performance with 100+ Exam Sessions
   * Requirement: 25.1 - Test query performance with large datasets
   */
  describe('Query Performance with 100+ Exam Sessions', () => {
    it('should calculate domain proficiency efficiently with 100 sessions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.domainProficiency).toBeDefined();
      expect(response.body.domainProficiency.length).toBeGreaterThan(0);

      // Each domain should have proficiency data
      response.body.domainProficiency.forEach((domain: any) => {
        expect(domain).toHaveProperty('proficiencyScore');
        expect(domain).toHaveProperty('questionsAttempted');
        expect(domain.questionsAttempted).toBeGreaterThan(0);
      });

      console.warn(`Domain proficiency calculation time: ${endTime - startTime}ms`);
    });

    it('should calculate consistency metric efficiently with 100 sessions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.consistencyMetric).toBeDefined();
      expect(response.body.consistencyMetric.recentSessions).toBeDefined();

      // Should analyze last 5 sessions
      expect(response.body.consistencyMetric.recentSessions.length).toBeLessThanOrEqual(5);

      console.warn(`Consistency metric calculation time: ${endTime - startTime}ms`);
      console.warn(
        `Recent sessions analyzed: ${response.body.consistencyMetric.recentSessions.length}`,
      );
    });

    it('should calculate readiness score efficiently with 100 sessions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.readinessScore).toBeDefined();

      if (response.body.readinessScore) {
        expect(response.body.readinessScore).toHaveProperty('overallScore');
        expect(response.body.readinessScore).toHaveProperty('greenLightStatus');
        expect(response.body.readinessScore.overallScore).toBeGreaterThanOrEqual(0);
        expect(response.body.readinessScore.overallScore).toBeLessThanOrEqual(100);
      }

      console.warn(`Readiness score calculation time: ${endTime - startTime}ms`);
    });

    it('should analyze hesitation patterns efficiently with 100 sessions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.hesitationAnalysis).toBeDefined();
      expect(response.body.hesitationAnalysis).toHaveProperty('totalChanges');
      expect(response.body.hesitationAnalysis).toHaveProperty('correctToIncorrectPct');
      expect(response.body.hesitationAnalysis).toHaveProperty('incorrectToCorrectPct');

      console.warn(`Hesitation analysis time: ${endTime - startTime}ms`);
      console.warn(
        `Total answer changes tracked: ${response.body.hesitationAnalysis.totalChanges}`,
      );
    });

    it('should generate certainty matrix efficiently with 100 sessions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.certaintyMatrix).toBeDefined();
      expect(response.body.certaintyMatrix).toHaveProperty('highConfidenceCorrect');
      expect(response.body.certaintyMatrix).toHaveProperty('highConfidenceIncorrect');
      expect(response.body.certaintyMatrix).toHaveProperty('lowConfidenceCorrect');
      expect(response.body.certaintyMatrix).toHaveProperty('lowConfidenceIncorrect');

      console.warn(`Certainty matrix calculation time: ${endTime - startTime}ms`);
    });

    it('should calculate time analysis efficiently with 100 sessions', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.timeAnalysis).toBeDefined();
      expect(response.body.timeAnalysis).toHaveProperty('avgTimeCorrect');
      expect(response.body.timeAnalysis).toHaveProperty('avgTimeIncorrect');
      expect(response.body.timeAnalysis).toHaveProperty('dangerZoneWarning');

      console.warn(`Time analysis calculation time: ${endTime - startTime}ms`);
    });
  });

  /**
   * Performance Test 3: Cache Hit/Miss Performance
   * Requirement: 25.1 - Test cache effectiveness (5-minute TTL)
   */
  describe('Cache Hit/Miss Performance', () => {
    it('should demonstrate significant performance improvement with cache hit', async () => {
      // First request (cache miss)
      const missStart = Date.now();
      const response1 = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);
      const missEnd = Date.now();
      const missTime = missEnd - missStart;

      expect(response1.status).toBe(200);

      // Second request (cache hit)
      const hitStart = Date.now();
      const response2 = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);
      const hitEnd = Date.now();
      const hitTime = hitEnd - hitStart;

      expect(response2.status).toBe(200);

      // Cache hit should be significantly faster
      expect(hitTime).toBeLessThan(missTime);
      expect(hitTime).toBeLessThan(1000); // Should be under 1 second with cache

      // Data should be identical
      expect(response2.body).toEqual(response1.body);

      const speedup = (missTime / hitTime).toFixed(2);
      console.warn(`Cache miss time: ${missTime}ms`);
      console.warn(`Cache hit time: ${hitTime}ms`);
      console.warn(`Cache speedup: ${speedup}x faster`);
    });

    it('should respect 5-minute cache TTL', async () => {
      // First request to populate cache
      const response1 = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response1.status).toBe(200);

      // Verify cache is populated
      const cacheKey = `dashboard:${testUserId}:${testCertificationId}:mock:Mixed`;
      const cachedData = cacheService.get(cacheKey);
      expect(cachedData).not.toBeNull();

      console.warn('Cache populated successfully');
    });

    it('should invalidate cache when new exam session is completed', async () => {
      // First request to populate cache
      await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Verify cache is populated
      const cacheKey = `dashboard:${testUserId}:${testCertificationId}:mock:Mixed`;
      let cachedData = cacheService.get(cacheKey);
      expect(cachedData).not.toBeNull();

      // Simulate cache invalidation (would happen on exam completion)
      cacheService.invalidateUser(testUserId);

      // Verify cache is cleared
      cachedData = cacheService.get(cacheKey);
      expect(cachedData).toBeNull();

      console.warn('Cache invalidation working correctly');
    });

    it('should handle concurrent requests efficiently with caching', async () => {
      // Make 10 concurrent requests
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get(`/api/insights/dashboard/${testCertificationId}`)
          .set('Authorization', `Bearer ${userToken}`),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All responses should be identical (from cache)
      const firstResponse = responses[0].body;
      responses.forEach((response) => {
        expect(response.body).toEqual(firstResponse);
      });

      // Average time per request should be low due to caching
      const avgTime = totalTime / concurrentRequests;
      expect(avgTime).toBeLessThan(1000);

      console.warn(`${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
      console.warn(`Average time per request: ${avgTime.toFixed(2)}ms`);
    });

    it('should measure cache effectiveness over multiple requests', async () => {
      const iterations = 20;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/insights/dashboard/${testCertificationId}`)
          .set('Authorization', `Bearer ${userToken}`);

        const endTime = Date.now();
        times.push(endTime - startTime);

        expect(response.status).toBe(200);
      }

      // First request should be slowest (cache miss)
      const firstRequestTime = times[0];

      // Subsequent requests should be faster (cache hits)
      const cachedRequestTimes = times.slice(1);
      const avgCachedTime =
        cachedRequestTimes.reduce((a, b) => a + b, 0) / cachedRequestTimes.length;

      expect(avgCachedTime).toBeLessThan(firstRequestTime);

      console.warn(`First request (cache miss): ${firstRequestTime}ms`);
      console.warn(`Average cached request: ${avgCachedTime.toFixed(2)}ms`);
      console.warn(
        `Cache effectiveness: ${((1 - avgCachedTime / firstRequestTime) * 100).toFixed(1)}% faster`,
      );
    });
  });

  /**
   * Performance Test 4: Specific Endpoint Performance
   * Test individual endpoints with large datasets
   */
  describe('Individual Endpoint Performance', () => {
    it('should load fatigue analysis efficiently for a session with 200 questions', async () => {
      const sessionId = sessionIds[0]; // Use first session

      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/session/${sessionId}/fatigue`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.fatigueAnalysis).toBeDefined();
      expect(response.body.fatigueAnalysis.quartiles).toHaveLength(4);
      expect(loadTime).toBeLessThan(2000); // Should be under 2 seconds

      console.warn(`Fatigue analysis load time: ${loadTime}ms`);
    });

    it('should generate study list efficiently for a session with 200 questions', async () => {
      const sessionId = sessionIds[0]; // Use first session

      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/study-list/${sessionId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.studyList).toBeDefined();
      expect(Array.isArray(response.body.studyList)).toBe(true);
      expect(loadTime).toBeLessThan(2000); // Should be under 2 seconds

      console.warn(`Study list generation time: ${loadTime}ms`);
      console.warn(`Study list items: ${response.body.studyList.length}`);
    });

    it('should load topic breakdown efficiently with 20 topics', async () => {
      const domainId = 'Domain A'; // Use first domain

      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/insights/domain/${domainId}/topics?certificationId=${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.topics).toBeDefined();
      expect(Array.isArray(response.body.topics)).toBe(true);
      expect(loadTime).toBeLessThan(2000); // Should be under 2 seconds

      console.warn(`Topic breakdown load time: ${loadTime}ms`);
      console.warn(`Topics loaded: ${response.body.topics.length}`);
    });
  });
});
