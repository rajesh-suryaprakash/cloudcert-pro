import type { Database } from 'better-sqlite3';
import type { AchievementStrategy } from '../AchievementStrategy';

type StudyActivityMode = 'daily' | 'total' | 'early_bird';

/**
 * Tracks study activity metrics.
 * Handles keys: study_daily, study_seeker, study_master, study_early
 */
export class StudyActivityStrategy implements AchievementStrategy {
  constructor(
    private readonly db: Database,
    private readonly mode: StudyActivityMode,
  ) {}

  computeProgress(userId: string, _metadata: Record<string, unknown>): number {
    if (this.mode === 'daily') {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM exam_answers
           WHERE examSessionId IN (
             SELECT id FROM exam_sessions WHERE userId = ? AND date(createdAt) = date('now')
           )`,
        )
        .get(userId) as { count: number };
      return Math.max(0, row.count);
    }

    if (this.mode === 'total') {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM exam_answers
           WHERE examSessionId IN (SELECT id FROM exam_sessions WHERE userId = ?)`,
        )
        .get(userId) as { count: number };
      return Math.max(0, row.count);
    }

    // early_bird: progress = 1 if current hour < 8, else 0
    const hour = new Date().getHours();
    return hour < 8 ? 1 : 0;
  }
}
