import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── SRS Request Schemas ───────────────────────────────────────────────────────

/**
 * Review submission request schema
 */
export const ReviewRequestSchema = z
  .object({
    questionId: z.string().uuid().describe('ID of the question being reviewed'),
    quality: z
      .number()
      .int()
      .min(0)
      .max(5)
      .describe('Quality rating (0-5): 0=complete blackout, 5=perfect recall'),
  })
  .openapi({
    description: 'Submit a spaced repetition review for a question',
    example: {
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      quality: 4,
    },
  });

// ── SRS Response Schemas ──────────────────────────────────────────────────────

/**
 * User streak response schema
 */
export const StreakResponseSchema = z
  .object({
    currentStreak: z.number().int().min(0).describe('Current consecutive days streak'),
    longestStreak: z.number().int().min(0).describe('Longest streak ever achieved'),
    totalActiveDays: z.number().int().min(0).describe('Total number of active study days'),
    weeklyStreak: z.number().int().min(0).describe('Current weekly streak'),
  })
  .openapi({
    description: 'User study streak information',
    example: {
      currentStreak: 7,
      longestStreak: 15,
      totalActiveDays: 42,
      weeklyStreak: 2,
    },
  });

/**
 * Due review item schema
 */
export const DueReviewItemSchema = z
  .object({
    id: z.string().uuid().describe('Review record ID'),
    userId: z.string().uuid().describe('User ID'),
    questionId: z.string().uuid().describe('Question ID'),
    easinessFactor: z.number().describe('Current easiness factor for this question'),
    interval: z.number().int().describe('Current interval in days'),
    repetitions: z.number().int().describe('Number of successful repetitions'),
    nextReviewDate: z.string().datetime().describe('Next scheduled review date (ISO 8601)'),
    lastReviewedAt: z.string().datetime().nullable().describe('Last review timestamp (ISO 8601)'),
    questionText: z.string().describe('The question text'),
    options: z.array(z.string()).describe('Answer options'),
    correctAnswers: z.array(z.string()).describe('Correct answer(s)'),
    explanation: z.string().nullable().describe('Explanation of the correct answer'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('Question difficulty level'),
  })
  .openapi({
    description: 'A question due for review with full question details',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      questionId: '550e8400-e29b-41d4-a716-446655440002',
      easinessFactor: 2.5,
      interval: 1,
      repetitions: 2,
      nextReviewDate: '2024-01-15T10:00:00Z',
      lastReviewedAt: '2024-01-14T10:00:00Z',
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      options: ['T3', 'R5', 'C5', 'M5'],
      correctAnswers: ['R5'],
      explanation:
        'R5 instances are memory-optimized and designed for memory-intensive applications.',
      difficulty: 'Medium',
    },
  });

/**
 * Due reviews list response schema
 */
export const DueReviewsResponseSchema = z.array(DueReviewItemSchema).openapi({
  description: 'List of questions due for review',
  example: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      questionId: '550e8400-e29b-41d4-a716-446655440002',
      easinessFactor: 2.5,
      interval: 1,
      repetitions: 2,
      nextReviewDate: '2024-01-15T10:00:00Z',
      lastReviewedAt: '2024-01-14T10:00:00Z',
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      options: ['T3', 'R5', 'C5', 'M5'],
      correctAnswers: ['R5'],
      explanation:
        'R5 instances are memory-optimized and designed for memory-intensive applications.',
      difficulty: 'Medium',
    },
  ],
});

/**
 * Review submission response schema
 */
export const ReviewResponseSchema = z
  .object({
    success: z.boolean().describe('Whether the review was successfully recorded'),
    easinessFactor: z.number().describe('Updated easiness factor'),
    interval: z.number().int().describe('Updated interval in days'),
    repetitions: z.number().int().describe('Updated repetition count'),
    nextReviewDate: z.string().datetime().describe('Next scheduled review date (ISO 8601)'),
  })
  .openapi({
    description: 'Successful review submission response with updated SRS parameters',
    example: {
      success: true,
      easinessFactor: 2.6,
      interval: 6,
      repetitions: 3,
      nextReviewDate: '2024-01-21T10:00:00Z',
    },
  });

// Register all SRS schemas
registry.register('ReviewRequest', ReviewRequestSchema);
registry.register('StreakResponse', StreakResponseSchema);
registry.register('DueReviewItem', DueReviewItemSchema);
registry.register('DueReviewsResponse', DueReviewsResponseSchema);
registry.register('ReviewResponse', ReviewResponseSchema);
