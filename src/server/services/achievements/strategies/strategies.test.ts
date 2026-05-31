import { describe, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { ExamCountStrategy } from './ExamCountStrategy';
import { ScoreThresholdStrategy } from './ScoreThresholdStrategy';
import { StreakStrategy } from './StreakStrategy';
import { StudyActivityStrategy } from './StudyActivityStrategy';
import { SpeedStrategy } from './SpeedStrategy';
import { SocialStrategy } from './SocialStrategy';
import type { AchievementStrategy } from '../AchievementStrategy';

// ---------------------------------------------------------------------------
// In-memory DB helpers
// ---------------------------------------------------------------------------

function createTestDb(): DatabaseType {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS exam_answers (
      id TEXT PRIMARY KEY,
      examSessionId TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_streaks (
      userId TEXT PRIMARY KEY,
      currentStreak INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS discussions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL
    );
  `);
  return db;
}

// ---------------------------------------------------------------------------
// Feature: codebase-refactoring, Property 8: Achievement strategy progress is non-negative
// Validates: Requirements 8.2
// ---------------------------------------------------------------------------

describe('Property 8: Achievement strategy progress is non-negative', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createTestDb();
  });

  const metadataArb = fc.record({
    score: fc.integer({ min: 0, max: 100 }),
    timePercent: fc.integer({ min: 0, max: 200 }),
  });

  const userIdArb = fc.uuid();

  it('ExamCountStrategy returns non-negative progress', () => {
    fc.assert(
      fc.property(userIdArb, metadataArb, (userId, metadata) => {
        const strategy: AchievementStrategy = new ExamCountStrategy(db);
        const progress = strategy.computeProgress(userId, metadata);
        return progress >= 0;
      }),
      { numRuns: 100 },
    );
  });

  it('ScoreThresholdStrategy returns non-negative progress', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.integer({ min: 0, max: 100 }),
        metadataArb,
        (userId, threshold, metadata) => {
          const strategy: AchievementStrategy = new ScoreThresholdStrategy(threshold);
          const progress = strategy.computeProgress(userId, metadata);
          return progress >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('StreakStrategy returns non-negative progress', () => {
    fc.assert(
      fc.property(userIdArb, metadataArb, (userId, metadata) => {
        const strategy: AchievementStrategy = new StreakStrategy(db);
        const progress = strategy.computeProgress(userId, metadata);
        return progress >= 0;
      }),
      { numRuns: 100 },
    );
  });

  it('StudyActivityStrategy (daily) returns non-negative progress', () => {
    fc.assert(
      fc.property(userIdArb, metadataArb, (userId, metadata) => {
        const strategy: AchievementStrategy = new StudyActivityStrategy(db, 'daily');
        const progress = strategy.computeProgress(userId, metadata);
        return progress >= 0;
      }),
      { numRuns: 100 },
    );
  });

  it('StudyActivityStrategy (total) returns non-negative progress', () => {
    fc.assert(
      fc.property(userIdArb, metadataArb, (userId, metadata) => {
        const strategy: AchievementStrategy = new StudyActivityStrategy(db, 'total');
        const progress = strategy.computeProgress(userId, metadata);
        return progress >= 0;
      }),
      { numRuns: 100 },
    );
  });

  it('StudyActivityStrategy (early_bird) returns non-negative progress', () => {
    fc.assert(
      fc.property(userIdArb, metadataArb, (userId, metadata) => {
        const strategy: AchievementStrategy = new StudyActivityStrategy(db, 'early_bird');
        const progress = strategy.computeProgress(userId, metadata);
        return progress >= 0;
      }),
      { numRuns: 100 },
    );
  });

  it('SpeedStrategy returns non-negative progress', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.integer({ min: 0, max: 100 }),
        metadataArb,
        (userId, requiredValue, metadata) => {
          const strategy: AchievementStrategy = new SpeedStrategy(requiredValue);
          const progress = strategy.computeProgress(userId, metadata);
          return progress >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('SocialStrategy returns non-negative progress', () => {
    fc.assert(
      fc.property(userIdArb, metadataArb, (userId, metadata) => {
        const strategy: AchievementStrategy = new SocialStrategy(db);
        const progress = strategy.computeProgress(userId, metadata);
        return progress >= 0;
      }),
      { numRuns: 100 },
    );
  });
});
