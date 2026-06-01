import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Achievement Schemas ───────────────────────────────────────────────────────

/**
 * Achievement schema
 */
export const AchievementSchema = z
  .object({
    id: z.number().int().describe('Achievement ID'),
    key: z.string().describe('Unique achievement key'),
    title: z.string().describe('Achievement title'),
    description: z.string().describe('Achievement description'),
    category: z
      .enum(['exam', 'study', 'streak', 'score', 'social', 'speed', 'mastery'])
      .describe('Achievement category'),
    tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).describe('Achievement tier'),
    iconName: z.string().describe('Icon name for the achievement'),
    xpReward: z.number().int().min(0).describe('Experience points reward'),
    requiredValue: z.number().int().describe('Required value to unlock achievement'),
    isActive: z.number().int().min(0).max(1).describe('Whether achievement is active (0 or 1)'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
  })
  .openapi({
    description: 'Achievement definition',
    example: {
      id: 1,
      key: 'exam_first',
      title: 'First Exam',
      description: 'Complete your first exam',
      category: 'exam',
      tier: 'bronze',
      iconName: 'trophy',
      xpReward: 100,
      requiredValue: 1,
      isActive: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  });

/**
 * User achievement schema (achievement with user progress)
 */
export const UserAchievementSchema = z
  .object({
    id: z.number().int().describe('Achievement ID'),
    key: z.string().describe('Unique achievement key'),
    title: z.string().describe('Achievement title'),
    description: z.string().describe('Achievement description'),
    category: z
      .enum(['exam', 'study', 'streak', 'score', 'social', 'speed', 'mastery'])
      .describe('Achievement category'),
    tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).describe('Achievement tier'),
    iconName: z.string().describe('Icon name for the achievement'),
    xpReward: z.number().int().min(0).describe('Experience points reward'),
    requiredValue: z.number().int().describe('Required value to unlock achievement'),
    isActive: z.number().int().min(0).max(1).describe('Whether achievement is active (0 or 1)'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of achievement creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of achievement last update'),
    progress: z.number().int().min(0).describe('User progress towards achievement'),
    isCompleted: z.boolean().describe('Whether user has completed the achievement'),
    completedAt: z
      .string()
      .datetime()
      .nullable()
      .describe('ISO 8601 timestamp when achievement was completed'),
    notified: z.boolean().describe('Whether user has been notified of completion'),
    userAchievementCreatedAt: z
      .string()
      .datetime()
      .describe('ISO 8601 timestamp when user achievement was created'),
  })
  .openapi({
    description: 'User achievement with progress',
    example: {
      id: 1,
      key: 'exam_first',
      title: 'First Exam',
      description: 'Complete your first exam',
      category: 'exam',
      tier: 'bronze',
      iconName: 'trophy',
      xpReward: 100,
      requiredValue: 1,
      isActive: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      progress: 1,
      isCompleted: true,
      completedAt: '2024-01-15T10:30:00Z',
      notified: true,
      userAchievementCreatedAt: '2024-01-15T10:30:00Z',
    },
  });

// ── Response Schemas ──────────────────────────────────────────────────────────

/**
 * Get achievements response schema
 */
export const AchievementsListResponseSchema = z.array(AchievementSchema).openapi({
  description: 'List of all active achievements',
  example: [
    {
      id: 1,
      key: 'exam_first',
      title: 'First Exam',
      description: 'Complete your first exam',
      category: 'exam',
      tier: 'bronze',
      iconName: 'trophy',
      xpReward: 100,
      requiredValue: 1,
      isActive: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
});

/**
 * Get user achievements response schema
 */
export const UserAchievementsListResponseSchema = z.array(UserAchievementSchema).openapi({
  description: 'List of user achievements with progress',
  example: [
    {
      id: 1,
      key: 'exam_first',
      title: 'First Exam',
      description: 'Complete your first exam',
      category: 'exam',
      tier: 'bronze',
      iconName: 'trophy',
      xpReward: 100,
      requiredValue: 1,
      isActive: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      progress: 1,
      isCompleted: true,
      completedAt: '2024-01-15T10:30:00Z',
      notified: true,
      userAchievementCreatedAt: '2024-01-15T10:30:00Z',
    },
  ],
});

/**
 * Check achievements request schema
 */
export const CheckAchievementsRequestSchema = z
  .object({
    category: z
      .enum(['exam', 'study', 'streak', 'score', 'social', 'speed', 'mastery'])
      .describe('Achievement category to check'),
    metadata: z
      .record(z.unknown())
      .optional()
      .describe('Optional metadata for achievement checking'),
  })
  .openapi({
    description: 'Check achievements request',
    example: {
      category: 'exam',
      metadata: {
        examSessionId: '550e8400-e29b-41d4-a716-446655440020',
        score: 85,
      },
    },
  });

/**
 * Check achievements response schema
 */
export const CheckAchievementsResponseSchema = z
  .object({
    checked: z.boolean().describe('Whether achievements were checked successfully'),
    newAchievements: z
      .array(
        z.object({
          id: z.number().int().describe('Achievement ID'),
          key: z.string().describe('Achievement key'),
          title: z.string().describe('Achievement title'),
          xpReward: z.number().int().describe('XP reward'),
        }),
      )
      .describe('Newly unlocked achievements'),
  })
  .openapi({
    description: 'Check achievements response',
    example: {
      checked: true,
      newAchievements: [
        {
          id: 1,
          key: 'exam_first',
          title: 'First Exam',
          xpReward: 100,
        },
      ],
    },
  });

// Register all achievement schemas
registry.register('Achievement', AchievementSchema);
registry.register('UserAchievement', UserAchievementSchema);
registry.register('AchievementsListResponse', AchievementsListResponseSchema);
registry.register('UserAchievementsListResponse', UserAchievementsListResponseSchema);
registry.register('CheckAchievementsRequest', CheckAchievementsRequestSchema);
registry.register('CheckAchievementsResponse', CheckAchievementsResponseSchema);
