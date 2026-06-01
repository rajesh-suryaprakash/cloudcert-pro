import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registerPath } from './registry.js';
import {
  CreateQuestionRequestSchema,
  QuestionsListResponseSchema,
  QuestionResponseSchema,
} from './question-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

/**
 * Subtopic ID path parameter schema
 */
const SubtopicIdParamSchema = z
  .object({
    subtopicId: z.string().uuid().describe('Subtopic ID'),
  })
  .openapi({
    description: 'Subtopic ID path parameter',
  });

/**
 * Register all subtopic question route endpoints with OpenAPI metadata
 */
export function registerSubtopicQuestionRoutes(): void {
  // GET /api/subtopics/:subtopicId/questions
  registerPath({
    method: 'get',
    path: '/api/subtopics/{subtopicId}/questions',
    summary: 'Get questions for a subtopic',
    description:
      'Retrieve all questions for a specific subtopic. This endpoint is publicly accessible.',
    tags: ['Questions'],
    request: {
      params: SubtopicIdParamSchema,
    },
    responses: {
      200: {
        description: 'List of questions retrieved successfully',
        content: {
          'application/json': {
            schema: QuestionsListResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid subtopic ID format',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
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

  // POST /api/subtopics/:subtopicId/questions
  registerPath({
    method: 'post',
    path: '/api/subtopics/{subtopicId}/questions',
    summary: 'Create a new question for a subtopic',
    description: 'Create a new question for a subtopic. Requires admin authentication.',
    tags: ['Questions'],
    security: [{ cookieAuth: [] }],
    request: {
      params: SubtopicIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CreateQuestionRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Question created successfully',
        content: {
          'application/json': {
            schema: QuestionResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input data or subtopic ID format',
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
}
