import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';
import { CertificationSchema } from './schemas.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Certification Request Schemas ─────────────────────────────────────────────

/**
 * Create certification request schema
 */
export const CreateCertificationRequestSchema = z
  .object({
    title: z.string().min(1).describe('Certification title'),
    description: z.string().nullable().optional().describe('Certification description'),
    vendor: z
      .string()
      .nullable()
      .optional()
      .describe('Certification vendor (e.g., AWS, GCP, Azure)'),
    level: z.string().optional().describe('Certification level (e.g., Associate, Professional)'),
    examCode: z.string().nullable().optional().describe('Official exam code'),
    url: z.string().url().nullable().optional().describe('Official certification URL'),
    iconUrl: z.string().url().nullable().optional().describe('Certification icon URL'),
    isActive: z.boolean().optional().describe('Whether the certification is active'),
  })
  .openapi({
    description: 'Create certification request',
    example: {
      title: 'AWS Certified Solutions Architect',
      description: 'Design and deploy scalable systems on AWS',
      vendor: 'AWS',
      level: 'Associate',
      examCode: 'SAA-C03',
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      iconUrl: 'https://example.com/aws-saa.png',
      isActive: true,
    },
  });

/**
 * Update certification request schema
 */
export const UpdateCertificationRequestSchema = z
  .object({
    title: z.string().min(1).optional().describe('Certification title'),
    description: z.string().nullable().optional().describe('Certification description'),
    vendor: z.string().nullable().optional().describe('Certification vendor'),
    level: z.string().optional().describe('Certification level'),
    examCode: z.string().nullable().optional().describe('Official exam code'),
    url: z.string().url().nullable().optional().describe('Official certification URL'),
    iconUrl: z.string().url().nullable().optional().describe('Certification icon URL'),
    isActive: z.boolean().optional().describe('Whether the certification is active'),
  })
  .openapi({
    description: 'Update certification request',
    example: {
      title: 'AWS Certified Solutions Architect - Associate',
      isActive: true,
    },
  });

// ── Certification Response Schemas ────────────────────────────────────────────

/**
 * Certifications list response schema
 */
export const CertificationsListResponseSchema = z.array(CertificationSchema).openapi({
  description: 'List of certifications',
  example: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'AWS Certified Solutions Architect',
      description: 'Design and deploy scalable systems on AWS',
      vendor: 'AWS',
      level: 'Associate',
      examCode: 'SAA-C03',
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      iconUrl: 'https://example.com/aws-saa.png',
      isActive: true,
      createdAt: 1704067200,
      updatedAt: 1704153600,
    },
  ],
});

/**
 * Certification response schema (single certification)
 */
export const CertificationResponseSchema = CertificationSchema.openapi({
  description: 'Single certification',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'AWS Certified Solutions Architect',
    description: 'Design and deploy scalable systems on AWS',
    vendor: 'AWS',
    level: 'Associate',
    examCode: 'SAA-C03',
    url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
    iconUrl: 'https://example.com/aws-saa.png',
    isActive: true,
    createdAt: 1704067200,
    updatedAt: 1704153600,
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

// ── Question History Schemas ──────────────────────────────────────────────────

/**
 * Question history statistics response schema
 */
export const QuestionHistoryStatsResponseSchema = z
  .object({
    seenCount: z.number().int().min(0).describe('Number of questions the user has seen'),
    totalCount: z
      .number()
      .int()
      .min(0)
      .describe('Total number of active questions in the certification'),
    percentageSeen: z.number().min(0).max(100).describe('Percentage of questions seen (0-100)'),
  })
  .openapi({
    description: 'Question history statistics for a certification',
    example: {
      seenCount: 45,
      totalCount: 150,
      percentageSeen: 30.0,
    },
  });

/**
 * Question history reset response schema
 */
export const QuestionHistoryResetResponseSchema = z
  .object({
    recordsCleared: z.number().int().min(0).describe('Number of history records that were deleted'),
  })
  .openapi({
    description: 'Question history reset result',
    example: {
      recordsCleared: 45,
    },
  });

/**
 * Unseen questions count response schema
 */
export const UnseenQuestionsCountResponseSchema = z
  .object({
    unseenCount: z.number().int().min(0).describe('Number of unseen questions available'),
    totalCount: z.number().int().min(0).describe('Total number of active questions'),
  })
  .openapi({
    description: 'Count of unseen questions with optional filters',
    example: {
      unseenCount: 105,
      totalCount: 150,
    },
  });

/**
 * Unseen questions query parameters schema
 */
export const UnseenQuestionsQuerySchema = z
  .object({
    difficulty: z
      .enum(['Easy', 'Medium', 'Hard'])
      .optional()
      .describe('Filter by difficulty level'),
    topicId: z.string().uuid().optional().describe('Filter by topic ID'),
    subtopicId: z.string().uuid().optional().describe('Filter by subtopic ID'),
  })
  .openapi({
    description: 'Query parameters for unseen questions endpoint',
  });

// Register all certification schemas
registry.register('CreateCertificationRequest', CreateCertificationRequestSchema);
registry.register('UpdateCertificationRequest', UpdateCertificationRequestSchema);
registry.register('CertificationsListResponse', CertificationsListResponseSchema);
registry.register('CertificationResponse', CertificationResponseSchema);
registry.register('SuccessResponse', SuccessResponseSchema);
registry.register('CertificationIdParam', CertificationIdParamSchema);
registry.register('QuestionHistoryStatsResponse', QuestionHistoryStatsResponseSchema);
registry.register('QuestionHistoryResetResponse', QuestionHistoryResetResponseSchema);
registry.register('UnseenQuestionsCountResponse', UnseenQuestionsCountResponseSchema);
registry.register('UnseenQuestionsQuery', UnseenQuestionsQuerySchema);
