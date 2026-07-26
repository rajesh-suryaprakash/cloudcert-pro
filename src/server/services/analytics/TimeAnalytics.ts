import type { Database } from 'better-sqlite3';
import type {
  TimeAnalysis,
  HesitationAnalysis,
  ConsistencyMetric,
  FatigueAnalysis,
  SessionScore,
  QuartileData,
  FilterOptions,
} from '../../types/insights';
import { buildFilterClause } from './filterHelper';

export class TimeAnalytics {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
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
    } = buildFilterClause(filterOptions, 'exam_sessions');

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

    const timeResult = this.db
      .prepare(timeQuery)
      .all(userId, certificationId, ...filterParams, ...questionParams)[0] as {
      avgTimeCorrect: number | null;
      avgTimeIncorrect: number | null;
      avgTimeOverall: number | null;
    };

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

    const avgTimeCorrect = timeResult.avgTimeCorrect || 0;
    const avgTimeIncorrect = timeResult.avgTimeIncorrect || 0;
    const avgTimeOverall = timeResult.avgTimeOverall || 0;

    const projectedCompletionTime = durationResult
      ? avgTimeOverall * durationResult.totalQuestions
      : 0;

    const examDuration = durationResult ? durationResult.duration * 60 : 0;
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
    } = buildFilterClause(filterOptions, 'exam_sessions');

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

    const changes = this.db
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

      const wasPrevCorrect = this.isAnswerCorrect(prevAnswer, correctAnswers, change.questionType);
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
    const { clause: filterClause, params: filterParams } = buildFilterClause(filterOptions);

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

    const sessions = this.db.prepare(query).all(userId, certificationId, ...filterParams) as Array<{
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
   * Calculate fatigue factor by analyzing performance across exam quartiles.
   * Detects fatigue when accuracy drops more than 15% from first to last quartile.
   *
   * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
   */
  calculateFatigueFactor(sessionId: string): FatigueAnalysis {
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

    const answers = this.db.prepare(query).all(sessionId) as Array<{
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
}
