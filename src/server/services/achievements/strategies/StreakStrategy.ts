import type { Database } from 'better-sqlite3';
import type { AchievementStrategy } from '../AchievementStrategy';

/**
 * Returns the user's current streak count.
 * Handles keys: streak_7, streak_30, streak_100, study_streak
 */
export class StreakStrategy implements AchievementStrategy {
  constructor(private readonly db: Database) {}

  computeProgress(userId: string, _metadata: Record<string, unknown>): number {
    const row = this.db
      .prepare('SELECT currentStreak FROM user_streaks WHERE userId = ?')
      .get(userId) as { currentStreak: number } | undefined;
    return row ? Math.max(0, row.currentStreak) : 0;
  }
}
