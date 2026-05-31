import type { AchievementStrategy } from '../AchievementStrategy';

/**
 * Awards progress when the exam was completed within a time percentage threshold.
 * Handles key: speed_demon
 * metadata.timePercent: percentage of allowed time used (lower is faster)
 * requiredValue stored on the achievement row is the max allowed percentage.
 */
export class SpeedStrategy implements AchievementStrategy {
  constructor(private readonly requiredValue: number) {}

  computeProgress(_userId: string, metadata: Record<string, unknown>): number {
    const timePercent = typeof metadata.timePercent === 'number' ? metadata.timePercent : Infinity;
    return timePercent <= this.requiredValue ? 1 : 0;
  }
}
