import { db } from '../db/connection';
import type {
  DomainProficiency,
  TopicProficiency,
  SubtopicProficiency,
  UnitProficiency,
  TimeAnalysis,
  HesitationAnalysis,
  ReadinessScore,
  ConsistencyMetric,
  SessionScore,
  FatigueAnalysis,
  QuartileData,
  CertaintyMatrix,
  DoubleDownMetric,
  FilterOptions,
} from '../types/insights';

export class AnalyticsService {
  /**
   * Helper method to build SQL WHERE clause for filter options
   */
  private buildFilterClause(
    filterOptions: FilterOptions = {},
    tableAlias: string = 'es',
  ): { clause: string; params: unknown[]; questionFilter: string; questionParams: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const questionConditions: string[] = [];
    const questionParams: unknown[] = [];

    // Filter by exam type (mock vs practice)
    if (filterOptions.examType) {
      if (filterOptions.examType === 'mock') {
        conditions.push(`${tableAlias}.isPracticeMode = 0`);
      } else if (filterOptions.examType === 'practice') {
        conditions.push(`${tableAlias}.isPracticeMode = 1`);
      }
    }

    // Filter by difficulty - this should be applied to questions table
    if (
      filterOptions.difficulty &&
      filterOptions.difficulty !== 'Mixed' &&
      filterOptions.difficulty !== 'all'
    ) {
      questionConditions.push(`q.difficulty = ?`);
      questionParams.push(filterOptions.difficulty);
    }

    return {
      clause: conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '',
      params,
      questionFilter:
        questionConditions.length > 0 ? ' AND ' + questionConditions.join(' AND ') : '',
      questionParams,
    };
  }
  /**
   * Calculate proficiency scores by domain for a user and certification.
   * Returns proficiency percentage, questions attempted, and questions correct for each domain.
   *
   * Requirements: 1.1, 1.3, 1.4, 1.5
   */
  calculateDomainProficiency(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): DomainProficiency[] {
    const {
      clause: filterClause,
      params: filterParams,
      questionFilter,
      questionParams,
    } = this.buildFilterClause(filterOptions, 'exam_sessions');

    // Updated query to use topic title as domain name instead of separate domainName field
    // Requirements: 25.1, 25.3
    const query = `
      SELECT 
        COALESCE(t.title, q.domainId, 'Unknown Domain') as domainId,
        COALESCE(t.title, q.domainId, 'Unknown Domain') as domainName,
        COALESCE(t.weightPercentage, 0) as domainWeight,
        COUNT(ea.questionId) as questionsAttempted,
        SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) as questionsCorrect
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
      LEFT JOIN topics t ON q.topicId = t.id AND t.certificationId = ?
      WHERE COALESCE(t.title, q.domainId) IS NOT NULL
        ${questionFilter}
      GROUP BY COALESCE(t.title, q.domainId), COALESCE(t.weightPercentage, 0)
      ORDER BY COALESCE(t.weightPercentage, 0) DESC
    `;

    const rows = db
      .prepare(query)
      .all(userId, certificationId, ...filterParams, certificationId, ...questionParams) as Array<{
      domainId: string;
      domainName: string;
      domainWeight: number;
      questionsAttempted: number;
      questionsCorrect: number;
    }>;

    return rows.map((row) => ({
      domainId: row.domainId,
      domainName: row.domainName || 'Unknown Domain',
      proficiencyScore: Math.min(
        row.questionsAttempted > 0 ? (row.questionsCorrect / row.questionsAttempted) * 100 : 0,
        100,
      ),
      domainWeight: row.domainWeight || 0,
      questionsAttempted: row.questionsAttempted,
      questionsCorrect: row.questionsCorrect,
    }));
  }

  /**
   * Calculate proficiency scores by topic for a user and certification.
   * Returns topic-level breakdown with proficiency percentage.
   *
   * Requirements: 3.1, 3.2, 3.4
   */
  calculateTopicProficiency(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): TopicProficiency[] {
    const {
      clause: filterClause,
      params: filterParams,
      questionFilter,
      questionParams,
    } = this.buildFilterClause(filterOptions, 'exam_sessions');

    // Optimized query limiting to recent 50 sessions
    // Requirements: 25.1, 25.3
    const query = `
      SELECT 
        t.id as topicId,
        t.title as topicName,
        q.domainId,
        COUNT(ea.questionId) as questionsAttempted,
        SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) as questionsCorrect
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
      INNER JOIN topics t ON q.topicId = t.id
      WHERE 1=1
        ${questionFilter}
      GROUP BY t.id, t.title, q.domainId
      ORDER BY t.title
    `;

    const rows = db
      .prepare(query)
      .all(userId, certificationId, ...filterParams, ...questionParams) as Array<{
      topicId: string;
      topicName: string;
      domainId: string;
      questionsAttempted: number;
      questionsCorrect: number;
    }>;

    return rows.map((row) => ({
      topicId: row.topicId,
      topicName: row.topicName,
      domainId: row.domainId || '',
      proficiencyScore: Math.min(
        row.questionsAttempted > 0 ? (row.questionsCorrect / row.questionsAttempted) * 100 : 0,
        100,
      ),
      questionsAttempted: row.questionsAttempted,
      questionsCorrect: row.questionsCorrect,
    }));
  }

  /**
   * Calculate proficiency scores by subtopic for a user and certification.
   * Flags insufficient data when fewer than 3 questions attempted.
   *
   * Requirements: 3.2, 3.3, 3.5
   */
  calculateSubtopicProficiency(userId: string, certificationId: string): SubtopicProficiency[] {
    // Optimized query limiting to recent 50 sessions
    // Requirements: 25.1, 25.3
    const query = `
      SELECT 
        st.id as subtopicId,
        st.title as subtopicName,
        st.topicId,
        COUNT(ea.questionId) as questionsAttempted,
        SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) as questionsCorrect
      FROM (
        SELECT id
        FROM exam_sessions
        WHERE userId = ?
          AND certificationId = ?
          AND status = 'completed'
        ORDER BY createdAt DESC
        LIMIT 50
      ) es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      INNER JOIN questions q ON ea.questionId = q.id
      INNER JOIN subtopics st ON q.subTopicId = st.id
      WHERE q.subTopicId IS NOT NULL
      GROUP BY st.id, st.title, st.topicId
      ORDER BY st.title
    `;

    const rows = db.prepare(query).all(userId, certificationId) as Array<{
      subtopicId: string;
      subtopicName: string;
      topicId: string;
      questionsAttempted: number;
      questionsCorrect: number;
    }>;

    return rows.map((row) => {
      const questionsIncorrect = Math.max(0, row.questionsAttempted - row.questionsCorrect);
      return {
        subtopicId: row.subtopicId,
        subtopicName: row.subtopicName,
        topicId: row.topicId,
        proficiencyScore: Math.min(
          row.questionsAttempted > 0 ? (row.questionsCorrect / row.questionsAttempted) * 100 : 0,
          100,
        ),
        questionsAttempted: row.questionsAttempted,
        questionsCorrect: row.questionsCorrect,
        questionsIncorrect,
        hasInsufficientData: row.questionsAttempted < 3,
      };
    });
  }

  /**
   * Calculate proficiency scores by unit for a user and certification.
   * Flags insufficient data when fewer than 3 questions attempted.
   * Includes subtopicId on each result for downstream filtering.
   *
   * Requirements: 14.1, 14.2, 14.3, 14.4
   */
  calculateUnitProficiency(userId: string, certificationId: string): UnitProficiency[] {
    // Scope to user's last 50 completed exam sessions for the given certification
    // Requirements: 14.1, 14.4
    const query = `
      SELECT 
        u.id as unitId,
        u.title as unitName,
        u.subTopicId as subtopicId,
        COUNT(ea.questionId) as questionsAttempted,
        SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) as questionsCorrect
      FROM (
        SELECT id
        FROM exam_sessions
        WHERE userId = ?
          AND certificationId = ?
          AND status = 'completed'
        ORDER BY createdAt DESC
        LIMIT 50
      ) es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      INNER JOIN questions q ON ea.questionId = q.id
      INNER JOIN units u ON q.unitId = u.id
      WHERE q.unitId IS NOT NULL
      GROUP BY u.id, u.title, u.subTopicId
      ORDER BY u.title
    `;

    const rows = db.prepare(query).all(userId, certificationId) as Array<{
      unitId: string;
      unitName: string;
      subtopicId: string;
      questionsAttempted: number;
      questionsCorrect: number;
    }>;

    return rows.map((row) => ({
      unitId: row.unitId,
      unitName: row.unitName,
      subtopicId: row.subtopicId,
      proficiencyScore: Math.min(
        row.questionsAttempted > 0 ? (row.questionsCorrect / row.questionsAttempted) * 100 : 0,
        100,
      ),
      questionsAttempted: row.questionsAttempted,
      questionsCorrect: row.questionsCorrect,
      hasInsufficientData: row.questionsAttempted < 3,
    }));
  }

  /**
   * Analyze time spent per question, comparing correct vs incorrect answers.
   * Detects danger zones and pacing issues.
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5
   */
  analyzeTimePerQuestion(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): TimeAnalysis {
    const {
      clause: filterClause,
      params: filterParams,
      questionFilter,
      questionParams,
    } = this.buildFilterClause(filterOptions, 'exam_sessions');

    // Optimized query limiting to recent 50 sessions
    // Requirements: 25.1, 25.3
    const timeQuery = `
      SELECT 
        AVG(CASE WHEN ea.isCorrect = 1 THEN ea.timeSpent ELSE NULL END) as avgTimeCorrect,
        AVG(CASE WHEN ea.isCorrect = 0 THEN ea.timeSpent ELSE NULL END) as avgTimeIncorrect,
        AVG(ea.timeSpent) as avgTimeOverall
      FROM (
        SELECT id, isPracticeMode
        FROM exam_sessions
        WHERE userId = ?
          AND certificationId = ?
          AND status = 'completed'
          AND isPracticeMode = 0
          ${filterClause}
        ORDER BY createdAt DESC
        LIMIT 50
      ) es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      INNER JOIN questions q ON ea.questionId = q.id
      WHERE ea.timeSpent > 0
        ${questionFilter}
    `;

    const timeResult = db
      .prepare(timeQuery)
      .all(userId, certificationId, ...filterParams, ...questionParams)[0] as {
      avgTimeCorrect: number | null;
      avgTimeIncorrect: number | null;
      avgTimeOverall: number | null;
    };

    // Get exam duration for pacing calculation
    const durationQuery = `
      SELECT duration, totalQuestions
      FROM exam_configurations
      WHERE certificationId = ?
      LIMIT 1
    `;

    const durationResult = db.prepare(durationQuery).get(certificationId) as
      | {
          duration: number;
          totalQuestions: number;
        }
      | undefined;

    const avgTimeCorrect = timeResult.avgTimeCorrect || 0;
    const avgTimeIncorrect = timeResult.avgTimeIncorrect || 0;
    const avgTimeOverall = timeResult.avgTimeOverall || 0;

    // Calculate projected completion time
    const projectedCompletionTime = durationResult
      ? avgTimeOverall * durationResult.totalQuestions
      : 0;

    // Calculate pacing alert (projected time > 90% of exam duration)
    const examDuration = durationResult ? durationResult.duration * 60 : 0; // Convert minutes to seconds
    const pacingAlert = examDuration > 0 && projectedCompletionTime > examDuration * 0.9;

    return {
      avgTimeCorrect,
      avgTimeIncorrect,
      dangerZoneWarning: avgTimeIncorrect > 180,
      projectedCompletionTime,
      pacingAlert,
    };
  }

  /**
   * Analyze hesitation patterns by tracking answer changes.
   * Calculates percentage of correct-to-incorrect and incorrect-to-correct changes.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  analyzeHesitationPatterns(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): HesitationAnalysis {
    const {
      clause: filterClause,
      params: filterParams,
      questionFilter,
      questionParams,
    } = this.buildFilterClause(filterOptions, 'exam_sessions');

    // Optimized query limiting to recent 50 sessions
    // Requirements: 25.1, 25.3
    const query = `
      SELECT 
        ach.id,
        ach.previousAnswer,
        ach.newAnswer,
        q.correctAnswers,
        q.questionType
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
      INNER JOIN answer_change_history ach ON ach.examSessionId = es.id
      INNER JOIN questions q ON ach.questionId = q.id
      WHERE 1=1
        ${questionFilter}
    `;

    const changes = db
      .prepare(query)
      .all(userId, certificationId, ...filterParams, ...questionParams) as Array<{
      id: string;
      previousAnswer: string | null;
      newAnswer: string | null;
      correctAnswers: string;
      questionType: string;
    }>;

    let correctToIncorrect = 0;
    let incorrectToCorrect = 0;

    for (const change of changes) {
      if (!change.previousAnswer || !change.newAnswer) continue;

      const correctAnswers = JSON.parse(change.correctAnswers);
      const prevAnswer = JSON.parse(change.previousAnswer);
      const newAnswer = JSON.parse(change.newAnswer);

      // Determine if previous answer was correct
      const wasPrevCorrect = this.isAnswerCorrect(prevAnswer, correctAnswers, change.questionType);

      // Determine if new answer is correct
      const isNewCorrect = this.isAnswerCorrect(newAnswer, correctAnswers, change.questionType);

      if (wasPrevCorrect && !isNewCorrect) {
        correctToIncorrect++;
      } else if (!wasPrevCorrect && isNewCorrect) {
        incorrectToCorrect++;
      }
    }

    const totalChanges = changes.length;
    const correctToIncorrectPct = totalChanges > 0 ? (correctToIncorrect / totalChanges) * 100 : 0;
    const incorrectToCorrectPct = totalChanges > 0 ? (incorrectToCorrect / totalChanges) * 100 : 0;

    return {
      totalChanges,
      correctToIncorrectPct,
      incorrectToCorrectPct,
      confidenceWarning: correctToIncorrectPct > 20,
    };
  }

  /**
   * Calculate consistency metric by analyzing last 5 exam sessions.
   * Measures score stability using standard deviation.
   *
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   */
  calculateConsistencyMetric(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): ConsistencyMetric {
    const { clause: filterClause, params: filterParams } = this.buildFilterClause(filterOptions);

    const query = `
      SELECT 
        es.id as sessionId,
        es.createdAt as date,
        COALESCE(ec.name, 'Exam Session') as sessionName,
        (CAST(SUM(CASE WHEN ea.isCorrect = 1 THEN 1 ELSE 0 END) AS REAL) / 
         CAST(COUNT(ea.id) AS REAL) * 100) as score
      FROM exam_sessions es
      INNER JOIN exam_answers ea ON es.id = ea.examSessionId
      LEFT JOIN exam_configurations ec ON es.examConfigurationId = ec.id
      WHERE es.userId = ?
        AND es.certificationId = ?
        AND es.status = 'completed'
        ${filterClause}
      GROUP BY es.id, es.createdAt, ec.name
      ORDER BY es.createdAt DESC
      LIMIT 5
    `;

    const sessions = db.prepare(query).all(userId, certificationId, ...filterParams) as Array<{
      sessionId: string;
      date: string;
      sessionName: string;
      score: number;
    }>;

    const recentSessions: SessionScore[] = sessions.map((s) => ({
      sessionId: s.sessionId,
      date: s.date,
      score: s.score,
      sessionName: s.sessionName,
    }));

    // Calculate standard deviation
    let standardDeviation = 0;
    let hasHighVariance = false;

    if (sessions.length >= 2) {
      const scores = sessions.map((s) => s.score);
      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      standardDeviation = Math.sqrt(variance);
      hasHighVariance = standardDeviation > 10;
    }

    return {
      recentSessions,
      standardDeviation,
      hasHighVariance,
      insufficientData: sessions.length < 5,
    };
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
    const { clause: filterClause, params: filterParams } = this.buildFilterClause(filterOptions);

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
      db.prepare(sessionCountQuery).get(userId, certificationId, ...filterParams) as {
        count: number;
      }
    ).count;

    if (sessionCount < 3) {
      return null;
    }

    // Get domain proficiency scores
    const domainScores = this.calculateDomainProficiency(userId, certificationId, filterOptions);

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
    const consistencyMetric = this.calculateConsistencyMetric(
      userId,
      certificationId,
      filterOptions,
    );
    const consistencyScore = Math.max(0, 100 - consistencyMetric.standardDeviation * 10);

    // Calculate PacingScore (15% weight)
    const timeAnalysis = this.analyzeTimePerQuestion(userId, certificationId, filterOptions);
    let pacingScore = 100;

    // Get exam duration for pacing calculation
    const durationQuery = `
      SELECT duration, totalQuestions
      FROM exam_configurations
      WHERE certificationId = ?
      LIMIT 1
    `;

    const durationResult = db.prepare(durationQuery).get(certificationId) as
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
    const { clause: confidenceFilterClause, params: confidenceFilterParams } =
      this.buildFilterClause(filterOptions, 'exam_sessions');
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

    const confidenceResult = db
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

    const recentSessions = db
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
  ): {
    greenLightStatus: 'green' | 'yellow' | 'red';
    criteriaForGreen: string[];
  } {
    const { clause: filterClause, params: filterParams } = this.buildFilterClause(filterOptions);

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

    const lastThreeSessions = db
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
    const domainScores = this.calculateDomainProficiency(userId, certificationId, filterOptions);
    const weakDomains = domainScores.filter((d) => d.proficiencyScore < 70);

    if (weakDomains.length > 0) {
      criteriaForGreen.push(
        `Improve proficiency in weak domains: ${weakDomains.map((d) => d.domainName).join(', ')}`,
      );
    }

    // Add consistency criteria if variance is high
    const consistencyMetric = this.calculateConsistencyMetric(
      userId,
      certificationId,
      filterOptions,
    );
    if (consistencyMetric.hasHighVariance) {
      criteriaForGreen.push('Achieve more consistent scores (reduce score variance)');
    }

    return { greenLightStatus, criteriaForGreen };
  }

  /**
   * Helper method to determine if an answer is correct.
   */
  private isAnswerCorrect(
    userAnswer: string | string[],
    correctAnswers: string[],
    questionType: string,
  ): boolean {
    if (questionType === 'multiple') {
      return (
        Array.isArray(userAnswer) &&
        userAnswer.length === correctAnswers.length &&
        userAnswer.every((ans) => correctAnswers.includes(ans))
      );
    } else {
      const expected = Array.isArray(correctAnswers) ? correctAnswers[0] : correctAnswers;
      return userAnswer === expected;
    }
  }

  /**
   * Calculate fatigue factor by analyzing performance across exam quartiles.
   * Detects fatigue when accuracy drops more than 15% from first to last quartile.
   *
   * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
   */
  calculateFatigueFactor(sessionId: string): FatigueAnalysis {
    // Get all answers for the session with timestamps
    const query = `
      SELECT 
        ea.id,
        ea.isCorrect,
        ea.createdAt,
        ROW_NUMBER() OVER (ORDER BY ea.createdAt) as questionIndex
      FROM exam_answers ea
      WHERE ea.examSessionId = ?
      ORDER BY ea.createdAt
    `;

    const answers = db.prepare(query).all(sessionId) as Array<{
      id: string;
      isCorrect: number;
      createdAt: string;
      questionIndex: number;
    }>;

    if (answers.length === 0) {
      return {
        quartiles: [],
        fatigueDetected: false,
        recommendation: null,
      };
    }

    const totalQuestions = answers.length;

    // Assign each answer to a quartile
    const quartileData: Map<number, { correct: number; total: number }> = new Map([
      [1, { correct: 0, total: 0 }],
      [2, { correct: 0, total: 0 }],
      [3, { correct: 0, total: 0 }],
      [4, { correct: 0, total: 0 }],
    ]);

    answers.forEach((answer) => {
      const position = answer.questionIndex / totalQuestions;
      let quartile: number;

      if (position <= 0.25) {
        quartile = 1;
      } else if (position <= 0.5) {
        quartile = 2;
      } else if (position <= 0.75) {
        quartile = 3;
      } else {
        quartile = 4;
      }

      const data = quartileData.get(quartile) as { total: number; correct: number };
      data.total++;
      if (answer.isCorrect === 1) {
        data.correct++;
      }
    });

    // Calculate accuracy percentage for each quartile
    const quartiles: QuartileData[] = [];
    for (let i = 1; i <= 4; i++) {
      const data = quartileData.get(i) as { total: number; correct: number };
      const accuracyPct = data.total > 0 ? (data.correct / data.total) * 100 : 0;
      quartiles.push({
        quartile: i,
        accuracyPct: Math.round(accuracyPct * 100) / 100,
        questionsAnswered: data.total,
      });
    }

    // Detect fatigue: accuracy drop > 15% from first to last quartile
    const firstQuartileAccuracy = quartiles[0].accuracyPct;
    const lastQuartileAccuracy = quartiles[3].accuracyPct;
    const accuracyDrop = firstQuartileAccuracy - lastQuartileAccuracy;
    const fatigueDetected = accuracyDrop > 15;

    const recommendation = fatigueDetected
      ? 'Consider taking full-length timed practice exams to build endurance. Take short breaks during study sessions to maintain focus.'
      : null;

    return {
      quartiles,
      fatigueDetected,
      recommendation,
    };
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
    } = this.buildFilterClause(filterOptions, 'exam_sessions');

    // Optimized query limiting to recent 50 sessions
    // Requirements: 25.1, 25.3
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

    const answers = db
      .prepare(query)
      .all(userId, certificationId, ...filterParams, ...questionParams) as Array<{
      confidenceLevel: number;
      isCorrect: number;
    }>;

    // Initialize counters
    let highConfidenceCorrect = 0;
    let highConfidenceIncorrect = 0;
    let lowConfidenceCorrect = 0;
    let lowConfidenceIncorrect = 0;

    // Count answers in each quadrant
    answers.forEach((answer) => {
      // Convert 1-5 scale to high/low confidence
      // 1-2 = Low confidence, 3-5 = High confidence
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

    // Calculate percentages
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
    const domainScores = this.calculateDomainProficiency(userId, certificationId, filterOptions);

    if (domainScores.length === 0) {
      return null;
    }

    // Calculate priority score for each domain: (100 - proficiency) × weight
    // Then normalize to 0-100 scale by dividing by 100 (max weight)
    const domainsWithPriority = domainScores.map((domain) => ({
      ...domain,
      priorityScore: ((100 - domain.proficiencyScore) * domain.domainWeight) / 100,
    }));

    // Sort by priority score descending, then by domain weight descending (tie-breaker)
    domainsWithPriority.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.domainWeight - a.domainWeight;
    });

    // Return the highest priority domain
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
