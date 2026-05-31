import type { AchievementStrategy } from '../AchievementStrategy';

/**
 * Returns the required threshold value when the score in metadata meets or exceeds it.
 * Handles keys: exam_perfect, score_90, score_95, score_100
 */
export class ScoreThresholdStrategy implements AchievementStrategy {
  constructor(private readonly threshold: number) {}

  computeProgress(_userId: string, metadata: Record<string, unknown>): number {
    const score = typeof metadata.score === 'number' ? metadata.score : 0;
    return score >= this.threshold ? Math.max(0, this.threshold) : 0;
  }
}
