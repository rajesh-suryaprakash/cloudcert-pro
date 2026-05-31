import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import type { ExamAnswerRow } from '../db-types';
import { nowIso } from '../utils/time';

export interface UpsertAnswerInput {
  examSessionId: string;
  questionId: string;
  userAnswer: unknown;
  markedForReview: boolean;
  confidenceLevel: string | null;
  answerOrder: number;
  timeSpent: number;
}

export class ExamAnswerRepository {
  constructor(private readonly db: Database) {}

  findBySession(sessionId: string): ExamAnswerRow[] {
    return this.db
      .prepare('SELECT * FROM exam_answers WHERE examSessionId = ?')
      .all(sessionId) as ExamAnswerRow[];
  }

  upsert(data: UpsertAnswerInput): string {
    const now = nowIso();
    const existing = this.db
      .prepare('SELECT id, userAnswer FROM exam_answers WHERE examSessionId = ? AND questionId = ?')
      .get(data.examSessionId, data.questionId) as
      | Pick<ExamAnswerRow, 'id' | 'userAnswer'>
      | undefined;

    if (existing) {
      // Check if answer has changed and record in answer_change_history
      const previousAnswer = existing.userAnswer;
      const newAnswer = JSON.stringify(data.userAnswer);

      if (previousAnswer !== newAnswer) {
        const changeId = crypto.randomUUID();
        this.db
          .prepare(
            `INSERT INTO answer_change_history (
              id, examSessionId, questionId, previousAnswer, newAnswer, changeTimestamp, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(changeId, data.examSessionId, data.questionId, previousAnswer, newAnswer, now, now);
      }

      this.db
        .prepare(
          `UPDATE exam_answers SET
            userAnswer = ?,
            markedForReview = ?,
            confidenceLevel = ?,
            answerOrder = ?,
            timeSpent = ?,
            updatedAt = ?
          WHERE id = ?`,
        )
        .run(
          newAnswer,
          data.markedForReview ? 1 : 0,
          data.confidenceLevel,
          data.answerOrder,
          data.timeSpent,
          now,
          existing.id,
        );
      return existing.id;
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO exam_answers (
          id, examSessionId, questionId, userAnswer, markedForReview,
          confidenceLevel, answerOrder, timeSpent, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        data.examSessionId,
        data.questionId,
        JSON.stringify(data.userAnswer),
        data.markedForReview ? 1 : 0,
        data.confidenceLevel,
        data.answerOrder,
        data.timeSpent,
        now,
        now,
      );
    return id;
  }

  markCorrect(answerId: string, isCorrect: boolean): void {
    this.db
      .prepare('UPDATE exam_answers SET isCorrect = ? WHERE id = ?')
      .run(isCorrect ? 1 : 0, answerId);
  }
}
