/**
 * AchievementStrategy interface — Requirements 8.1
 * Each achievement category implements this interface to compute progress.
 */
export interface AchievementStrategy {
  computeProgress(userId: string, metadata: Record<string, unknown>): number;
}
