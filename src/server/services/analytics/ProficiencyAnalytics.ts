import type { Database } from 'better-sqlite3';
import type {
  DomainProficiency,
  TopicProficiency,
  SubtopicProficiency,
  UnitProficiency,
  FilterOptions,
} from '../../types/insights';
import { buildFilterClause } from './filterHelper';

export class ProficiencyAnalytics {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
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
    } = buildFilterClause(filterOptions, 'exam_sessions');

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

    const rows = this.db
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
    } = buildFilterClause(filterOptions, 'exam_sessions');

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

    const rows = this.db
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

    const rows = this.db.prepare(query).all(userId, certificationId) as Array<{
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

    const rows = this.db.prepare(query).all(userId, certificationId) as Array<{
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
}
