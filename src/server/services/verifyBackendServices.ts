/**
 * Backend Services Verification Script
 *
 * This script verifies that all backend services for the Insight Dashboard
 * are working correctly. It tests:
 * - AnalyticsService (proficiency, readiness, time analysis, hesitation, fatigue, certainty, consistency)
 * - BenchmarkService (community averages, percentile rank, real exam results, aggregations)
 * - StudyListService (study list generation, ROI calculation, recommendations)
 * - CacheService (TTL-based caching, invalidation)
 *
 * Task: 7. Checkpoint - Verify backend services
 *
 * Usage: npx tsx src/server/services/verifyBackendServices.ts
 */

import 'dotenv/config';
import { db } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { seedAdmin, seedLearner, seedAchievements } from '../db/seeds';
import { seedGcpCertifications } from '../db/seedCertifications';
import { AnalyticsService } from './AnalyticsService';
import { BenchmarkService } from './BenchmarkService';
import { StudyListService } from './StudyListService';
import { CacheService } from './CacheService';

interface VerificationResult {
  service: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  error?: string;
}

const results: VerificationResult[] = [];

function log(result: VerificationResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '○';
  console.warn(`${icon} [${result.service}] ${result.test}`);
  if (result.message) {
    console.warn(`  ${result.message}`);
  }
  if (result.error) {
    console.warn(`  Error: ${result.error}`);
  }
}

async function verifyAnalyticsService() {
  console.warn('\n=== AnalyticsService Verification ===\n');
  const service = new AnalyticsService();

  // Get a test user and certification from the database
  const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  const cert = db.prepare('SELECT id FROM certifications LIMIT 1').get() as
    | { id: string }
    | undefined;

  if (!user || !cert) {
    log({
      service: 'AnalyticsService',
      test: 'Prerequisites',
      status: 'SKIP',
      message: 'No users or certifications found in database. Skipping AnalyticsService tests.',
    });
    return;
  }

  const userId = user.id;
  const certificationId = cert.id;

  // Test 1: Domain Proficiency
  try {
    const proficiency = service.calculateDomainProficiency(userId, certificationId);
    const valid =
      Array.isArray(proficiency) &&
      proficiency.every((d) => d.proficiencyScore >= 0 && d.proficiencyScore <= 100);
    log({
      service: 'AnalyticsService',
      test: 'calculateDomainProficiency',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${proficiency.length} domains`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'calculateDomainProficiency',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2: Topic Proficiency
  try {
    const proficiency = service.calculateTopicProficiency(userId, certificationId);
    const valid =
      Array.isArray(proficiency) &&
      proficiency.every((t) => t.proficiencyScore >= 0 && t.proficiencyScore <= 100);
    log({
      service: 'AnalyticsService',
      test: 'calculateTopicProficiency',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${proficiency.length} topics`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'calculateTopicProficiency',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 3: Subtopic Proficiency
  try {
    const proficiency = service.calculateSubtopicProficiency(userId, certificationId);
    const valid =
      Array.isArray(proficiency) &&
      proficiency.every(
        (s) =>
          s.proficiencyScore >= 0 &&
          s.proficiencyScore <= 100 &&
          typeof s.hasInsufficientData === 'boolean',
      );
    log({
      service: 'AnalyticsService',
      test: 'calculateSubtopicProficiency',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${proficiency.length} subtopics`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'calculateSubtopicProficiency',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 4: Time Analysis
  try {
    const timeAnalysis = service.analyzeTimePerQuestion(userId, certificationId);
    const valid =
      timeAnalysis.avgTimeCorrect >= 0 &&
      timeAnalysis.avgTimeIncorrect >= 0 &&
      typeof timeAnalysis.dangerZoneWarning === 'boolean' &&
      typeof timeAnalysis.pacingAlert === 'boolean';
    log({
      service: 'AnalyticsService',
      test: 'analyzeTimePerQuestion',
      status: valid ? 'PASS' : 'FAIL',
      message: `Avg correct: ${timeAnalysis.avgTimeCorrect.toFixed(1)}s, Avg incorrect: ${timeAnalysis.avgTimeIncorrect.toFixed(1)}s`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'analyzeTimePerQuestion',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 5: Hesitation Analysis
  try {
    const hesitation = service.analyzeHesitationPatterns(userId, certificationId);
    const valid =
      hesitation.totalChanges >= 0 &&
      hesitation.correctToIncorrectPct >= 0 &&
      hesitation.correctToIncorrectPct <= 100 &&
      hesitation.incorrectToCorrectPct >= 0 &&
      hesitation.incorrectToCorrectPct <= 100 &&
      typeof hesitation.confidenceWarning === 'boolean';
    log({
      service: 'AnalyticsService',
      test: 'analyzeHesitationPatterns',
      status: valid ? 'PASS' : 'FAIL',
      message: `Total changes: ${hesitation.totalChanges}`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'analyzeHesitationPatterns',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 6: Fatigue Factor
  const session = db
    .prepare('SELECT id FROM exam_sessions WHERE status = ? LIMIT 1')
    .get('completed') as { id: string } | undefined;
  if (session) {
    try {
      const fatigue = service.calculateFatigueFactor(session.id);
      const valid =
        Array.isArray(fatigue.quartiles) && typeof fatigue.fatigueDetected === 'boolean';
      log({
        service: 'AnalyticsService',
        test: 'calculateFatigueFactor',
        status: valid ? 'PASS' : 'FAIL',
        message: `Fatigue detected: ${fatigue.fatigueDetected}, Quartiles: ${fatigue.quartiles.length}`,
      });
    } catch (error) {
      log({
        service: 'AnalyticsService',
        test: 'calculateFatigueFactor',
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    log({
      service: 'AnalyticsService',
      test: 'calculateFatigueFactor',
      status: 'SKIP',
      message: 'No completed exam sessions found',
    });
  }

  // Test 7: Certainty Matrix
  try {
    const matrix = service.generateCertaintyMatrix(userId, certificationId);
    const valid =
      matrix.highConfidenceCorrect &&
      matrix.highConfidenceIncorrect &&
      matrix.lowConfidenceCorrect &&
      matrix.lowConfidenceIncorrect;
    log({
      service: 'AnalyticsService',
      test: 'generateCertaintyMatrix',
      status: valid ? 'PASS' : 'FAIL',
      message: `Matrix generated with all quadrants`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'generateCertaintyMatrix',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 8: Consistency Metric
  try {
    const consistency = service.calculateConsistencyMetric(userId, certificationId);
    const valid =
      Array.isArray(consistency.recentSessions) &&
      consistency.standardDeviation >= 0 &&
      typeof consistency.hasHighVariance === 'boolean';
    log({
      service: 'AnalyticsService',
      test: 'calculateConsistencyMetric',
      status: valid ? 'PASS' : 'FAIL',
      message: `Sessions: ${consistency.recentSessions.length}, StdDev: ${consistency.standardDeviation.toFixed(2)}`,
    });
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'calculateConsistencyMetric',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 9: Readiness Score
  try {
    const readiness = service.calculateReadinessScore(userId, certificationId);
    if (readiness) {
      const valid =
        readiness.overallScore >= 0 &&
        readiness.overallScore <= 100 &&
        ['improving', 'stable', 'declining'].includes(readiness.recentTrend) &&
        ['green', 'yellow', 'red'].includes(readiness.greenLightStatus);
      log({
        service: 'AnalyticsService',
        test: 'calculateReadinessScore',
        status: valid ? 'PASS' : 'FAIL',
        message: `Score: ${readiness.overallScore.toFixed(1)}, Status: ${readiness.greenLightStatus}`,
      });
    } else {
      log({
        service: 'AnalyticsService',
        test: 'calculateReadinessScore',
        status: 'SKIP',
        message: 'Insufficient sessions for readiness score',
      });
    }
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'calculateReadinessScore',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 10: Double-Down Metric
  try {
    const doubleDown = service.identifyDoubleDownMetric(userId, certificationId);
    if (doubleDown) {
      const valid =
        doubleDown.domainId && doubleDown.proficiencyScore >= 0 && doubleDown.priorityScore >= 0;
      log({
        service: 'AnalyticsService',
        test: 'identifyDoubleDownMetric',
        status: valid ? 'PASS' : 'FAIL',
        message: `Domain: ${doubleDown.domainName}, Priority: ${doubleDown.priorityScore.toFixed(1)}`,
      });
    } else {
      log({
        service: 'AnalyticsService',
        test: 'identifyDoubleDownMetric',
        status: 'SKIP',
        message: 'No domain data available',
      });
    }
  } catch (error) {
    log({
      service: 'AnalyticsService',
      test: 'identifyDoubleDownMetric',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyBenchmarkService() {
  console.warn('\n=== BenchmarkService Verification ===\n');
  const service = new BenchmarkService();

  const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  const cert = db.prepare('SELECT id FROM certifications LIMIT 1').get() as
    | { id: string }
    | undefined;

  if (!user || !cert) {
    log({
      service: 'BenchmarkService',
      test: 'Prerequisites',
      status: 'SKIP',
      message: 'No users or certifications found in database.',
    });
    return;
  }

  const userId = user.id;
  const certificationId = cert.id;

  // Test 1: Record Real Exam Result
  try {
    const benchmarkId = service.recordRealExamResult(userId, certificationId, true, '2024-01-15');
    const valid = typeof benchmarkId === 'string' && benchmarkId.length > 0;
    log({
      service: 'BenchmarkService',
      test: 'recordRealExamResult',
      status: valid ? 'PASS' : 'FAIL',
      message: `Benchmark ID: ${benchmarkId}`,
    });
  } catch (error) {
    log({
      service: 'BenchmarkService',
      test: 'recordRealExamResult',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2: Refresh Benchmark Aggregations
  try {
    service.refreshBenchmarkAggregations(certificationId);
    log({
      service: 'BenchmarkService',
      test: 'refreshBenchmarkAggregations',
      status: 'PASS',
      message: 'Aggregations refreshed successfully',
    });
  } catch (error) {
    log({
      service: 'BenchmarkService',
      test: 'refreshBenchmarkAggregations',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 3: Get Community Averages
  try {
    const averages = service.getCommunityAverages(certificationId);
    const valid = Array.isArray(averages);
    log({
      service: 'BenchmarkService',
      test: 'getCommunityAverages',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${averages.length} averages`,
    });
  } catch (error) {
    log({
      service: 'BenchmarkService',
      test: 'getCommunityAverages',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 4: Calculate Percentile Rank
  try {
    const percentile = service.calculatePercentileRank(userId, certificationId);
    const valid = percentile >= 0 && percentile <= 100;
    log({
      service: 'BenchmarkService',
      test: 'calculatePercentileRank',
      status: valid ? 'PASS' : 'FAIL',
      message: `Percentile: ${percentile.toFixed(1)}`,
    });
  } catch (error) {
    log({
      service: 'BenchmarkService',
      test: 'calculatePercentileRank',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyStudyListService() {
  console.warn('\n=== StudyListService Verification ===\n');
  const service = new StudyListService(db);

  const session = db
    .prepare('SELECT id FROM exam_sessions WHERE status = ? LIMIT 1')
    .get('completed') as { id: string } | undefined;
  const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  const cert = db.prepare('SELECT id FROM certifications LIMIT 1').get() as
    | { id: string }
    | undefined;

  if (!session || !user || !cert) {
    log({
      service: 'StudyListService',
      test: 'Prerequisites',
      status: 'SKIP',
      message: 'No completed sessions, users, or certifications found.',
    });
    return;
  }

  const sessionId = session.id;
  const userId = user.id;
  const certificationId = cert.id;

  // Test 1: Generate Study List
  try {
    const studyList = service.generateStudyList(sessionId);
    const valid = Array.isArray(studyList);
    log({
      service: 'StudyListService',
      test: 'generateStudyList',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${studyList.length} study items`,
    });
  } catch (error) {
    log({
      service: 'StudyListService',
      test: 'generateStudyList',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2: Calculate ROI Scores
  try {
    const roiScores = service.calculateROIScores(userId, certificationId);
    const valid = Array.isArray(roiScores) && roiScores.every((s) => s.roiScore >= 0);
    log({
      service: 'StudyListService',
      test: 'calculateROIScores',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${roiScores.length} ROI scores`,
    });
  } catch (error) {
    log({
      service: 'StudyListService',
      test: 'calculateROIScores',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 3: Get Top Recommendations
  try {
    const recommendations = service.getTopRecommendations(userId, certificationId, 5);
    const valid = Array.isArray(recommendations) && recommendations.length <= 5;
    log({
      service: 'StudyListService',
      test: 'getTopRecommendations',
      status: valid ? 'PASS' : 'FAIL',
      message: `Returned ${recommendations.length} recommendations`,
    });
  } catch (error) {
    log({
      service: 'StudyListService',
      test: 'getTopRecommendations',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyCacheService() {
  console.warn('\n=== CacheService Verification ===\n');
  const service = new CacheService(300);

  // Test 1: Set and Get
  try {
    const key = 'test:key';
    const value = { data: 'test data' };
    service.set(key, value, 60);
    const retrieved = service.get(key);
    const valid = JSON.stringify(retrieved) === JSON.stringify(value);
    log({
      service: 'CacheService',
      test: 'set and get',
      status: valid ? 'PASS' : 'FAIL',
      message: 'Value stored and retrieved correctly',
    });
  } catch (error) {
    log({
      service: 'CacheService',
      test: 'set and get',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 2: TTL Expiration
  try {
    const key = 'test:expiring';
    const value = 'expires soon';
    service.set(key, value, 1);

    // Should exist immediately
    const immediate = service.get(key);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be expired
    const expired = service.get(key);
    const valid = immediate === value && expired === null;
    log({
      service: 'CacheService',
      test: 'TTL expiration',
      status: valid ? 'PASS' : 'FAIL',
      message: 'Cache expires correctly after TTL',
    });
  } catch (error) {
    log({
      service: 'CacheService',
      test: 'TTL expiration',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 3: Invalidate by Pattern
  try {
    service.set('dashboard:user1:cert1', 'data1');
    service.set('dashboard:user1:cert2', 'data2');
    service.set('dashboard:user2:cert1', 'data3');

    service.invalidate('dashboard:user1:*');

    const valid =
      service.get('dashboard:user1:cert1') === null &&
      service.get('dashboard:user1:cert2') === null &&
      service.get('dashboard:user2:cert1') === 'data3';
    log({
      service: 'CacheService',
      test: 'invalidate by pattern',
      status: valid ? 'PASS' : 'FAIL',
      message: 'Pattern-based invalidation works correctly',
    });
  } catch (error) {
    log({
      service: 'CacheService',
      test: 'invalidate by pattern',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test 4: Invalidate User
  try {
    service.set('dashboard:user123:cert1', 'data1');
    service.set('metrics:user123:domain1', 'data2');
    service.set('dashboard:user456:cert1', 'data3');

    service.invalidateUser('user123');

    const valid =
      service.get('dashboard:user123:cert1') === null &&
      service.get('metrics:user123:domain1') === null &&
      service.get('dashboard:user456:cert1') === 'data3';
    log({
      service: 'CacheService',
      test: 'invalidateUser',
      status: valid ? 'PASS' : 'FAIL',
      message: 'User-specific invalidation works correctly',
    });
  } catch (error) {
    log({
      service: 'CacheService',
      test: 'invalidateUser',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  console.warn('╔════════════════════════════════════════════════════════════╗');
  console.warn('║   Backend Services Verification - Insight Dashboard       ║');
  console.warn('╚════════════════════════════════════════════════════════════╝');

  // Ensure database is initialized
  console.warn('\nInitializing database...');
  runMigrations();
  console.warn('✓ Database migrations complete');

  // Seed basic data
  console.warn('\nSeeding database...');
  seedAdmin();
  seedLearner();
  seedAchievements();
  seedGcpCertifications();
  console.warn('✓ Database seeding complete\n');

  await verifyAnalyticsService();
  await verifyBenchmarkService();
  await verifyStudyListService();
  await verifyCacheService();

  // Summary
  console.warn('\n╔════════════════════════════════════════════════════════════╗');
  console.warn('║                      Summary                               ║');
  console.warn('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  console.warn(`Total Tests: ${total}`);
  console.warn(`✓ Passed: ${passed}`);
  console.warn(`✗ Failed: ${failed}`);
  console.warn(`○ Skipped: ${skipped}`);

  if (failed > 0) {
    console.warn('\n❌ Some tests failed. Please review the errors above.');
    process.exit(1);
  } else {
    console.warn('\n✅ All tests passed! Backend services are working correctly.');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error during verification:', error);
  process.exit(1);
});
