import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';
import { QuestionSchema } from './schemas.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Question Request Schemas ──────────────────────────────────────────────────

/**
 * Create question request schema
 */
export const CreateQuestionRequestSchema = z
  .object({
    questionText: z.string().min(1).describe('Question text'),
    questionType: z
      .enum(['single', 'multiple'])
      .describe('Question type (single or multiple choice)'),
    options: z.array(z.string()).min(2).describe('Answer options'),
    correctAnswers: z.array(z.string()).min(1).describe('Correct answer(s)'),
    explanation: z.string().nullable().optional().describe('Explanation of the correct answer'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('Question difficulty level'),
    tags: z.array(z.string()).optional().describe('Question tags for categorization'),
    points: z.number().int().min(1).optional().describe('Points awarded for correct answer'),
    isActive: z.boolean().optional().describe('Whether the question is active'),
  })
  .openapi({
    description: 'Create question request',
    example: {
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      questionType: 'single',
      options: ['T3', 'R5', 'C5', 'M5'],
      correctAnswers: ['R5'],
      explanation: 'R5 instances are memory-optimized and designed for memory-intensive workloads.',
      difficulty: 'Medium',
      tags: ['EC2', 'Instance Types', 'Memory'],
      points: 1,
      isActive: true,
    },
  });

/**
 * Update question request schema
 */
export const UpdateQuestionRequestSchema = z
  .object({
    questionText: z.string().min(1).optional().describe('Question text'),
    questionType: z
      .enum(['single', 'multiple'])
      .optional()
      .describe('Question type (single or multiple choice)'),
    options: z.array(z.string()).min(2).optional().describe('Answer options'),
    correctAnswers: z.array(z.string()).min(1).optional().describe('Correct answer(s)'),
    explanation: z.string().nullable().optional().describe('Explanation of the correct answer'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional().describe('Question difficulty level'),
    tags: z.array(z.string()).optional().describe('Question tags for categorization'),
    points: z.number().int().min(1).optional().describe('Points awarded for correct answer'),
    isActive: z.boolean().optional().describe('Whether the question is active'),
  })
  .openapi({
    description: 'Update question request',
    example: {
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      difficulty: 'Hard',
      isActive: true,
    },
  });

// ── Question Response Schemas ─────────────────────────────────────────────────

/**
 * Questions list response schema
 */
export const QuestionsListResponseSchema = z.array(QuestionSchema).openapi({
  description: 'List of questions',
  example: [
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      topicId: '550e8400-e29b-41d4-a716-446655440003',
      subTopicId: null,
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      questionType: 'single',
      options: ['T3', 'R5', 'C5', 'M5'],
      correctAnswers: ['R5'],
      explanation: 'R5 instances are memory-optimized and designed for memory-intensive workloads.',
      difficulty: 'Medium',
      tags: ['EC2', 'Instance Types', 'Memory'],
      points: 1,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ],
});

/**
 * Question response schema (single question)
 */
export const QuestionResponseSchema = z
  .object({
    id: z.string().uuid().describe('Unique question identifier'),
    topicId: z.string().uuid().nullable().optional().describe('Associated topic ID'),
    subTopicId: z.string().uuid().nullable().optional().describe('Associated subtopic ID'),
    questionText: z.string().describe('Question text'),
    questionType: z
      .enum(['single', 'multiple'])
      .describe('Question type (single or multiple choice)'),
    options: z.array(z.string()).describe('Answer options'),
    correctAnswers: z.array(z.string()).describe('Correct answer(s)'),
    explanation: z.string().nullable().describe('Explanation of the correct answer'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('Question difficulty level'),
    tags: z.array(z.string()).describe('Question tags for categorization'),
    points: z.number().int().min(1).describe('Points awarded for correct answer'),
    isActive: z
      .union([z.boolean(), z.number().int().min(0).max(1)])
      .describe('Whether the question is active'),
  })
  .openapi({
    description: 'Single question',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      topicId: '550e8400-e29b-41d4-a716-446655440003',
      subTopicId: null,
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      questionType: 'single',
      options: ['T3', 'R5', 'C5', 'M5'],
      correctAnswers: ['R5'],
      explanation: 'R5 instances are memory-optimized and designed for memory-intensive workloads.',
      difficulty: 'Medium',
      tags: ['EC2', 'Instance Types', 'Memory'],
      points: 1,
      isActive: 1,
    },
  });

/**
 * Success response schema
 */
export const SuccessResponseSchema = z
  .object({
    success: z.boolean().describe('Operation success status'),
  })
  .openapi({
    description: 'Successful operation response',
    example: {
      success: true,
    },
  });

/**
 * Certification ID path parameter schema
 */
export const CertificationIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Certification ID'),
  })
  .openapi({
    description: 'Certification ID path parameter',
  });

/**
 * Question ID path parameter schema
 */
export const QuestionIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Question ID'),
  })
  .openapi({
    description: 'Question ID path parameter',
  });

/**
 * Question difficulty query parameter schema
 */
export const QuestionDifficultyQuerySchema = z
  .object({
    difficulty: z
      .enum(['Easy', 'Medium', 'Hard'])
      .optional()
      .describe('Filter questions by difficulty level'),
  })
  .openapi({
    description: 'Question difficulty query parameter',
  });

// Register all question schemas
registry.register('CreateQuestionRequest', CreateQuestionRequestSchema);
registry.register('UpdateQuestionRequest', UpdateQuestionRequestSchema);
registry.register('QuestionsListResponse', QuestionsListResponseSchema);
registry.register('QuestionResponse', QuestionResponseSchema);
registry.register('QuestionSuccessResponse', SuccessResponseSchema);
registry.register('QuestionCertificationIdParam', CertificationIdParamSchema);
registry.register('QuestionIdParam', QuestionIdParamSchema);
registry.register('QuestionDifficultyQuery', QuestionDifficultyQuerySchema);
