import { db as defaultDb } from '../db/connection';
import type { StudyListItem, ROIScore } from '../types/insights';
import type Database from 'better-sqlite3';

export class StudyListService {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || defaultDb;
  }

  /**
   * Generates a study list from a completed exam session
   * Identifies topics with incorrect answers and ranks them by priority
   */
  generateStudyList(sessionId: string): StudyListItem[] {
    // Get all topics with incorrect answers from this session
    const topicsWithErrors = this.db
      .prepare(
        `
      SELECT 
        t.id as topicId,
        t.title as topicName,
        COUNT(*) as incorrectCount,
        GROUP_CONCAT(DISTINCT st.title) as subtopicNames
      FROM exam_answers ea
      JOIN questions q ON q.id = ea.questionId
      JOIN topics t ON t.id = q.topicId
      LEFT JOIN subtopics st ON st.id = q.subTopicId
      WHERE ea.examSessionId = ?
        AND ea.isCorrect = 0
      GROUP BY t.id, t.title
      ORDER BY incorrectCount DESC, t.title ASC
    `,
      )
      .all(sessionId) as Array<{
      topicId: string;
      topicName: string;
      incorrectCount: number;
      subtopicNames: string | null;
    }>;

    return topicsWithErrors.map((topic, index) => ({
      topicId: topic.topicId,
      topicName: topic.topicName,
      subtopics: topic.subtopicNames ? topic.subtopicNames.split(',') : [],
      incorrectCount: topic.incorrectCount,
      docUrl: null, // Documentation URL not available in current schema
      priority: topicsWithErrors.length - index, // Higher priority for more errors
    }));
  }

  /**
   * Calculates ROI scores for all topics in a certification
   * ROI = GapScore × ImpactScore × OpportunityScore
   */
  calculateROIScores(userId: string, certificationId: string): ROIScore[] {
    // Get all topics for this certification with proficiency and domain weight
    const topicData = this.db
      .prepare(
        `
      SELECT 
        t.id as topicId,
        t.title as topicName,
        COALESCE(t.title, q.domainId) as domainId,
        COALESCE(t.weightPercentage, 0) as domainWeight,
        COUNT(DISTINCT q.id) as availableQuestions,
        COALESCE(
          (
            SELECT 
              AVG(CASE WHEN ea.isCorrect = 1 THEN 100.0 ELSE 0.0 END)
            FROM exam_sessions es
            JOIN exam_answers ea ON ea.examSessionId = es.id
            JOIN questions q2 ON q2.id = ea.questionId
            WHERE es.userId = ?
              AND es.certificationId = ?
              AND es.status = 'completed'
              AND q2.topicId = t.id
          ),
          0
        ) as currentProficiency
      FROM topics t
      JOIN questions q ON q.topicId = t.id
      WHERE t.certificationId = ?
      GROUP BY t.id, t.title, COALESCE(t.title, q.domainId), COALESCE(t.weightPercentage, 0)
      HAVING COUNT(DISTINCT q.id) > 0
    `,
      )
      .all(userId, certificationId, certificationId) as Array<{
      topicId: string;
      topicName: string;
      domainId: string | null;
      domainWeight: number | null;
      availableQuestions: number;
      currentProficiency: number;
    }>;

    const roiScores: ROIScore[] = [];

    for (const topic of topicData) {
      // Calculate ROI components
      const gapScore = (100 - topic.currentProficiency) / 100;
      const impactScore = (topic.domainWeight || 0) / 100;
      const opportunityScore = Math.min(topic.availableQuestions / 50, 1.0);

      // Calculate final ROI score
      const roiScore = gapScore * impactScore * opportunityScore;

      // Estimate score increase (assumes 1 hour of study can improve proficiency by ~15 points)
      const estimatedScoreIncrease = roiScore * 15;

      roiScores.push({
        topicId: topic.topicId,
        topicName: topic.topicName,
        domainId: topic.domainId || '',
        currentProficiency: topic.currentProficiency,
        domainWeight: topic.domainWeight || 0,
        availableQuestions: topic.availableQuestions,
        roiScore,
        estimatedScoreIncrease,
      });
    }

    return roiScores;
  }

  /**
   * Returns top N topics ranked by ROI score
   * These are the topics that will give the biggest score improvement per study hour
   */
  getTopRecommendations(userId: string, certificationId: string, limit: number = 5): ROIScore[] {
    const allScores = this.calculateROIScores(userId, certificationId);

    // Sort by ROI score descending
    allScores.sort((a, b) => b.roiScore - a.roiScore);

    // Return top N
    return allScores.slice(0, limit);
  }
}
