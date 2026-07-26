import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Study Plan Request Schemas ────────────────────────────────────────────────

/**
 * Study plan completion request schema
 */
export const StudyPlanCompletionRequestSchema = z
  .object({
    sessionId: z.string().uuid().describe('ID of the exam session'),
    topicId: z.string().uuid().describe('ID of the topic'),
    taskType: z
      .enum(['review_wrong_answers', 'practice_quiz', 'read_docs'])
      .describe('Type of study task completed'),
  })
  .openapi({
    description: 'Mark a study plan task as complete',
    example: {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      topicId: '550e8400-e29b-41d4-a716-446655440001',
      taskType: 'review_wrong_answers',
    },
  });

// ── Study Plan Response Schemas ───────────────────────────────────────────────

/**
 * Weak topic schema
 */
const WeakTopicSchema = z
  .object({
    topicId: z.string().uuid().describe('Topic ID'),
    topicTitle: z.string().describe('Topic title'),
    incorrectCount: z.number().int().min(1).describe('Number of incorrect answers for this topic'),
    docUrl: z.string().url().nullable().describe('Documentation URL for this topic'),
  })
  .openapi({
    description: 'A weak topic identified from exam results',
    example: {
      topicId: '550e8400-e29b-41d4-a716-446655440001',
      topicTitle: 'EC2 Instance Types',
      incorrectCount: 3,
      docUrl: 'https://docs.aws.amazon.com/ec2/instance-types',
    },
  });

/**
 * Study plan completion schema
 */
const StudyPlanCompletionSchema = z
  .object({
    topicId: z.string().uuid().describe('Topic ID'),
    taskType: z
      .enum(['review_wrong_answers', 'practice_quiz', 'read_docs'])
      .describe('Type of study task'),
  })
  .openapi({
    description: 'A completed study plan task',
    example: {
      topicId: '550e8400-e29b-41d4-a716-446655440001',
      taskType: 'review_wrong_answers',
    },
  });

/**
 * Study plan response schema
 */
export const StudyPlanResponseSchema = z
  .object({
    weakTopics: z.array(WeakTopicSchema).describe('Top 3 weak topics identified from exam results'),
    message: z.string().describe('Human-readable message about the study plan'),
    completions: z.array(StudyPlanCompletionSchema).describe('List of completed study tasks'),
  })
  .openapi({
    description: 'Study plan generated from exam session results',
    example: {
      weakTopics: [
        {
          topicId: '550e8400-e29b-41d4-a716-446655440001',
          topicTitle: 'EC2 Instance Types',
          incorrectCount: 3,
          docUrl: 'https://docs.aws.amazon.com/ec2/instance-types',
        },
      ],
      message: 'Study plan generated with 1 weak topic(s).',
      completions: [
        {
          topicId: '550e8400-e29b-41d4-a716-446655440001',
          taskType: 'review_wrong_answers',
        },
      ],
    },
  });

/**
 * Study plan completion record schema
 */
export const StudyPlanCompletionRecordSchema = z
  .object({
    id: z.string().uuid().describe('Completion record ID'),
    userId: z.string().uuid().describe('User ID'),
    sessionId: z.string().uuid().describe('Exam session ID'),
    topicId: z.string().uuid().describe('Topic ID'),
    taskType: z
      .enum(['review_wrong_answers', 'practice_quiz', 'read_docs'])
      .describe('Type of study task'),
    completedAt: z.string().datetime().describe('Completion timestamp (ISO 8601)'),
  })
  .openapi({
    description: 'A study plan completion record',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440003',
      topicId: '550e8400-e29b-41d4-a716-446655440001',
      taskType: 'review_wrong_answers',
      completedAt: '2024-01-15T10:00:00Z',
    },
  });

/**
 * Study plan completions list response schema
 */
export const StudyPlanCompletionsResponseSchema = z
  .object({
    completions: z.array(StudyPlanCompletionSchema).describe('List of completed study tasks'),
  })
  .openapi({
    description: 'List of study plan completions for a session',
    example: {
      completions: [
        {
          topicId: '550e8400-e29b-41d4-a716-446655440001',
          taskType: 'review_wrong_answers',
        },
      ],
    },
  });

// Register all study plan schemas
registry.register('StudyPlanCompletionRequest', StudyPlanCompletionRequestSchema);
registry.register('WeakTopic', WeakTopicSchema);
registry.register('StudyPlanCompletion', StudyPlanCompletionSchema);
registry.register('StudyPlanResponse', StudyPlanResponseSchema);
registry.register('StudyPlanCompletionRecord', StudyPlanCompletionRecordSchema);
registry.register('StudyPlanCompletionsResponse', StudyPlanCompletionsResponseSchema);
