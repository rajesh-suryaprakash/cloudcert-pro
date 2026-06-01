import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Subtopic Schema ───────────────────────────────────────────────────────────

/**
 * Subtopic schema
 */
export const SubtopicSchema = z
  .object({
    id: z.string().uuid().describe('Unique subtopic identifier'),
    topicId: z.string().uuid().describe('Associated topic ID'),
    title: z.string().describe('Subtopic title'),
    description: z.string().nullable().describe('Subtopic description'),
    orderIndex: z.number().int().min(0).describe('Display order index'),
    isActive: z
      .union([z.boolean(), z.number().int().min(0).max(1)])
      .describe('Whether the subtopic is active'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
  })
  .openapi({
    description: 'Subtopic within a topic',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440005',
      topicId: '550e8400-e29b-41d4-a716-446655440003',
      title: 'EC2 Instance Types',
      description: 'Different types of EC2 instances and their use cases',
      orderIndex: 1,
      isActive: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  });

// ── Subtopic Request Schemas ──────────────────────────────────────────────────

/**
 * Create subtopic request schema
 */
export const CreateSubtopicRequestSchema = z
  .object({
    title: z.string().min(1).describe('Subtopic title'),
    description: z.string().nullable().optional().describe('Subtopic description'),
    orderIndex: z.number().int().min(0).optional().describe('Display order index'),
    isActive: z.boolean().optional().describe('Whether the subtopic is active'),
  })
  .openapi({
    description: 'Create subtopic request',
    example: {
      title: 'EC2 Instance Types',
      description: 'Different types of EC2 instances and their use cases',
      orderIndex: 1,
      isActive: true,
    },
  });

/**
 * Update subtopic request schema
 */
export const UpdateSubtopicRequestSchema = z
  .object({
    title: z.string().min(1).max(255).optional().describe('Subtopic title'),
    description: z.string().max(1000).nullable().optional().describe('Subtopic description'),
    orderIndex: z.number().int().min(0).optional().describe('Display order index'),
    isActive: z.boolean().optional().describe('Whether the subtopic is active'),
  })
  .openapi({
    description: 'Update subtopic request',
    example: {
      title: 'EC2 Instance Types',
      isActive: true,
    },
  });

// ── Subtopic Response Schemas ─────────────────────────────────────────────────

/**
 * Subtopics list response schema
 */
export const SubtopicsListResponseSchema = z.array(SubtopicSchema).openapi({
  description: 'List of subtopics',
  example: [
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      topicId: '550e8400-e29b-41d4-a716-446655440003',
      title: 'EC2 Instance Types',
      description: 'Different types of EC2 instances and their use cases',
      orderIndex: 1,
      isActive: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ],
});

/**
 * Subtopic response schema (single subtopic)
 */
export const SubtopicResponseSchema = SubtopicSchema.openapi({
  description: 'Single subtopic',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440005',
    topicId: '550e8400-e29b-41d4-a716-446655440003',
    title: 'EC2 Instance Types',
    description: 'Different types of EC2 instances and their use cases',
    orderIndex: 1,
    isActive: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
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

// ── Path Parameter Schemas ────────────────────────────────────────────────────

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
 * Topic ID path parameter schema
 */
export const TopicIdParamSchema = z
  .object({
    topicId: z.string().uuid().describe('Topic ID'),
  })
  .openapi({
    description: 'Topic ID path parameter',
  });

/**
 * Subtopic ID path parameter schema
 */
export const SubtopicIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Subtopic ID'),
  })
  .openapi({
    description: 'Subtopic ID path parameter',
  });

// Register all subtopic schemas
registry.register('Subtopic', SubtopicSchema);
registry.register('CreateSubtopicRequest', CreateSubtopicRequestSchema);
registry.register('UpdateSubtopicRequest', UpdateSubtopicRequestSchema);
registry.register('SubtopicsListResponse', SubtopicsListResponseSchema);
registry.register('SubtopicResponse', SubtopicResponseSchema);
registry.register('SubtopicSuccessResponse', SuccessResponseSchema);
registry.register('CertificationIdParam', CertificationIdParamSchema);
registry.register('TopicIdParam', TopicIdParamSchema);
registry.register('SubtopicIdParam', SubtopicIdParamSchema);
