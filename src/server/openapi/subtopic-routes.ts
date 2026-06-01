import { registerPath } from './registry.js';
import { z } from 'zod';
import {
  CreateSubtopicRequestSchema,
  UpdateSubtopicRequestSchema,
  SubtopicsListResponseSchema,
  SubtopicResponseSchema,
  SuccessResponseSchema,
  TopicIdParamSchema,
  SubtopicIdParamSchema,
} from './subtopic-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all subtopic route endpoints with OpenAPI metadata
 */
export function registerSubtopicRoutes(): void {
  // GET /api/certifications/:certId/topics/:topicId/subtopics
  registerPath({
    method: 'get',
    path: '/api/certifications/{certId}/topics/{topicId}/subtopics',
    summary: 'Get subtopics for a topic',
    description:
      'Retrieve all subtopics for a specific topic. This endpoint is publicly accessible.',
    tags: ['Subtopics'],
    request: {
      params: z.object({
        certId: z.string(),
        topicId: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'List of subtopics retrieved successfully',
        content: {
          'application/json': {
            schema: SubtopicsListResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid certification or topic ID format',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Certification or topic not found',
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

  // POST /api/certifications/:certId/topics/:topicId/subtopics
  registerPath({
    method: 'post',
    path: '/api/certifications/{certId}/topics/{topicId}/subtopics',
    summary: 'Create a new subtopic',
    description: 'Create a new subtopic for a topic. Requires admin authentication.',
    tags: ['Subtopics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        certId: z.string(),
        topicId: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: CreateSubtopicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Subtopic created successfully',
        content: {
          'application/json': {
            schema: SubtopicResponseSchema,
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
        description: 'Certification or topic not found',
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

  // GET /api/topics/:topicId/subtopics
  registerPath({
    method: 'get',
    path: '/api/topics/{topicId}/subtopics',
    summary: 'Get subtopics for a topic',
    description:
      'Retrieve all subtopics for a specific topic. This endpoint is publicly accessible.',
    tags: ['Subtopics'],
    request: {
      params: TopicIdParamSchema,
    },
    responses: {
      200: {
        description: 'List of subtopics retrieved successfully',
        content: {
          'application/json': {
            schema: SubtopicsListResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid certification or topic ID format',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Certification or topic not found',
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

  // POST /api/topics/:topicId/subtopics
  registerPath({
    method: 'post',
    path: '/api/topics/{topicId}/subtopics',
    summary: 'Create a new subtopic',
    description: 'Create a new subtopic for a topic. Requires admin authentication.',
    tags: ['Subtopics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: TopicIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CreateSubtopicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Subtopic created successfully',
        content: {
          'application/json': {
            schema: SubtopicResponseSchema,
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
        description: 'Certification or topic not found',
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

  // PUT /api/subtopics/:id
  registerPath({
    method: 'put',
    path: '/api/subtopics/{id}',
    summary: 'Update subtopic',
    description: 'Update an existing subtopic. Requires admin authentication.',
    tags: ['Subtopics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: SubtopicIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateSubtopicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Subtopic updated successfully',
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
        description: 'Subtopic not found',
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

  // DELETE /api/subtopics/:id
  registerPath({
    method: 'delete',
    path: '/api/subtopics/{id}',
    summary: 'Delete subtopic',
    description: 'Delete an existing subtopic. Requires admin authentication.',
    tags: ['Subtopics'],
    security: [{ cookieAuth: [] }],
    request: {
      params: SubtopicIdParamSchema,
    },
    responses: {
      200: {
        description: 'Subtopic deleted successfully',
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
        description: 'Subtopic not found',
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
