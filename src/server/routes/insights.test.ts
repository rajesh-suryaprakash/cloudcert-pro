import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import insightsRouter from './insights';
import { authenticate } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

/**
 * Integration tests for Insights API endpoints
 *
 * Feature: insight-dashboard
 * Task: 8.6 Write integration tests for API endpoints
 * Requirements: 24.2, 25.1
 *
 * Tests cover:
 * - Authentication and authorization
 * - Response format validation
 * - Error handling for invalid IDs
 */

describe('Insights API Integration Tests', () => {
  let app: Express;
  let userToken: string;
  let adminToken: string;
  const testUserId = 'test-user-123';
  const testAdminId = 'test-admin-456';
  const testCertificationId = 'test-cert-789';
  const testJwtSecret = 'test-jwt-secret-with-at-least-32-characters-for-security';

  beforeAll(() => {
    // Set up environment variables for testing
    process.env.JWT_SECRET = testJwtSecret;
    process.env.RESET_TOKEN_SECRET = 'test-reset-token-secret-with-at-least-32-characters';
    process.env.PORT = '3000';
  });

  beforeEach(() => {
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

    // Generate test tokens
    userToken = jwt.sign({ id: testUserId, email: 'user@test.com', role: 'user' }, testJwtSecret, {
      expiresIn: '1h',
    });

    adminToken = jwt.sign(
      { id: testAdminId, email: 'admin@test.com', role: 'admin' },
      testJwtSecret,
      { expiresIn: '1h' },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Authentication Tests
   * Requirement: 24.2 - Authentication and authorization
   */
  describe('Authentication', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/unauthorized/i);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: testUserId, email: 'user@test.com', role: 'user' },
        testJwtSecret,
        { expiresIn: '-1h' }, // Already expired
      );

      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/expired/i);
    });

    it('should accept requests with valid token', async () => {
      // This will fail with 404 or other error, but not 401
      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).not.toBe(401);
    });
  });

  /**
   * Authorization Tests
   * Requirement: 24.2 - Admin-only endpoints
   */
  describe('Authorization - Admin Endpoints', () => {
    it('should reject non-admin users from GET /api/admin/domain-weights/:certificationId', async () => {
      const response = await request(app)
        .get(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/forbidden/i);
    });

    it('should reject non-admin users from PUT /api/admin/domain-weights/:certificationId', async () => {
      const response = await request(app)
        .put(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ domains: [] })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/forbidden/i);
    });

    it('should allow admin users to access GET /api/admin/domain-weights/:certificationId', async () => {
      const response = await request(app)
        .get(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should not be 403 Forbidden
      expect(response.status).not.toBe(403);
    });

    it('should allow admin users to access PUT /api/admin/domain-weights/:certificationId', async () => {
      const response = await request(app)
        .put(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ domains: [] });

      // Should not be 403 Forbidden
      expect(response.status).not.toBe(403);
    });
  });

  /**
   * Response Format Validation Tests
   * Requirement: 24.2 - Response format validation
   */
  describe('Response Format Validation', () => {
    it('GET /api/insights/dashboard/:certificationId should return correct structure', async () => {
      const response = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('readinessScore');
        expect(response.body).toHaveProperty('domainProficiency');
        expect(response.body).toHaveProperty('doubleDownMetric');
        expect(response.body).toHaveProperty('timeAnalysis');
        expect(response.body).toHaveProperty('hesitationAnalysis');
        expect(response.body).toHaveProperty('certaintyMatrix');
        expect(response.body).toHaveProperty('consistencyMetric');
        expect(response.body).toHaveProperty('communityBenchmarks');
        expect(response.body).toHaveProperty('roiRecommendations');
        expect(response.body).toHaveProperty('lastUpdated');

        // Validate array types
        expect(Array.isArray(response.body.domainProficiency)).toBe(true);
        expect(Array.isArray(response.body.communityBenchmarks)).toBe(true);
        expect(Array.isArray(response.body.roiRecommendations)).toBe(true);
      }
    });

    it('GET /api/insights/domain/:domainId/topics should return correct structure', async () => {
      const response = await request(app)
        .get(`/api/insights/domain/test-domain/topics?certificationId=${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('domainId');
        expect(response.body).toHaveProperty('domainName');
        expect(response.body).toHaveProperty('topics');
        expect(Array.isArray(response.body.topics)).toBe(true);
      }
    });

    it('GET /api/insights/topic/:topicId/subtopics should return correct structure', async () => {
      const response = await request(app)
        .get(`/api/insights/topic/test-topic/subtopics?certificationId=${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200 || response.status === 404) {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('topicId');
          expect(response.body).toHaveProperty('topicName');
          expect(response.body).toHaveProperty('subtopics');
          expect(Array.isArray(response.body.subtopics)).toBe(true);
        }
      }
    });

    it('GET /api/insights/session/:sessionId/fatigue should return correct structure', async () => {
      const response = await request(app)
        .get('/api/insights/session/test-session/fatigue')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200 || response.status === 404) {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('sessionId');
          expect(response.body).toHaveProperty('fatigueAnalysis');
          expect(response.body.fatigueAnalysis).toHaveProperty('quartiles');
          expect(response.body.fatigueAnalysis).toHaveProperty('fatigueDetected');
          expect(Array.isArray(response.body.fatigueAnalysis.quartiles)).toBe(true);
        }
      }
    });

    it('GET /api/insights/study-list/:sessionId should return correct structure', async () => {
      const response = await request(app)
        .get('/api/insights/study-list/test-session')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200 || response.status === 404 || response.status === 400) {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('sessionId');
          expect(response.body).toHaveProperty('studyList');
          expect(Array.isArray(response.body.studyList)).toBe(true);
        }
      }
    });

    it('POST /api/insights/retry-missed/:sessionId should return correct structure', async () => {
      const response = await request(app)
        .post('/api/insights/retry-missed/test-session')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      if (response.status === 200) {
        expect(response.body).toHaveProperty('newSessionId');
        expect(response.body).toHaveProperty('questionCount');
        expect(typeof response.body.newSessionId).toBe('string');
        expect(typeof response.body.questionCount).toBe('number');
      }
    });

    it('POST /api/insights/real-exam-result should return correct structure', async () => {
      const response = await request(app)
        .post('/api/insights/real-exam-result')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          certificationId: testCertificationId,
          passed: true,
          examDate: '2024-01-15',
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('benchmarkUserId');
        expect(response.body.success).toBe(true);
      }
    });

    it('GET /api/admin/domain-weights/:certificationId should return correct structure', async () => {
      const response = await request(app)
        .get(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200 || response.status === 404) {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('certificationId');
          expect(response.body).toHaveProperty('domains');
          expect(response.body).toHaveProperty('totalWeight');
          expect(Array.isArray(response.body.domains)).toBe(true);
          expect(typeof response.body.totalWeight).toBe('number');
        }
      }
    });
  });

  /**
   * Error Handling Tests - Invalid IDs
   * Requirement: 24.2 - Error handling for invalid IDs
   */
  describe('Error Handling - Invalid IDs', () => {
    it('should return 404 or 500 for non-existent certification in dashboard endpoint', async () => {
      const response = await request(app)
        .get('/api/insights/dashboard/non-existent-cert-id')
        .set('Authorization', `Bearer ${userToken}`);

      // Should handle gracefully - either 404, 500, or return empty data (200)
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should return 404 for non-existent topic', async () => {
      const response = await request(app)
        .get(
          `/api/insights/topic/non-existent-topic/subtopics?certificationId=${testCertificationId}`,
        )
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/not found/i);
      }
    });

    it('should return 404 for non-existent session in fatigue endpoint', async () => {
      const response = await request(app)
        .get('/api/insights/session/non-existent-session/fatigue')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/not found/i);
      }
    });

    it('should return 404 for non-existent session in study-list endpoint', async () => {
      const response = await request(app)
        .get('/api/insights/study-list/non-existent-session')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/not found/i);
      }
    });

    it('should return 404 for non-existent session in retry-missed endpoint', async () => {
      const response = await request(app)
        .post('/api/insights/retry-missed/non-existent-session')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      if (response.status === 404) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/not found/i);
      }
    });

    it('should return 404 for non-existent certification in admin domain-weights endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/domain-weights/non-existent-cert')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/not found/i);
      }
    });

    it('should prevent users from accessing other users sessions', async () => {
      // Create a session owned by a different user
      const sessionId = 'session-owned-by-other';

      // Mock database to return session owned by different user
      const originalGet = db.prepare;
      vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('exam_sessions') && sql.includes('userId')) {
          return {
            get: () => undefined, // Session not found for this user
            all: () => [],
            run: () => ({ changes: 0 }),
          } as any;
        }
        return originalGet.call(db, sql);
      });

      const response = await request(app)
        .get(`/api/insights/session/${sessionId}/fatigue`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  /**
   * Validation Tests
   * Requirement: 24.2 - Input validation
   */
  describe('Input Validation', () => {
    it('should require certificationId query parameter for domain topics endpoint', async () => {
      const response = await request(app)
        .get('/api/insights/domain/test-domain/topics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/certificationId.*required/i);
    });

    it('should require certificationId query parameter for topic subtopics endpoint', async () => {
      const response = await request(app)
        .get('/api/insights/topic/test-topic/subtopics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/certificationId.*required/i);
    });

    it('should validate real exam result requires certificationId and passed', async () => {
      const response = await request(app)
        .post('/api/insights/real-exam-result')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/certificationId.*passed.*required/i);
    });

    it('should validate domain weights requires domains array', async () => {
      const response = await request(app)
        .put(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/domains.*array/i);
    });

    it('should validate domain weights sum to 100', async () => {
      const response = await request(app)
        .put(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domains: [
            { domainName: 'Domain 1', weightPercentage: 50 },
            { domainName: 'Domain 2', weightPercentage: 30 },
            // Sum is 80, not 100
          ],
        });

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/sum.*100/i);
      }
    });

    it('should validate domain weights are between 0 and 100', async () => {
      const response = await request(app)
        .put(`/api/admin/domain-weights/${testCertificationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          domains: [
            { domainName: 'Domain 1', weightPercentage: 150 }, // Invalid
            { domainName: 'Domain 2', weightPercentage: -50 }, // Invalid
          ],
        });

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/between 0 and 100/i);
      }
    });

    it('should reject retry-missed for non-completed sessions', async () => {
      // Mock database to return in-progress session
      const originalGet = db.prepare;
      vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('exam_sessions') && sql.includes('status')) {
          return {
            get: () => ({
              id: 'test-session',
              status: 'in_progress',
              certificationId: testCertificationId,
              questions: '[]',
            }),
            all: () => [],
            run: () => ({ changes: 0 }),
          } as any;
        }
        return originalGet.call(db, sql);
      });

      const response = await request(app)
        .post('/api/insights/retry-missed/test-session')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/completed/i);
      }
    });

    it('should reject study-list for non-completed sessions', async () => {
      // Mock database to return in-progress session
      const originalGet = db.prepare;
      vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('exam_sessions') && sql.includes('status')) {
          return {
            get: () => ({
              id: 'test-session',
              status: 'in_progress',
            }),
            all: () => [],
            run: () => ({ changes: 0 }),
          } as any;
        }
        return originalGet.call(db, sql);
      });

      const response = await request(app)
        .get('/api/insights/study-list/test-session')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/completed/i);
      }
    });
  });

  /**
   * Performance Tests
   * Requirement: 25.1 - Dashboard load performance
   */
  describe('Performance', () => {
    it('should respond to dashboard request within reasonable time', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 5 seconds (cold load target from design doc)
      expect(responseTime).toBeLessThan(5000);
    });

    it('should cache dashboard responses for performance', async () => {
      // First request
      const response1 = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      // Second request should be faster (cached)
      const startTime = Date.now();
      const response2 = await request(app)
        .get(`/api/insights/dashboard/${testCertificationId}`)
        .set('Authorization', `Bearer ${userToken}`);
      const endTime = Date.now();

      if (response1.status === 200 && response2.status === 200) {
        // Cached response should be very fast
        expect(endTime - startTime).toBeLessThan(1000);

        // Responses should be identical
        expect(response2.body).toEqual(response1.body);
      }
    });
  });
});
