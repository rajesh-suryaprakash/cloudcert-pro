import { registerPath } from './registry.js';
import {
  CreateQuestionRequestSchema,
  UpdateQuestionRequestSchema,
  QuestionsListResponseSchema,
  QuestionResponseSchema,
  SuccessResponseSchema,
  CertificationIdParamSchema,
  QuestionIdParamSchema,
  QuestionDifficultyQuerySchema,
} from './question-schemas.js';
import { TopicIdParamSchema } from './topic-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all question route endpoints with OpenAPI metadata
 */
export function registerQuestionRoutes(): void {
  // GET /api/certifications/:id/questions
  registerPath({
    method: 'get',
    path: '/api/certifications/{id}/questions',
    summary: 'Get questions for a certification',
    description:
      'Retrieve all questions for a specific certification. Optionally filter by difficulty level. This endpoint is publicly accessible.',
    tags: ['Questions'],
    request: {
      params: CertificationIdParamSchema,
      query: QuestionDifficultyQuerySchema,
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
        description:
          'Validation error - invalid certification ID format or invalid difficulty value',
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

  // POST /api/certifications/:id/questions
  registerPath({
    method: 'post',
    path: '/api/certifications/{id}/questions',
    summary: 'Create a new question',
    description: 'Create a new question for a certification. Requires admin authentication.',
    tags: ['Questions'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
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

  // GET /api/topics/:topicId/questions
  registerPath({
    method: 'get',
    path: '/api/topics/{topicId}/questions',
    summary: 'Get questions for a topic',
    description:
      'Retrieve all questions for a specific topic. This endpoint is publicly accessible.',
    tags: ['Questions'],
    request: {
      params: TopicIdParamSchema,
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
        description:
          'Validation error - invalid certification ID format or invalid difficulty value',
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

  // POST /api/topics/:topicId/questions
  registerPath({
    method: 'post',
    path: '/api/topics/{topicId}/questions',
    summary: 'Create a new question',
    description: 'Create a new question for a topic. Requires admin authentication.',
    tags: ['Questions'],
    security: [{ cookieAuth: [] }],
    request: {
      params: TopicIdParamSchema,
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

  // PUT /api/questions/:id
  registerPath({
    method: 'put',
    path: '/api/questions/{id}',
    summary: 'Update question',
    description: 'Update an existing question. Requires admin authentication.',
    tags: ['Questions'],
    security: [{ cookieAuth: [] }],
    request: {
      params: QuestionIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateQuestionRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Question updated successfully',
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
        description: 'Question not found',
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

  // DELETE /api/questions/:id
  registerPath({
    method: 'delete',
    path: '/api/questions/{id}',
    summary: 'Delete question',
    description: 'Delete an existing question. Requires admin authentication.',
    tags: ['Questions'],
    security: [{ cookieAuth: [] }],
    request: {
      params: QuestionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Question deleted successfully',
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
        description: 'Question not found',
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
