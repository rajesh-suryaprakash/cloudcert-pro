import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';
import { ExamSchema } from './schemas.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Exam Configuration Request/Response Schemas ───────────────────────────────

/**
 * Create exam configuration request schema
 */
export const CreateExamConfigRequestSchema = z
  .object({
    name: z.string().min(1).describe('Exam configuration name'),
    description: z.string().nullable().optional().describe('Exam description'),
    duration: z.number().int().min(15).max(480).describe('Exam duration in minutes'),
    totalQuestions: z.number().int().min(5).max(500).describe('Total number of questions'),
    passingScore: z.number().int().min(0).max(100).describe('Passing score percentage'),
    questionSelectionStrategy: z
      .enum(['random', 'difficulty_balanced', 'topic_based'])
      .describe('Strategy for selecting questions'),
    topicWeights: z.record(z.number()).optional().describe('Topic weights for question selection'),
    isActive: z.boolean().optional().describe('Whether the exam configuration is active'),
  })
  .openapi({
    description: 'Create exam configuration request',
    example: {
      name: 'AWS SAA Practice Exam',
      description: 'Full-length practice exam for AWS Solutions Architect Associate',
      duration: 130,
      totalQuestions: 65,
      passingScore: 72,
      questionSelectionStrategy: 'difficulty_balanced',
      topicWeights: { compute: 0.3, storage: 0.2, networking: 0.25, security: 0.25 },
      isActive: true,
    },
  });

/**
 * Update exam configuration request schema
 */
export const UpdateExamConfigRequestSchema = z
  .object({
    name: z.string().min(1).optional().describe('Exam configuration name'),
    description: z.string().nullable().optional().describe('Exam description'),
    duration: z.number().int().min(15).max(480).optional().describe('Exam duration in minutes'),
    totalQuestions: z
      .number()
      .int()
      .min(5)
      .max(500)
      .optional()
      .describe('Total number of questions'),
    passingScore: z.number().int().min(0).max(100).optional().describe('Passing score percentage'),
    questionSelectionStrategy: z
      .enum(['random', 'difficulty_balanced', 'topic_based'])
      .optional()
      .describe('Strategy for selecting questions'),
    topicWeights: z.record(z.number()).optional().describe('Topic weights for question selection'),
    isActive: z.boolean().optional().describe('Whether the exam configuration is active'),
  })
  .openapi({
    description: 'Update exam configuration request',
    example: {
      name: 'AWS SAA Practice Exam v2',
      duration: 140,
      passingScore: 75,
    },
  });

/**
 * Exam configuration ID path parameter schema
 */
export const ExamConfigIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Exam configuration ID'),
  })
  .openapi({
    description: 'Exam configuration ID path parameter',
  });

/**
 * Certification ID path parameter schema
 */
export const CertificationIdParamSchema = z
  .object({
    certId: z.string().uuid().describe('Certification ID'),
  })
  .openapi({
    description: 'Certification ID path parameter',
  });

/**
 * Exam configuration response schema
 */
export const ExamConfigResponseSchema = ExamSchema.openapi({
  description: 'Exam configuration details',
});

/**
 * Exam configurations list response schema
 */
export const ExamConfigsListResponseSchema = z.array(ExamSchema).openapi({
  description: 'List of exam configurations',
  example: [
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'AWS SAA Practice Exam',
      description: 'Full-length practice exam for AWS Solutions Architect Associate',
      duration: 130,
      totalQuestions: 65,
      passingScore: 72,
      questionSelectionStrategy: 'difficulty_balanced',
      topicWeights: { compute: 0.3, storage: 0.2, networking: 0.25, security: 0.25 },
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ],
});

/**
 * Success response schema
 */
export const SuccessResponseSchema = z
  .object({
    success: z.boolean().describe('Whether the operation was successful'),
  })
  .openapi({
    description: 'Success response',
    example: {
      success: true,
    },
  });

// Register all exam configuration schemas
registry.register('CreateExamConfigRequest', CreateExamConfigRequestSchema);
registry.register('UpdateExamConfigRequest', UpdateExamConfigRequestSchema);
registry.register('ExamConfigIdParam', ExamConfigIdParamSchema);
registry.register('CertificationIdParam', CertificationIdParamSchema);
registry.register('ExamConfigResponse', ExamConfigResponseSchema);
registry.register('ExamConfigsListResponse', ExamConfigsListResponseSchema);
registry.register('SuccessResponse', SuccessResponseSchema);
