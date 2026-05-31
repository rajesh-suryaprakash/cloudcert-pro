import { db } from '../../db/connection';
import type { AchievementStrategy } from './AchievementStrategy';
import { ExamCountStrategy } from './strategies/ExamCountStrategy';
import { ScoreThresholdStrategy } from './strategies/ScoreThresholdStrategy';
import { StreakStrategy } from './strategies/StreakStrategy';
import { StudyActivityStrategy } from './strategies/StudyActivityStrategy';
import { SpeedStrategy } from './strategies/SpeedStrategy';
import { SocialStrategy } from './strategies/SocialStrategy';
import { nowIso } from '../../utils/time';
import { logger } from '../../logger';

// ---------------------------------------------------------------------------
// Strategy registry — Requirements 8.3, 8.4
// To add a new achievement type, add an entry here. No dispatch logic changes.
// ---------------------------------------------------------------------------

const strategyRegistry: Record<string, AchievementStrategy> = {
  // Exam count achievements
  exam_first: new ExamCountStrategy(db),
  exam_veteran: new ExamCountStrategy(db),
  exam_legend: new ExamCountStrategy(db),

  // Score threshold achievements
  exam_perfect: new ScoreThresholdStrategy(100),
  score_90: new ScoreThresholdStrategy(90),
  score_95: new ScoreThresholdStrategy(95),
  score_100: new ScoreThresholdStrategy(100),

  // Streak achievements
  streak_7: new StreakStrategy(db),
  streak_30: new StreakStrategy(db),
  streak_100: new StreakStrategy(db),
  study_streak: new StreakStrategy(db),

  // Speed achievement
  speed_demon: new SpeedStrategy(50),

  // Study activity achievements
  study_daily: new StudyActivityStrategy(db, 'daily'),
  study_seeker: new StudyActivityStrategy(db, 'total'),
  study_master: new StudyActivityStrategy(db, 'total'),
  study_early: new StudyActivityStrategy(db, 'early_bird'),

  // Social achievements
  social_first_comment: new SocialStrategy(db),
};

// ---------------------------------------------------------------------------
// Internal helper — update or insert a user_achievement row
// ---------------------------------------------------------------------------

function updateAchievementProgress(
  userId: string,
  achievement: { id: string; requiredValue: number },
  newProgress: number,
  now: string,
  existingRow: { id: string; progress: number; isCompleted: number } | undefined,
): void {
  const isCompleted = newProgress >= achievement.requiredValue ? 1 : 0;

  if (existingRow) {
    if (newProgress !== existingRow.progress || isCompleted !== existingRow.isCompleted) {
      db.prepare(
        `
        UPDATE user_achievements SET
          progress = ?,
          isCompleted = ?,
          completedAt = ?,
          updatedAt = ?
        WHERE id = ?
      `,
      ).run(newProgress, isCompleted, isCompleted ? now : null, now, existingRow.id);
    }
  } else if (newProgress > 0 || isCompleted) {
    db.prepare(
      `
      INSERT INTO user_achievements (userId, achievementId, progress, isCompleted, completedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(userId, achievement.id, newProgress, isCompleted, isCompleted ? now : null, now, now);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const checkAchievements = (
  userId: string,
  category: string,
  _value: number,
  metadata: Record<string, unknown> = {},
): void => {
  try {
    const achievements = db
      .prepare('SELECT * FROM achievements WHERE category = ? AND isActive = 1')
      .all(category) as Array<{ id: string; key: string; requiredValue: number }>;

    const userAchievements = db
      .prepare('SELECT * FROM user_achievements WHERE userId = ?')
      .all(userId) as Array<{
      id: string;
      achievementId: string;
      progress: number;
      isCompleted: number;
    }>;

    const userAchievementMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));
    const now = nowIso();

    for (const achievement of achievements) {
      const ua = userAchievementMap.get(achievement.id);
      if (ua?.isCompleted) continue;

      const strategy = strategyRegistry[achievement.key];
      if (!strategy) continue;

      const newProgress = strategy.computeProgress(userId, metadata);
      updateAchievementProgress(userId, achievement, newProgress, now, ua);
    }
  } catch (err) {
    logger.error({ err, userId, category }, 'checkAchievements failed');
  }
};

export const updateUserStreak = (userId: string): void => {
  try {
    const todayStr = nowIso().split('T')[0];
    const today = new Date(todayStr);

    const streak = db.prepare('SELECT * FROM user_streaks WHERE userId = ?').get(userId) as
      | {
          currentStreak: number;
          longestStreak: number;
          lastActivityDate: string;
          totalActiveDays: number;
          weeklyStreak: number;
        }
      | undefined;

    if (!streak) {
      db.prepare(
        `
      INSERT INTO user_streaks (userId, currentStreak, longestStreak, lastActivityDate, totalActiveDays, weeklyStreak, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      ).run(userId, 1, 1, todayStr, 1, 1, nowIso());
      return;
    }

    const lastActivityDate = new Date(streak.lastActivityDate);
    const diffTime = today.getTime() - lastActivityDate.getTime();
    const daysSinceLastActivity = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity === 0) return;

    let currentStreak = streak.currentStreak;
    let longestStreak = streak.longestStreak;
    const totalActiveDays = streak.totalActiveDays + 1;
    let weeklyStreak = streak.weeklyStreak;

    if (daysSinceLastActivity === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
      weeklyStreak = (weeklyStreak % 7) + 1;
    } else {
      currentStreak = 1;
      weeklyStreak = 1;
    }

    db.prepare(
      `
    UPDATE user_streaks SET
      currentStreak = ?,
      longestStreak = ?,
      lastActivityDate = ?,
      totalActiveDays = ?,
      weeklyStreak = ?,
      updatedAt = ?
    WHERE userId = ?
  `,
    ).run(currentStreak, longestStreak, todayStr, totalActiveDays, weeklyStreak, nowIso(), userId);

    checkAchievements(userId, 'streak', currentStreak);
  } catch (err) {
    logger.error({ err, userId }, 'updateUserStreak failed');
  }
};
