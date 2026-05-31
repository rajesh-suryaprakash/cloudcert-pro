import type { Database } from 'better-sqlite3';
import type { AchievementStrategy } from '../AchievementStrategy';

/**
 * Counts social interactions (e.g., discussion posts) for the user.
 * Handles key: social_first_comment
 */
export class SocialStrategy implements AchievementStrategy {
  constructor(private readonly db: Database) {}

  computeProgress(userId: string, _metadata: Record<string, unknown>): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM discussions WHERE userId = ?')
      .get(userId) as { count: number };
    return Math.max(0, row.count);
  }
}
