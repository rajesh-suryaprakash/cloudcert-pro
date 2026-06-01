import { registerPath } from './registry.js';
import {
  CreateCertificationRequestSchema,
  UpdateCertificationRequestSchema,
  CertificationsListResponseSchema,
  CertificationResponseSchema,
  SuccessResponseSchema,
  CertificationIdParamSchema,
  QuestionHistoryStatsResponseSchema,
  QuestionHistoryResetResponseSchema,
  UnseenQuestionsCountResponseSchema,
  UnseenQuestionsQuerySchema,
} from './certification-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all certification route endpoints with OpenAPI metadata
 */
export function registerCertificationRoutes(): void {
  // GET /api/certifications
  registerPath({
    method: 'get',
    path: '/api/certifications',
    summary: 'Get all certifications',
    description:
      'Retrieve a list of all available certifications. This endpoint is publicly accessible.',
    tags: ['Certifications'],
    responses: {
      200: {
        description: 'List of certifications retrieved successfully',
        content: {
          'application/json': {
            schema: CertificationsListResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid request',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Resource not found',
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

  // POST /api/certifications
  registerPath({
    method: 'post',
    path: '/api/certifications',
    summary: 'Create a new certification',
    description: 'Create a new certification. Requires admin authentication.',
    tags: ['Certifications'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateCertificationRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Certification created successfully',
        content: {
          'application/json': {
            schema: CertificationResponseSchema,
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

  // GET /api/certifications/:id
  registerPath({
    method: 'get',
    path: '/api/certifications/{id}',
    summary: 'Get certification by ID',
    description:
      'Retrieve a specific certification by its ID. This endpoint is publicly accessible.',
    tags: ['Certifications'],
    request: {
      params: CertificationIdParamSchema,
    },
    responses: {
      200: {
        description: 'Certification retrieved successfully',
        content: {
          'application/json': {
            schema: CertificationResponseSchema,
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

  // PUT /api/certifications/:id
  registerPath({
    method: 'put',
    path: '/api/certifications/{id}',
    summary: 'Update certification',
    description: 'Update an existing certification. Requires admin authentication.',
    tags: ['Certifications'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateCertificationRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Certification updated successfully',
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

  // DELETE /api/certifications/:id
  registerPath({
    method: 'delete',
    path: '/api/certifications/{id}',
    summary: 'Delete certification',
    description: 'Delete an existing certification. Requires admin authentication.',
    tags: ['Certifications'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
    },
    responses: {
      200: {
        description: 'Certification deleted successfully',
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

  // GET /api/certifications/:id/question-history/stats
  registerPath({
    method: 'get',
    path: '/api/certifications/{id}/question-history/stats',
    summary: 'Get question history statistics',
    description:
      'Retrieve statistics about which questions a user has seen for a specific certification. Requires authentication.',
    tags: ['Certifications', 'Question History'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
    },
    responses: {
      200: {
        description: 'Question history statistics retrieved successfully',
        content: {
          'application/json': {
            schema: QuestionHistoryStatsResponseSchema,
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

  // POST /api/certifications/:id/question-history/reset
  registerPath({
    method: 'post',
    path: '/api/certifications/{id}/question-history/reset',
    summary: 'Reset question history',
    description:
      'Clear all question history for the authenticated user for a specific certification. This allows the user to see all questions again.',
    tags: ['Certifications', 'Question History'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
    },
    responses: {
      200: {
        description: 'Question history reset successfully',
        content: {
          'application/json': {
            schema: QuestionHistoryResetResponseSchema,
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

  // GET /api/certifications/:id/questions/unseen
  registerPath({
    method: 'get',
    path: '/api/certifications/{id}/questions/unseen',
    summary: 'Get unseen questions count',
    description:
      'Get the count of questions the user has not yet seen for a certification, with optional filters by difficulty, topic, or subtopic. Requires authentication.',
    tags: ['Certifications', 'Question History'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
      query: UnseenQuestionsQuerySchema,
    },
    responses: {
      200: {
        description: 'Unseen questions count retrieved successfully',
        content: {
          'application/json': {
            schema: UnseenQuestionsCountResponseSchema,
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
      404: {
        description: 'Certification, topic, or subtopic not found',
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
