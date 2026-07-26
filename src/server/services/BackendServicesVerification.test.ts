/**
 * Backend Services Verification Test
 *
 * This test suite verifies that all backend services for the Insight Dashboard
 * are working correctly with sample data. It tests:
 * - AnalyticsService (proficiency, readiness, time analysis, hesitation, fatigue, certainty, consistency)
 * - BenchmarkService (community averages, percentile rank, real exam results, aggregations)
 * - StudyListService (study list generation, ROI calculation, recommendations)
 * - CacheService (TTL-based caching, invalidation)
 *
 * Task: 7. Checkpoint - Verify backend services
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/connection';
import { AnalyticsService } from './AnalyticsService';
import { BenchmarkService } from './BenchmarkService';
import { StudyListService } from './StudyListService';
import { CacheService } from './CacheService';

describe('Backend Services Verification', () => {
  let analyticsService: AnalyticsService;
  let benchmarkService: BenchmarkService;
  let studyListService: StudyListService;
  let cacheService: CacheService;

  // Test data IDs - will be populated from actual database
  let userId: string;
  let certificationId: string;
  let sessionId: string;

  beforeAll(() => {
    // Initialize services
    analyticsService = new AnalyticsService();
    benchmarkService = new BenchmarkService();
    studyListService = new StudyListService(db);
    cacheService = new CacheService(300);

    // Seed minimal data required by analytics and benchmark services
    userId = 'user-123';
    certificationId = 'cert-123';
    sessionId = 'session-123';

    // Insert user
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password, name, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'test@example.com', 'hash', 'Test User', 'user', '2026-06-28T07:00:00Z');

    // Insert certification
    db.prepare(`
      INSERT OR IGNORE INTO certifications (id, title, description, level, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(certificationId, 'AWS Certified Solutions Architect', 'AWS CSA', 'Associate', '2026-06-28T07:00:00Z', '2026-06-28T07:00:00Z');

    // Insert topic
    db.prepare(`
      INSERT OR IGNORE INTO topics (id, certificationId, title, orderIndex, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('topic-123', certificationId, 'Design Resilient Architectures', 1, 1, '2026-06-28T07:00:00Z');

    // Insert subtopic
    db.prepare(`
      INSERT OR IGNORE INTO subtopics (id, topicId, title, description, orderIndex, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('subtopic-123', 'topic-123', 'Design resilient storage', 'Storage options', 1, '2026-06-28T07:00:00Z');

    // Insert question
    db.prepare(`
      INSERT OR IGNORE INTO questions (id, topicId, subTopicId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('q-123', 'topic-123', 'subtopic-123', 'Which storage option is most resilient?', 'single', '["S3", "EBS"]', '["S3"]', 'Medium', '[]', 1, 1, '2026-06-28T07:00:00Z', '2026-06-28T07:00:00Z');

    // Insert exam session
    db.prepare(`
      INSERT OR IGNORE INTO exam_sessions (id, userId, certificationId, questions, status, score, totalQuestions, correctAnswers, incorrectAnswers, unansweredQuestions, startTime, autoSubmitAt, isPracticeMode, isTopicQuiz, isCustomQuiz, isSRSReview, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, certificationId, '["q-123"]', 'completed', 100, 1, 1, 0, 0, '2026-06-28T07:00:00Z', '2026-06-28T09:00:00Z', 1, 0, 0, 0, '2026-06-28T07:00:00Z', '2026-06-28T07:00:00Z');

    // Insert exam answer
    db.prepare(`
      INSERT OR IGNORE INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect, timeSpent, confidenceLevel, answerOrder, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('ans-123', sessionId, 'q-123', '["S3"]', 1, 45, 'High', 0, '2026-06-28T07:00:00Z');
  });

  beforeEach(() => {
    cacheService = new CacheService(300);
  });

  describe('AnalyticsService', () => {
    it('should calculate domain proficiency correctly', () => {
      const proficiency = analyticsService.calculateDomainProficiency(userId, certificationId);

      expect(proficiency).toBeDefined();
      expect(Array.isArray(proficiency)).toBe(true);

      // Verify proficiency scores are within bounds
      proficiency.forEach((domain) => {
        expect(domain.proficiencyScore).toBeGreaterThanOrEqual(0);
        expect(domain.proficiencyScore).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate topic proficiency correctly', () => {
      const proficiency = analyticsService.calculateTopicProficiency(userId, certificationId);

      expect(proficiency).toBeDefined();
      expect(Array.isArray(proficiency)).toBe(true);

      proficiency.forEach((topic) => {
        expect(topic.proficiencyScore).toBeGreaterThanOrEqual(0);
        expect(topic.proficiencyScore).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate subtopic proficiency with insufficient data flag', () => {
      const proficiency = analyticsService.calculateSubtopicProficiency(userId, certificationId);

      expect(proficiency).toBeDefined();
      expect(Array.isArray(proficiency)).toBe(true);

      // Verify hasInsufficientData flag is set correctly
      proficiency.forEach((subtopic) => {
        if (subtopic.questionsAttempted < 3) {
          expect(subtopic.hasInsufficientData).toBe(true);
        } else {
          expect(subtopic.hasInsufficientData).toBe(false);
        }
      });
    });

    it('should analyze time per question correctly', () => {
      const timeAnalysis = analyticsService.analyzeTimePerQuestion(userId, certificationId);

      expect(timeAnalysis).toBeDefined();
      expect(timeAnalysis.avgTimeCorrect).toBeGreaterThanOrEqual(0);
      expect(timeAnalysis.avgTimeIncorrect).toBeGreaterThanOrEqual(0);
      expect(typeof timeAnalysis.dangerZoneWarning).toBe('boolean');
      expect(typeof timeAnalysis.pacingAlert).toBe('boolean');
    });

    it('should analyze hesitation patterns correctly', () => {
      const hesitation = analyticsService.analyzeHesitationPatterns(userId, certificationId);

      expect(hesitation).toBeDefined();
      expect(hesitation.totalChanges).toBeGreaterThanOrEqual(0);
      expect(hesitation.correctToIncorrectPct).toBeGreaterThanOrEqual(0);
      expect(hesitation.correctToIncorrectPct).toBeLessThanOrEqual(100);
      expect(hesitation.incorrectToCorrectPct).toBeGreaterThanOrEqual(0);
      expect(hesitation.incorrectToCorrectPct).toBeLessThanOrEqual(100);
      expect(typeof hesitation.confidenceWarning).toBe('boolean');
    });

    it('should calculate fatigue factor correctly', () => {
      if (!sessionId) {
        console.warn('Skipping fatigue test - no completed sessions found');
        return;
      }

      const fatigue = analyticsService.calculateFatigueFactor(sessionId);

      expect(fatigue).toBeDefined();
      expect(Array.isArray(fatigue.quartiles)).toBe(true);
      expect(typeof fatigue.fatigueDetected).toBe('boolean');

      // Verify quartile data if available
      if (fatigue.quartiles.length > 0) {
        fatigue.quartiles.forEach((quartile, index) => {
          expect(quartile.quartile).toBe(index + 1);
          expect(quartile.accuracyPct).toBeGreaterThanOrEqual(0);
          expect(quartile.accuracyPct).toBeLessThanOrEqual(100);
        });
      }
    });

    it('should generate certainty matrix correctly', () => {
      const matrix = analyticsService.generateCertaintyMatrix(userId, certificationId);

      expect(matrix).toBeDefined();
      expect(matrix.highConfidenceCorrect).toBeDefined();
      expect(matrix.highConfidenceIncorrect).toBeDefined();
      expect(matrix.lowConfidenceCorrect).toBeDefined();
      expect(matrix.lowConfidenceIncorrect).toBeDefined();

      // Verify all quadrants have count and percentage
      const quadrants = [
        matrix.highConfidenceCorrect,
        matrix.highConfidenceIncorrect,
        matrix.lowConfidenceCorrect,
        matrix.lowConfidenceIncorrect,
      ];

      quadrants.forEach((quadrant) => {
        expect(quadrant.count).toBeGreaterThanOrEqual(0);
        expect(quadrant.percentage).toBeGreaterThanOrEqual(0);
        expect(quadrant.percentage).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate consistency metric correctly', () => {
      const consistency = analyticsService.calculateConsistencyMetric(userId, certificationId);

      expect(consistency).toBeDefined();
      expect(Array.isArray(consistency.recentSessions)).toBe(true);
      expect(consistency.standardDeviation).toBeGreaterThanOrEqual(0);
      expect(typeof consistency.hasHighVariance).toBe('boolean');
      expect(typeof consistency.insufficientData).toBe('boolean');

      // Verify session data
      consistency.recentSessions.forEach((session) => {
        expect(session.sessionId).toBeDefined();
        expect(session.date).toBeDefined();
        expect(session.score).toBeGreaterThanOrEqual(0);
        expect(session.score).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate readiness score correctly', () => {
      const readiness = analyticsService.calculateReadinessScore(userId, certificationId);

      // May be null if insufficient sessions
      if (readiness) {
        expect(readiness.overallScore).toBeGreaterThanOrEqual(0);
        expect(readiness.overallScore).toBeLessThanOrEqual(100);
        expect(Array.isArray(readiness.domainScores)).toBe(true);
        expect(readiness.consistencyScore).toBeGreaterThanOrEqual(0);
        expect(readiness.pacingScore).toBeGreaterThanOrEqual(0);
        expect(['improving', 'stable', 'declining']).toContain(readiness.recentTrend);
        expect(['green', 'yellow', 'red']).toContain(readiness.greenLightStatus);
        expect(Array.isArray(readiness.criteriaForGreen)).toBe(true);
      } else {
        console.warn('Readiness score is null - insufficient sessions');
      }
    });

    it('should identify double-down metric correctly', () => {
      const doubleDown = analyticsService.identifyDoubleDownMetric(userId, certificationId);

      if (doubleDown) {
        expect(doubleDown.domainId).toBeDefined();
        expect(doubleDown.domainName).toBeDefined();
        expect(doubleDown.proficiencyScore).toBeGreaterThanOrEqual(0);
        expect(doubleDown.proficiencyScore).toBeLessThanOrEqual(100);
        expect(doubleDown.domainWeight).toBeGreaterThanOrEqual(0);
        expect(doubleDown.priorityScore).toBeGreaterThanOrEqual(0);
      } else {
        console.warn('No double-down metric found - no domain data');
      }
    });
  });

  describe('BenchmarkService', () => {
    it('should record real exam result correctly', () => {
      const benchmarkId = benchmarkService.recordRealExamResult(
        userId,
        certificationId,
        true,
        '2024-01-15',
      );

      expect(benchmarkId).toBeDefined();
      expect(typeof benchmarkId).toBe('string');

      // Verify record was inserted
      const record = db
        .prepare('SELECT * FROM benchmark_users WHERE userId = ? AND certificationId = ?')
        .get(userId, certificationId);

      expect(record).toBeDefined();
    });

    it('should refresh benchmark aggregations correctly', () => {
      // Refresh aggregations
      benchmarkService.refreshBenchmarkAggregations(certificationId);

      // Verify aggregations were created or updated
      const aggregates = db
        .prepare('SELECT * FROM community_benchmark_cache WHERE certificationId = ?')
        .all(certificationId);

      expect(Array.isArray(aggregates)).toBe(true);
      // May be empty if no benchmark data, but should not throw
    });

    it('should get community averages correctly', () => {
      const averages = benchmarkService.getCommunityAverages(certificationId);

      expect(Array.isArray(averages)).toBe(true);

      averages.forEach((avg) => {
        expect(avg.name).toBeDefined();
        expect(avg.communityAverage).toBeGreaterThanOrEqual(0);
        expect(avg.communityAverage).toBeLessThanOrEqual(100);
        expect(avg.typicalPassingThreshold).toBeDefined();
      });
    });

    it('should calculate percentile rank correctly', () => {
      const percentile = benchmarkService.calculatePercentileRank(userId, certificationId);

      expect(percentile).toBeGreaterThanOrEqual(0);
      expect(percentile).toBeLessThanOrEqual(100);
    });
  });

  describe('StudyListService', () => {
    it('should generate study list correctly', () => {
      if (!sessionId) {
        console.warn('Skipping study list test - no completed sessions found');
        return;
      }

      const studyList = studyListService.generateStudyList(sessionId);

      expect(Array.isArray(studyList)).toBe(true);

      studyList.forEach((item) => {
        expect(item.topicId).toBeDefined();
        expect(item.topicName).toBeDefined();
        expect(Array.isArray(item.subtopics)).toBe(true);
        expect(item.incorrectCount).toBeGreaterThan(0);
        expect(item.priority).toBeGreaterThan(0);
      });
    });

    it('should calculate ROI scores correctly', () => {
      const roiScores = studyListService.calculateROIScores(userId, certificationId);

      expect(Array.isArray(roiScores)).toBe(true);

      roiScores.forEach((score) => {
        expect(score.topicId).toBeDefined();
        expect(score.topicName).toBeDefined();
        expect(score.currentProficiency).toBeGreaterThanOrEqual(0);
        expect(score.currentProficiency).toBeLessThanOrEqual(100);
        expect(score.roiScore).toBeGreaterThanOrEqual(0);
        expect(score.estimatedScoreIncrease).toBeGreaterThanOrEqual(0);
      });
    });

    it('should get top recommendations correctly', () => {
      const recommendations = studyListService.getTopRecommendations(userId, certificationId, 5);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);

      // Verify recommendations are sorted by ROI score descending
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].roiScore).toBeGreaterThanOrEqual(recommendations[i].roiScore);
      }
    });
  });

  describe('CacheService', () => {
    it('should store and retrieve values correctly', () => {
      const key = 'test:key';
      const value = { data: 'test data' };

      cacheService.set(key, value, 60);
      const retrieved = cacheService.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should expire values after TTL', async () => {
      const key = 'test:expiring';
      const value = 'expires soon';

      cacheService.set(key, value, 1); // 1 second TTL

      // Should exist immediately
      expect(cacheService.get(key)).toBe(value);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(cacheService.get(key)).toBeNull();
    });

    it('should invalidate by pattern correctly', () => {
      cacheService.set('dashboard:user1:cert1', 'data1');
      cacheService.set('dashboard:user1:cert2', 'data2');
      cacheService.set('dashboard:user2:cert1', 'data3');

      cacheService.invalidate('dashboard:user1:*');

      expect(cacheService.get('dashboard:user1:cert1')).toBeNull();
      expect(cacheService.get('dashboard:user1:cert2')).toBeNull();
      expect(cacheService.get('dashboard:user2:cert1')).toBe('data3');
    });

    it('should invalidate user cache correctly', () => {
      cacheService.set('dashboard:user123:cert1', 'data1');
      cacheService.set('metrics:user123:domain1', 'data2');
      cacheService.set('dashboard:user456:cert1', 'data3');

      cacheService.invalidateUser('user123');

      expect(cacheService.get('dashboard:user123:cert1')).toBeNull();
      expect(cacheService.get('metrics:user123:domain1')).toBeNull();
      expect(cacheService.get('dashboard:user456:cert1')).toBe('data3');
    });

    it('should provide cache statistics', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      const stats = cacheService.getStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });
  });

  describe('Cache Invalidation on Exam Completion', () => {
    it('should invalidate cache when exam session completes', () => {
      const cacheKey = `dashboard:${userId}:${certificationId}`;

      // Set cache
      cacheService.set(cacheKey, { data: 'cached dashboard' });
      expect(cacheService.get(cacheKey)).toBeDefined();

      // Simulate exam completion - invalidate user cache
      cacheService.invalidateUser(userId);

      // Cache should be cleared
      expect(cacheService.get(cacheKey)).toBeNull();
    });
  });
});
