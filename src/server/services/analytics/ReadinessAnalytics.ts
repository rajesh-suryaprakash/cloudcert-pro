import type { Database } from 'better-sqlite3';
import type {
  ReadinessScore,
  CertaintyMatrix,
  DoubleDownMetric,
  FilterOptions,
  DomainProficiency,
  ConsistencyMetric,
} from '../../types/insights';
import { buildFilterClause } from './filterHelper';
import type { ProficiencyAnalytics } from './ProficiencyAnalytics';
import type { TimeAnalytics } from './TimeAnalytics';

export class ReadinessAnalytics {
  private db: Database;
  private proficiencyAnalytics: ProficiencyAnalytics;
  private timeAnalytics: TimeAnalytics;

  constructor(
    db: Database,
    proficiencyAnalytics: ProficiencyAnalytics,
    timeAnalytics: TimeAnalytics,
  ) {
    this.db = db;
    this.proficiencyAnalytics = proficiencyAnalytics;
    this.timeAnalytics = timeAnalytics;
  }

  /**
   * Calculate readiness score using weighted algorithm.
   * Returns null if fewer than 3 completed sessions.
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  calculateReadinessScore(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): ReadinessScore | null {
    const { clause: filterClause, params: filterParams } = buildFilterClause(filterOptions);

    // Check if user has at least 3 completed sessions
    const sessionCountQuery = `
      SELECT COUNT(*) as count
      FROM exam_sessions es
      WHERE es.userId = ?
        AND es.certificationId = ?
        AND es.status = 'completed'
        ${filterClause}
    `;

    const sessionCount = (
      this.db.prepare(sessionCountQuery).get(userId, certificationId, ...filterParams) as {
        count: number;
      }
    ).count;

    if (sessionCount < 3) {
      return null;
    }

    // Get domain proficiency scores
    const domainScores = this.proficiencyAnalytics.calculateDomainProficiency(
      userId,
      certificationId,
      filterOptions,
    );

    // Calculate WeightedDomainScore (60% weight)
    let weightedDomainScore = 0;
    let totalWeight = 0;

    for (const domain of domainScores) {
      weightedDomainScore += domain.proficiencyScore * domain.domainWeight;
      totalWeight += domain.domainWeight;
    }

    // Normalize if total weight is not 100
    if (totalWeight > 0) {
      weightedDomainScore = weightedDomainScore / totalWeight;
    }

    // Calculate ConsistencyScore (20% weight)
    const consistencyMetric = this.timeAnalytics.calculateConsistencyMetric(
      userId,
      certificationId,
      filterOptions,
    );
    const consistencyScore = Math.max(0, 100 - consistencyMetric.standardDeviation * 10);

    // Calculate PacingScore (15% weight)
    const timeAnalysis = this.timeAnalytics.analyzeTimePerQuestion(
      userId,
      certificationId,
      filterOptions,
    );
    let pacingScore = 100;

    // Get exam duration for pacing calculation
    const durationQuery = `
      SELECT duration, totalQuestions
      FROM exam_configurations
      WHERE certificationId = ?
      LIMIT 1
    `;

    const durationResult = this.db.prepare(durationQuery).get(certificationId) as
      | {
          duration: number;
          totalQuestions: number;
        }
      | undefined;

    if (durationResult) {
      const examDuration = durationResult.duration * 60; // Convert to seconds
      const projectedTime = timeAnalysis.projectedCompletionTime;

      if (projectedTime > examDuration) {
        pacingScore = 0;
      } else if (projectedTime > examDuration * 0.9) {
        pacingScore = 50;
      }
    }

    // Calculate ConfidenceCalibration (5% weight)
    // Get high confidence incorrect answers from recent 50 sessions
    // Requirements: 25.1, 25.3
    const { clause: confidenceFilterClause, params: confidenceFilterParams } = buildFilterClause(
      filterOptions,
      'exam_sessions',
    );
    const confidenceQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ea.confidenceLevel >= 3 AND ea.isCorrect = 0 THEN 1 ELSE 0 END) as highConfidenceIncorrect
      FROM (
        SELECT id, isPracticeMode
        FROM exam_sessions
        WHERE userId = ?
          AND certificationId = ?
          AND status = 'completed'
          ${confidenceFilterClause}
        ORDER BY createdAt DESC
        LIMIT 50
      ) es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      WHERE ea.confidenceLevel IS NOT NULL
    `;

    const confidenceResult = this.db
      .prepare(confidenceQuery)
      .get(userId, certificationId, ...confidenceFilterParams) as {
      total: number;
      highConfidenceIncorrect: number;
    };

    const criticalGapsPct =
      confidenceResult.total > 0
        ? (confidenceResult.highConfidenceIncorrect / confidenceResult.total) * 100
        : 0;
    const confidenceCalibration = Math.max(0, 100 - criticalGapsPct * 2);

    // Apply RecencyWeight using exponential decay
    // Get last 10 sessions with their scores
    const recentSessionsQuery = `
      SELECT 
        es.id,
        es.createdAt,
        (CAST(SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) AS REAL) / 
         CAST(COUNT(ea.id) AS REAL) * 100) as score
      FROM exam_sessions es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      WHERE es.userId = ?
        AND es.certificationId = ?
        AND es.status = 'completed'
        ${filterClause}
      GROUP BY es.id, es.createdAt
      ORDER BY es.createdAt DESC
      LIMIT 10
    `;

    const recentSessions = this.db
      .prepare(recentSessionsQuery)
      .all(userId, certificationId, ...filterParams) as Array<{
      id: string;
      createdAt: string;
      score: number;
    }>;

    // Calculate recency-weighted average
    let weightedSum = 0;
    let weightSum = 0;

    recentSessions.forEach((session, index) => {
      const weight = Math.pow(0.5, index / 5);
      weightedSum += session.score * weight;
      weightSum += weight;
    });

    const recencyWeight = weightSum > 0 ? weightedSum / weightSum / 100 : 1;

    // Calculate overall readiness score
    const rawScore =
      (weightedDomainScore * 0.6 +
        consistencyScore * 0.2 +
        pacingScore * 0.15 +
        confidenceCalibration * 0.05) *
      recencyWeight;

    // Clamp score to [0, 100] range to prevent overflow
    const overallScore = Math.min(100, Math.max(0, rawScore));

    // Determine recent trend
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentSessions.length >= 3) {
      const firstThree = recentSessions.slice(0, 3).map((s) => s.score);
      const avgRecent = firstThree.reduce((a, b) => a + b, 0) / 3;

      const lastThree = recentSessions
        .slice(Math.max(0, recentSessions.length - 3))
        .map((s) => s.score);
      const avgOlder = lastThree.reduce((a, b) => a + b, 0) / lastThree.length;

      if (avgRecent > avgOlder + 5) {
        recentTrend = 'improving';
      } else if (avgRecent < avgOlder - 5) {
        recentTrend = 'declining';
      }
    }

    // Calculate green light status
    const { greenLightStatus, criteriaForGreen } = this.calculateGreenLightStatus(
      userId,
      certificationId,
      overallScore,
      filterOptions,
      domainScores,
      consistencyMetric,
    );

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      domainScores,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      pacingScore: Math.round(pacingScore * 100) / 100,
      recentTrend,
      greenLightStatus,
      criteriaForGreen,
    };
  }

  /**
   * Calculate green light indicator status.
   * Green: 90%+ on 3 consecutive sessions
   * Yellow: 75-89%
   * Red: <75%
   *
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
   */
  private calculateGreenLightStatus(
    userId: string,
    certificationId: string,
    currentReadinessScore: number,
    filterOptions: FilterOptions = {},
    domainScores: DomainProficiency[] = [],
    consistencyMetric?: ConsistencyMetric,
  ): {
    greenLightStatus: 'green' | 'yellow' | 'red';
    criteriaForGreen: string[];
  } {
    const { clause: filterClause, params: filterParams } = buildFilterClause(filterOptions);

    // Get last 3 consecutive sessions
    const consecutiveQuery = `
      SELECT 
        (CAST(SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) AS REAL) / 
         CAST(COUNT(ea.id) AS REAL) * 100) as score
      FROM exam_sessions es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      WHERE es.userId = ?
        AND es.certificationId = ?
        AND es.status = 'completed'
        ${filterClause}
      GROUP BY es.id
      ORDER BY es.createdAt DESC
      LIMIT 3
    `;

    const lastThreeSessions = this.db
      .prepare(consecutiveQuery)
      .all(userId, certificationId, ...filterParams) as Array<{ score: number }>;

    const hasThreeConsecutive90Plus =
      lastThreeSessions.length === 3 && lastThreeSessions.every((s) => s.score >= 90);

    let greenLightStatus: 'green' | 'yellow' | 'red';
    const criteriaForGreen: string[] = [];

    if (hasThreeConsecutive90Plus) {
      greenLightStatus = 'green';
    } else if (currentReadinessScore >= 75 && currentReadinessScore < 90) {
      greenLightStatus = 'yellow';
      criteriaForGreen.push('Achieve 90%+ score on 3 consecutive timed practice exams');

      if (currentReadinessScore < 85) {
        criteriaForGreen.push('Improve overall readiness score to 85% or higher');
      }
    } else {
      greenLightStatus = 'red';
      criteriaForGreen.push('Achieve 90%+ score on 3 consecutive timed practice exams');
      criteriaForGreen.push('Improve overall readiness score to 75% or higher');
    }

    // Add domain-specific criteria if any domain is below 70%
    const weakDomains = domainScores.filter((d) => d.proficiencyScore < 70);

    if (weakDomains.length > 0) {
      criteriaForGreen.push(
        `Improve proficiency in weak domains: ${weakDomains.map((d) => d.domainName).join(', ')}`,
      );
    }

    // Add consistency criteria if variance is high
    const resolvedConsistency =
      consistencyMetric ??
      this.timeAnalytics.calculateConsistencyMetric(userId, certificationId, filterOptions);
    if (resolvedConsistency.hasHighVariance) {
      criteriaForGreen.push('Achieve more consistent scores (reduce score variance)');
    }

    return { greenLightStatus, criteriaForGreen };
  }

  /**
   * Generate certainty vs accuracy matrix showing confidence level against correctness.
   * Creates a 2x2 grid with counts and percentages for each quadrant.
   *
   * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
   */
  generateCertaintyMatrix(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): CertaintyMatrix {
    const {
      clause: filterClause,
      params: filterParams,
      questionFilter,
      questionParams,
    } = buildFilterClause(filterOptions, 'exam_sessions');

    const query = `
      SELECT 
        ea.confidenceLevel,
        ea.isCorrect
      FROM (
        SELECT id, isPracticeMode
        FROM exam_sessions
        WHERE userId = ?
          AND certificationId = ?
          AND status = 'completed'
          ${filterClause}
        ORDER BY createdAt DESC
        LIMIT 50
      ) es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      INNER JOIN questions q ON ea.questionId = q.id
      WHERE ea.confidenceLevel IS NOT NULL
        ${questionFilter}
    `;

    const answers = this.db
      .prepare(query)
      .all(userId, certificationId, ...filterParams, ...questionParams) as Array<{
      confidenceLevel: number;
      isCorrect: number;
    }>;

    let highConfidenceCorrect = 0;
    let highConfidenceIncorrect = 0;
    let lowConfidenceCorrect = 0;
    let lowConfidenceIncorrect = 0;

    answers.forEach((answer) => {
      const isHighConfidence = answer.confidenceLevel >= 3;
      const isCorrect = answer.isCorrect === 1;

      if (isHighConfidence && isCorrect) {
        highConfidenceCorrect++;
      } else if (isHighConfidence && !isCorrect) {
        highConfidenceIncorrect++;
      } else if (!isHighConfidence && isCorrect) {
        lowConfidenceCorrect++;
      } else {
        lowConfidenceIncorrect++;
      }
    });

    const total = answers.length;

    const calculatePercentage = (count: number): number => {
      return total > 0 ? Math.round((count / total) * 10000) / 100 : 0;
    };

    return {
      highConfidenceCorrect: {
        count: highConfidenceCorrect,
        percentage: calculatePercentage(highConfidenceCorrect),
      },
      highConfidenceIncorrect: {
        count: highConfidenceIncorrect,
        percentage: calculatePercentage(highConfidenceIncorrect),
      },
      lowConfidenceCorrect: {
        count: lowConfidenceCorrect,
        percentage: calculatePercentage(lowConfidenceCorrect),
      },
      lowConfidenceIncorrect: {
        count: lowConfidenceIncorrect,
        percentage: calculatePercentage(lowConfidenceIncorrect),
      },
    };
  }

  /**
   * Identifies the domain with the lowest proficiency and highest weight.
   * This is the "double-down" metric - the highest-impact weak area.
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  identifyDoubleDownMetric(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): DoubleDownMetric | null {
    const domainScores = this.proficiencyAnalytics.calculateDomainProficiency(
      userId,
      certificationId,
      filterOptions,
    );

    if (domainScores.length === 0) {
      return null;
    }

    const domainsWithPriority = domainScores.map((domain) => ({
      ...domain,
      priorityScore: ((100 - domain.proficiencyScore) * domain.domainWeight) / 100,
    }));

    domainsWithPriority.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.domainWeight - a.domainWeight;
    });

    const topDomain = domainsWithPriority[0];

    return {
      domainId: topDomain.domainId,
      domainName: topDomain.domainName,
      proficiencyScore: topDomain.proficiencyScore,
      domainWeight: topDomain.domainWeight,
      priorityScore: topDomain.priorityScore,
    };
  }
}
