import type { Database } from 'better-sqlite3';

export class SrsService {
  constructor(private readonly db: Database) {}

  updateQuestionReview(userId: string, questionId: string, quality: number) {
    const now = new Date();
    const review = this.db
      .prepare('SELECT * FROM question_reviews WHERE userId = ? AND questionId = ?')
      .get(userId, questionId) as {
      id: string;
      easeFactor: number;
      interval: number;
      repetitions: number;
    } | null;

    let easeFactor = 2.5;
    let interval = 0;
    let repetitions = 0;

    if (review) {
      easeFactor = review.easeFactor;
      interval = review.interval;
      repetitions = review.repetitions;
    }

    // SM-2 Algorithm Implementation
    if (quality < 3) {
      interval = 0;
      repetitions = 0;
    } else {
      repetitions++;
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, Math.min(5.0, easeFactor));

    const nextReviewDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();

    if (review) {
      this.db
        .prepare(
          `
        UPDATE question_reviews SET
          easeFactor = ?,
          interval = ?,
          repetitions = ?,
          nextReviewDate = ?,
          lastReviewDate = ?,
          quality = ?,
          updatedAt = ?
        WHERE id = ?
      `,
        )
        .run(
          easeFactor,
          interval,
          repetitions,
          nextReviewDate,
          now.toISOString(),
          quality,
          now.toISOString(),
          review.id,
        );
    } else {
      this.db
        .prepare(
          `
        INSERT INTO question_reviews (
          userId, questionId, easeFactor, interval, repetitions, nextReviewDate, lastReviewDate, quality, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          userId,
          questionId,
          easeFactor,
          interval,
          repetitions,
          nextReviewDate,
          now.toISOString(),
          quality,
          now.toISOString(),
          now.toISOString(),
        );
    }

    return { nextReviewDate, interval };
  }
}
