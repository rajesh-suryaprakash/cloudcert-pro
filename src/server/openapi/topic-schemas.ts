import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';
import { TopicSchema } from './schemas.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Topic Request Schemas ─────────────────────────────────────────────────────

/**
 * Create topic request schema
 */
export const CreateTopicRequestSchema = z
  .object({
    title: z.string().min(1).describe('Topic title'),
    description: z.string().nullable().optional().describe('Topic description'),
    orderIndex: z.number().int().min(0).optional().describe('Display order index'),
    isActive: z.boolean().optional().describe('Whether the topic is active'),
    docUrl: z.string().url().nullable().optional().describe('Documentation URL for the topic'),
  })
  .openapi({
    description: 'Create topic request',
    example: {
      title: 'EC2 - Elastic Compute Cloud',
      description: 'Virtual servers in the cloud',
      orderIndex: 1,
      isActive: true,
      docUrl: 'https://docs.aws.amazon.com/ec2/',
    },
  });

/**
 * Update topic request schema
 */
export const UpdateTopicRequestSchema = z
  .object({
    title: z.string().min(1).max(255).optional().describe('Topic title'),
    description: z.string().max(1000).nullable().optional().describe('Topic description'),
    orderIndex: z.number().int().min(0).optional().describe('Display order index'),
    isActive: z.boolean().optional().describe('Whether the topic is active'),
    docUrl: z.string().url().nullable().optional().describe('Documentation URL for the topic'),
  })
  .openapi({
    description: 'Update topic request',
    example: {
      title: 'EC2 - Elastic Compute Cloud',
      isActive: true,
    },
  });

// ── Topic Response Schemas ────────────────────────────────────────────────────

/**
 * Topics list response schema
 */
export const TopicsListResponseSchema = z.array(TopicSchema).openapi({
  description: 'List of topics',
  example: [
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'EC2 - Elastic Compute Cloud',
      description: 'Virtual servers in the cloud',
      orderIndex: 1,
      isActive: true,
      docUrl: 'https://docs.aws.amazon.com/ec2/',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ],
});

/**
 * Topic response schema (single topic)
 */
export const TopicResponseSchema = z
  .object({
    id: z.string().uuid().describe('Unique topic identifier'),
    certificationId: z.string().uuid().describe('Associated certification ID'),
    title: z.string().describe('Topic title'),
    description: z.string().nullable().describe('Topic description'),
    orderIndex: z.number().int().min(0).describe('Display order index'),
    isActive: z
      .union([z.boolean(), z.number().int().min(0).max(1)])
      .describe('Whether the topic is active'),
    docUrl: z.string().url().nullable().optional().describe('Documentation URL for the topic'),
  })
  .openapi({
    description: 'Single topic',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'EC2 - Elastic Compute Cloud',
      description: 'Virtual servers in the cloud',
      orderIndex: 1,
      isActive: 1,
      docUrl: 'https://docs.aws.amazon.com/ec2/',
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
    certificationId: z.string().uuid().describe('Certification ID'),
  })
  .openapi({
    description: 'Certification ID path parameter',
  });

/**
 * Topic ID path parameter schema
 */
export const TopicIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Topic ID'),
  })
  .openapi({
    description: 'Topic ID path parameter',
  });

// Register all topic schemas
registry.register('CreateTopicRequest', CreateTopicRequestSchema);
registry.register('UpdateTopicRequest', UpdateTopicRequestSchema);
registry.register('TopicsListResponse', TopicsListResponseSchema);
registry.register('TopicResponse', TopicResponseSchema);
registry.register('TopicSuccessResponse', SuccessResponseSchema);
registry.register('CertificationIdParam', CertificationIdParamSchema);
registry.register('TopicIdParam', TopicIdParamSchema);
