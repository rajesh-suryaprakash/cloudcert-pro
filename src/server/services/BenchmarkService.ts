import { db } from '../db/connection';
import type { CommunityBenchmark, FilterOptions } from '../types/insights';
import { v4 as uuidv4 } from 'uuid';

export class BenchmarkService {
  /**
   * Helper method to build SQL WHERE clause for filter options
   */
  private buildFilterClause(filterOptions: FilterOptions = {}): {
    clause: string;
    params: string[];
  } {
    const conditions: string[] = [];
    const params: string[] = [];

    // Filter by exam type (mock vs practice)
    if (filterOptions.examType) {
      if (filterOptions.examType === 'mock') {
        conditions.push('es.isPracticeMode = 0');
      } else if (filterOptions.examType === 'practice') {
        conditions.push('es.isPracticeMode = 1');
      }
    }

    // Filter by difficulty
    if (filterOptions.difficulty && filterOptions.difficulty !== 'all') {
      // Difficulty is stored in sessionName, so we need to check if it contains the difficulty level
      conditions.push('es.sessionName LIKE ?');
      params.push(`%${filterOptions.difficulty}%`);
    }

    return {
      clause: conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '',
      params,
    };
  }

  /**
   * Retrieves aggregated community benchmark data for a certification
   * Uses pre-computed community_benchmark_cache table for performance
   */
  getCommunityAverages(
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): CommunityBenchmark[] {
    const benchmarks: CommunityBenchmark[] = [];

    // If filters are applied, calculate benchmarks on-the-fly instead of using cache
    const hasFilters = filterOptions.examType || filterOptions.difficulty;

    if (hasFilters) {
      // Calculate filtered benchmarks on-the-fly
      return this.calculateFilteredBenchmarks(certificationId, filterOptions);
    }

    // Get domain-level benchmarks from cache
    const domainBenchmarks = db
      .prepare(
        `
      SELECT 
        domainName,
        averageProficiency,
        sampleSize
      FROM community_benchmark_cache
      WHERE certificationId = ? AND domainName IS NOT NULL AND topicId IS NULL
      ORDER BY domainName
    `,
      )
      .all(certificationId) as Array<{
      domainName: string;
      averageProficiency: number;
      sampleSize: number;
    }>;

    for (const benchmark of domainBenchmarks) {
      benchmarks.push({
        domainId: benchmark.domainName,
        name: benchmark.domainName,
        communityAverage: benchmark.averageProficiency,
        userScore: 0, // Will be populated by caller
        difference: 0, // Will be calculated by caller
        needsImprovement: false, // Will be determined by caller
        typicalPassingThreshold: 70, // Default threshold
      });
    }

    // Get topic-level benchmarks from cache
    const topicBenchmarks = db
      .prepare(
        `
      SELECT 
        cbc.topicId,
        t.title as topicName,
        cbc.averageProficiency,
        cbc.sampleSize
      FROM community_benchmark_cache cbc
      JOIN topics t ON cbc.topicId = t.id
      WHERE cbc.certificationId = ? AND cbc.topicId IS NOT NULL
      ORDER BY t.title
    `,
      )
      .all(certificationId) as Array<{
      topicId: string;
      topicName: string;
      averageProficiency: number;
      sampleSize: number;
    }>;

    for (const benchmark of topicBenchmarks) {
      benchmarks.push({
        topicId: benchmark.topicId,
        name: benchmark.topicName,
        communityAverage: benchmark.averageProficiency,
        userScore: 0, // Will be populated by caller
        difference: 0, // Will be calculated by caller
        needsImprovement: false, // Will be determined by caller
        typicalPassingThreshold: 70, // Default threshold
      });
    }

    return benchmarks;
  }

  /**
   * Calculate benchmarks with filters applied (not using cache)
   */
  private calculateFilteredBenchmarks(
    certificationId: string,
    filterOptions: FilterOptions,
  ): CommunityBenchmark[] {
    const benchmarks: CommunityBenchmark[] = [];
    const { clause: filterClause, params: filterParams } = this.buildFilterClause(filterOptions);

    // Get all users who passed the real exam for this certification
    const benchmarkUserIds = db
      .prepare(
        `
      SELECT userId 
      FROM benchmark_users 
      WHERE certificationId = ? AND passed = 1
    `,
      )
      .all(certificationId)
      .map((row: { userId: string }) => row.userId);

    if (benchmarkUserIds.length === 0) {
      return benchmarks;
    }

    // Create placeholders for SQL IN clause
    const placeholders = benchmarkUserIds.map(() => '?').join(',');

    // Aggregate domain-level proficiency with filters
    const domainAggregates = db
      .prepare(
        `
      SELECT 
        q.domainId as domainName,
        AVG(CASE WHEN ea.isCorrect = 1 THEN 100.0 ELSE 0.0 END) as avgProficiency,
        COUNT(DISTINCT es.userId) as sampleSize
      FROM exam_sessions es
      JOIN exam_answers ea ON ea.examSessionId = es.id
      JOIN questions q ON q.id = ea.questionId
      WHERE es.certificationId = ?
        AND es.userId IN (${placeholders})
        AND es.status = 'completed'
        AND q.domainId IS NOT NULL
        ${filterClause}
      GROUP BY q.domainId
    `,
      )
      .all(certificationId, ...benchmarkUserIds, ...filterParams) as Array<{
      domainName: string;
      avgProficiency: number;
      sampleSize: number;
    }>;

    for (const aggregate of domainAggregates) {
      benchmarks.push({
        domainId: aggregate.domainName,
        name: aggregate.domainName,
        communityAverage: aggregate.avgProficiency,
        userScore: 0,
        difference: 0,
        needsImprovement: false,
        typicalPassingThreshold: 70,
      });
    }

    // Aggregate topic-level proficiency with filters
    const topicAggregates = db
      .prepare(
        `
      SELECT 
        q.topicId,
        t.title as topicName,
        AVG(CASE WHEN ea.isCorrect = 1 THEN 100.0 ELSE 0.0 END) as avgProficiency,
        COUNT(DISTINCT es.userId) as sampleSize
      FROM exam_sessions es
      JOIN exam_answers ea ON ea.examSessionId = es.id
      JOIN questions q ON q.id = ea.questionId
      JOIN topics t ON q.topicId = t.id
      WHERE es.certificationId = ?
        AND es.userId IN (${placeholders})
        AND es.status = 'completed'
        AND q.topicId IS NOT NULL
        ${filterClause}
      GROUP BY q.topicId, t.title
    `,
      )
      .all(certificationId, ...benchmarkUserIds, ...filterParams) as Array<{
      topicId: string;
      topicName: string;
      avgProficiency: number;
      sampleSize: number;
    }>;

    for (const aggregate of topicAggregates) {
      benchmarks.push({
        topicId: aggregate.topicId,
        name: aggregate.topicName,
        communityAverage: aggregate.avgProficiency,
        userScore: 0,
        difference: 0,
        needsImprovement: false,
        typicalPassingThreshold: 70,
      });
    }

    return benchmarks;
  }

  /**
   * Calculates user's percentile ranking compared to all users for a certification
   * Returns percentile (0-100) where 100 = top performer
   */
  calculatePercentileRank(userId: string, certificationId: string): number {
    // Get user's average score across all sessions
    const userAvgResult = db
      .prepare(
        `
      SELECT AVG(
        CAST(
          (SELECT COUNT(*) FROM exam_answers WHERE examSessionId = es.id AND isCorrect = 1) AS REAL
        ) / 
        CAST(
          (SELECT COUNT(*) FROM exam_answers WHERE examSessionId = es.id) AS REAL
        ) * 100
      ) as avgScore
      FROM exam_sessions es
      WHERE es.userId = ? 
        AND es.certificationId = ?
        AND es.status = 'completed'
        AND (SELECT COUNT(*) FROM exam_answers WHERE examSessionId = es.id) > 0
    `,
      )
      .get(userId, certificationId) as { avgScore: number | null };

    if (!userAvgResult || userAvgResult.avgScore === null) {
      return 0;
    }

    const userAvgScore = userAvgResult.avgScore;

    // Count how many users have lower average scores
    const rankResult = db
      .prepare(
        `
      WITH user_averages AS (
        SELECT 
          es.userId,
          AVG(
            CAST(
              (SELECT COUNT(*) FROM exam_answers WHERE examSessionId = es.id AND isCorrect = 1) AS REAL
            ) / 
            CAST(
              (SELECT COUNT(*) FROM exam_answers WHERE examSessionId = es.id) AS REAL
            ) * 100
          ) as avgScore
        FROM exam_sessions es
        WHERE es.certificationId = ?
          AND es.status = 'completed'
          AND (SELECT COUNT(*) FROM exam_answers WHERE examSessionId = es.id) > 0
        GROUP BY es.userId
      )
      SELECT 
        COUNT(*) as totalUsers,
        SUM(CASE WHEN avgScore < ? THEN 1 ELSE 0 END) as usersBelow
      FROM user_averages
    `,
      )
      .get(certificationId, userAvgScore) as {
      totalUsers: number;
      usersBelow: number;
    };

    if (rankResult.totalUsers === 0) {
      return 0;
    }

    // Calculate percentile
    const percentile = (rankResult.usersBelow / rankResult.totalUsers) * 100;
    return Math.round(percentile);
  }

  /**
   * Records a user's real exam result to flag them as a benchmark user
   * This data is used to calculate community averages
   */
  recordRealExamResult(
    userId: string,
    certificationId: string,
    passed: boolean,
    examDate?: string,
  ): string {
    const id = uuidv4();
    const reportedAt = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO benchmark_users (id, userId, certificationId, passed, examDate, reportedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId, certificationId) 
      DO UPDATE SET 
        passed = excluded.passed,
        examDate = excluded.examDate,
        reportedAt = excluded.reportedAt
    `,
    ).run(id, userId, certificationId, passed ? 1 : 0, examDate || null, reportedAt);

    return id;
  }

  /**
   * Refreshes community benchmark aggregations for a certification
   * Should be called when new benchmark users are added or periodically
   */
  refreshBenchmarkAggregations(certificationId: string): void {
    // Get all users who passed the real exam for this certification
    const benchmarkUserIds = db
      .prepare(
        `
      SELECT userId 
      FROM benchmark_users 
      WHERE certificationId = ? AND passed = 1
    `,
      )
      .all(certificationId)
      .map((row: { userId: string }) => row.userId);

    if (benchmarkUserIds.length === 0) {
      // No benchmark data available yet
      return;
    }

    // Delete existing benchmarks for this certification
    db.prepare('DELETE FROM community_benchmark_cache WHERE certificationId = ?').run(
      certificationId,
    );

    // Create placeholders for SQL IN clause
    const placeholders = benchmarkUserIds.map(() => '?').join(',');

    // Aggregate domain-level proficiency
    const domainAggregates = db
      .prepare(
        `
      SELECT 
        q.domainId as domainName,
        AVG(CASE WHEN ea.isCorrect = 1 THEN 100.0 ELSE 0.0 END) as avgProficiency,
        COUNT(DISTINCT es.userId) as sampleSize
      FROM exam_sessions es
      JOIN exam_answers ea ON ea.examSessionId = es.id
      JOIN questions q ON q.id = ea.questionId
      WHERE es.certificationId = ?
        AND es.userId IN (${placeholders})
        AND es.status = 'completed'
        AND q.domainId IS NOT NULL
      GROUP BY q.domainId
    `,
      )
      .all(certificationId, ...benchmarkUserIds) as Array<{
      domainName: string;
      avgProficiency: number;
      sampleSize: number;
    }>;

    // Insert domain benchmarks
    const insertDomainStmt = db.prepare(`
      INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize, lastUpdated)
      VALUES (?, ?, ?, NULL, ?, ?, ?)
    `);

    for (const aggregate of domainAggregates) {
      const id = uuidv4();
      const lastUpdated = new Date().toISOString();
      insertDomainStmt.run(
        id,
        certificationId,
        aggregate.domainName,
        aggregate.avgProficiency,
        aggregate.sampleSize,
        lastUpdated,
      );
    }

    // Aggregate topic-level proficiency
    const topicAggregates = db
      .prepare(
        `
      SELECT 
        q.topicId,
        AVG(CASE WHEN ea.isCorrect = 1 THEN 100.0 ELSE 0.0 END) as avgProficiency,
        COUNT(DISTINCT es.userId) as sampleSize
      FROM exam_sessions es
      JOIN exam_answers ea ON ea.examSessionId = es.id
      JOIN questions q ON q.id = ea.questionId
      WHERE es.certificationId = ?
        AND es.userId IN (${placeholders})
        AND es.status = 'completed'
        AND q.topicId IS NOT NULL
      GROUP BY q.topicId
    `,
      )
      .all(certificationId, ...benchmarkUserIds) as Array<{
      topicId: string;
      avgProficiency: number;
      sampleSize: number;
    }>;

    // Insert topic benchmarks
    const insertTopicStmt = db.prepare(`
      INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize, lastUpdated)
      VALUES (?, ?, NULL, ?, ?, ?, ?)
    `);

    for (const aggregate of topicAggregates) {
      const id = uuidv4();
      const lastUpdated = new Date().toISOString();
      insertTopicStmt.run(
        id,
        certificationId,
        aggregate.topicId,
        aggregate.avgProficiency,
        aggregate.sampleSize,
        lastUpdated,
      );
    }
  }
}
