import { registerPath } from './registry.js';
import { z } from 'zod';
import {
  CreateTopicRequestSchema,
  UpdateTopicRequestSchema,
  TopicsListResponseSchema,
  TopicResponseSchema,
  SuccessResponseSchema,
  CertificationIdParamSchema,
  TopicIdParamSchema,
} from './topic-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all topic route endpoints with OpenAPI metadata
 */
export function registerTopicRoutes(): void {
  // GET /api/certifications/:certificationId/topics
  registerPath({
    method: 'get',
    path: '/api/certifications/{certificationId}/topics',
    summary: 'Get topics for a certification',
    description:
      'Retrieve all topics for a specific certification. This endpoint is publicly accessible.',
    tags: ['Topics'],
    request: {
      params: CertificationIdParamSchema,
    },
    responses: {
      200: {
        description: 'List of topics retrieved successfully',
        content: {
          'application/json': {
            schema: TopicsListResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid certification ID format',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Certification not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // POST /api/certifications/:certificationId/topics
  registerPath({
    method: 'post',
    path: '/api/certifications/{certificationId}/topics',
    summary: 'Create a new topic',
    description: 'Create a new topic for a certification. Requires admin authentication.',
    tags: ['Topics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CreateTopicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Topic created successfully',
        content: {
          'application/json': {
            schema: TopicResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input data',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      401: {
        description: 'Authentication required - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - admin access required',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Certification not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // PUT /api/topics/:id
  registerPath({
    method: 'put',
    path: '/api/topics/{id}',
    summary: 'Update topic',
    description: 'Update an existing topic. Requires admin authentication.',
    tags: ['Topics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: TopicIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateTopicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Topic updated successfully',
        content: {
          'application/json': {
            schema: SuccessResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input data',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      401: {
        description: 'Authentication required - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - admin access required',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Topic not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // DELETE /api/topics/:id
  registerPath({
    method: 'delete',
    path: '/api/topics/{id}',
    summary: 'Delete topic',
    description: 'Delete an existing topic. Requires admin authentication.',
    tags: ['Topics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: TopicIdParamSchema,
    },
    responses: {
      200: {
        description: 'Topic deleted successfully',
        content: {
          'application/json': {
            schema: SuccessResponseSchema,
          },
        },
      },
      401: {
        description: 'Authentication required - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - admin access required',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Topic not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // PUT /api/certifications/:certificationId/topics/:id
  registerPath({
    method: 'put',
    path: '/api/certifications/{certificationId}/topics/{id}',
    summary: 'Update topic by certification',
    description: 'Update an existing topic. Requires admin authentication.',
    tags: ['Topics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        certificationId: z.string().uuid().describe('Certification ID'),
        id: z.string().uuid().describe('Topic ID'),
      }),
      body: {
        content: {
          'application/json': {
            schema: UpdateTopicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Topic updated successfully',
        content: {
          'application/json': {
            schema: SuccessResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input data',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      401: {
        description: 'Authentication required - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - admin access required',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Topic not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // DELETE /api/certifications/:certificationId/topics/:id
  registerPath({
    method: 'delete',
    path: '/api/certifications/{certificationId}/topics/{id}',
    summary: 'Delete topic by certification',
    description: 'Delete an existing topic. Requires admin authentication.',
    tags: ['Topics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        certificationId: z.string().uuid().describe('Certification ID'),
        id: z.string().uuid().describe('Topic ID'),
      }),
    },
    responses: {
      200: {
        description: 'Topic deleted successfully',
        content: {
          'application/json': {
            schema: SuccessResponseSchema,
          },
        },
      },
      401: {
        description: 'Authentication required - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - admin access required',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Topic not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });
}
