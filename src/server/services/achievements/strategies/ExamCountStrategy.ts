import type { Database } from 'better-sqlite3';
import type { AchievementStrategy } from '../AchievementStrategy';

/**
 * Counts completed exam sessions for the user.
 * Handles keys: exam_first, exam_veteran, exam_legend
 */
export class ExamCountStrategy implements AchievementStrategy {
  constructor(private readonly db: Database) {}

  computeProgress(userId: string, _metadata: Record<string, unknown>): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM exam_sessions WHERE userId = ? AND status = 'completed'",
      )
      .get(userId) as { count: number };
    return Math.max(0, row.count);
  }
}
