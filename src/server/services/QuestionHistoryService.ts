import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { nowIso } from '../utils/time';

export interface HistoryStats {
  seenCount: number;
  totalCount: number;
  percentageSeen: number;
}

export interface BackfillResult {
  sessionsProcessed: number;
  recordsCreated: number;
}

/**
 * Service for managing question history tracking.
 * Tracks which questions users have seen per certification to prevent duplicates.
 *
 * Requirements: 1.1, 1.2, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 8.2, 9.1, 9.2, 9.3, 9.4
 */
export class QuestionHistoryService {
  constructor(private readonly db: Database) {}

  /**
   * Records that a user has seen specific questions in a certification.
   * Uses INSERT OR IGNORE to handle duplicates gracefully.
   *
   * Requirements: 1.1, 1.2, 5.2, 6.1, 6.2
   *
   * @param userId - The user ID
   * @param certificationId - The certification ID
   * @param questionIds - Array of question IDs that were seen
   */
  recordQuestionsSeen(userId: string, certificationId: string, questionIds: string[]): void {
    if (questionIds.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO question_history (id, userId, certificationId, questionId, seenAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    const now = nowIso();
    const insertMany = this.db.transaction(() => {
      for (const questionId of questionIds) {
        stmt.run(crypto.randomUUID(), userId, certificationId, questionId, now);
      }
    });

    insertMany();
  }

  /**
   * Returns the set of question IDs that a user has already seen
   * for a given certification.
   *
   * Requirements: 5.2, 6.1, 6.2
   *
   * @param userId - The user ID
   * @param certificationId - The certification ID
   * @returns Array of question IDs that have been seen
   */
  getSeenQuestionIds(userId: string, certificationId: string): string[] {
    const rows = this.db
      .prepare(
        `
        SELECT questionId 
        FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .all(userId, certificationId) as { questionId: string }[];

    return rows.map((row) => row.questionId);
  }

  /**
   * Returns statistics about question history for a certification.
   * Only counts active questions.
   *
   * Requirements: 7.1, 7.2, 7.3, 7.4, 8.2
   *
   * @param userId - The user ID
   * @param certificationId - The certification ID
   * @returns Statistics object with seen count, total count, and percentage
   */
  getHistoryStats(userId: string, certificationId: string): HistoryStats {
    // Count seen questions (only active ones)
    const seenResult = this.db
      .prepare(
        `
        SELECT COUNT(DISTINCT qh.questionId) as count
        FROM question_history qh
        JOIN questions q ON qh.questionId = q.id
        WHERE qh.userId = ? 
          AND qh.certificationId = ? 
          AND q.isActive = 1
      `,
      )
      .get(userId, certificationId) as { count: number };

    const seenCount = seenResult.count;

    // Count total active questions for this certification
    const totalResult = this.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM questions q
        JOIN topics t ON q.topicId = t.id
        WHERE t.certificationId = ? AND q.isActive = 1
      `,
      )
      .get(certificationId) as { count: number };

    const totalCount = totalResult.count;

    // Calculate percentage
    const percentageSeen =
      totalCount > 0 ? Math.round((seenCount / totalCount) * 100 * 100) / 100 : 0;

    return {
      seenCount,
      totalCount,
      percentageSeen,
    };
  }

  /**
   * Deletes all question history for a user and certification.
   * Returns the count of records deleted.
   *
   * Requirements: 4.1, 4.2, 5.3
   *
   * @param userId - The user ID
   * @param certificationId - The certification ID
   * @returns Number of records deleted
   */
  resetHistory(userId: string, certificationId: string): number {
    const result = this.db
      .prepare(
        `
        DELETE FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .run(userId, certificationId);

    return result.changes;
  }

  /**
   * Backfills question history from existing exam sessions.
   * Extracts question IDs from the questions JSON field.
   * Resolves certification ID from exam configuration if needed.
   *
   * Requirements: 9.1, 9.2, 9.3, 9.4
   *
   * @returns Object with counts of sessions processed and records created
   */
  backfillFromExistingSessions(): BackfillResult {
    // Query all exam sessions (completed and in_progress)
    const sessions = this.db
      .prepare(
        `
        SELECT id, userId, certificationId, examConfigurationId, questions, startTime
        FROM exam_sessions
        WHERE certificationId IS NOT NULL OR examConfigurationId IS NOT NULL
      `,
      )
      .all() as Array<{
      id: string;
      userId: string;
      certificationId: string | null;
      examConfigurationId: string | null;
      questions: string;
      startTime: string;
    }>;

    let recordsCreated = 0;

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO question_history (id, userId, certificationId, questionId, seenAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    const getCertIdStmt = this.db.prepare(`
      SELECT certificationId FROM exam_configurations WHERE id = ?
    `);

    const backfillTransaction = this.db.transaction(() => {
      for (const session of sessions) {
        // Parse question IDs from JSON
        let questionIds: string[];
        try {
          questionIds = JSON.parse(session.questions);
        } catch {
          // Skip sessions with malformed JSON
          continue;
        }

        // Resolve certification ID
        let certId = session.certificationId;
        if (!certId && session.examConfigurationId) {
          const result = getCertIdStmt.get(session.examConfigurationId) as
            | { certificationId: string }
            | undefined;
          certId = result?.certificationId ?? null;
        }

        // Skip if we couldn't resolve certification ID
        if (!certId) continue;

        // Insert history records for each question
        for (const questionId of questionIds) {
          const result = insertStmt.run(
            crypto.randomUUID(),
            session.userId,
            certId,
            questionId,
            session.startTime,
          );

          if (result.changes > 0) {
            recordsCreated++;
          }
        }
      }
    });

    backfillTransaction();

    return {
      sessionsProcessed: sessions.length,
      recordsCreated,
    };
  }

  /**
   * Verifies that database indexes are being used for question history queries.
   * Uses EXPLAIN QUERY PLAN to check index usage.
   *
   * Requirements: 6.1, 6.4
   *
   * @param userId - Sample user ID for testing
   * @param certificationId - Sample certification ID for testing
   * @returns Object with query plans showing index usage
   */
  verifyIndexUsage(
    userId: string,
    certificationId: string,
  ): {
    seenQuestionsQuery: string;
    lookupQuery: string;
  } {
    // Check if the composite index is used for getSeenQuestionIds query
    const seenQuestionsQueryPlan = this.db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        SELECT questionId 
        FROM question_history 
        WHERE userId = ? AND certificationId = ?
      `,
      )
      .all(userId, certificationId) as Array<{ detail: string }>;

    // Check if the lookup index is used for individual question lookups
    const lookupQueryPlan = this.db
      .prepare(
        `
        EXPLAIN QUERY PLAN
        SELECT questionId 
        FROM question_history 
        WHERE userId = ? AND certificationId = ? AND questionId = ?
      `,
      )
      .all(userId, certificationId, 'sample-question-id') as Array<{ detail: string }>;

    return {
      seenQuestionsQuery: seenQuestionsQueryPlan.map((row) => row.detail).join('\n'),
      lookupQuery: lookupQueryPlan.map((row) => row.detail).join('\n'),
    };
  }
}
