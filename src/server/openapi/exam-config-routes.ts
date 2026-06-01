import { registerPath } from './registry.js';
import {
  CreateExamConfigRequestSchema,
  UpdateExamConfigRequestSchema,
  ExamConfigIdParamSchema,
  CertificationIdParamSchema,
  ExamConfigResponseSchema,
  ExamConfigsListResponseSchema,
  SuccessResponseSchema,
} from './exam-config-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  NotFoundErrorResponseSchema,
} from './schemas.js';

/**
 * Register all exam configuration route endpoints with OpenAPI metadata
 */
export function registerExamConfigRoutes(): void {
  // GET /api/certifications/:certificationId/exams
  registerPath({
    method: 'get',
    path: '/api/certifications/{certificationId}/exams',
    summary: 'Get exam configurations for a certification',
    description: 'Retrieve all exam configurations for a specific certification. Public endpoint.',
    tags: ['Exams'],
    security: [],
    request: {
      params: CertificationIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam configurations retrieved successfully',
        content: {
          'application/json': {
            schema: ExamConfigsListResponseSchema,
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
            schema: NotFoundErrorResponseSchema,
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

  // POST /api/certifications/:certificationId/exams
  registerPath({
    method: 'post',
    path: '/api/certifications/{certificationId}/exams',
    summary: 'Create a new exam configuration',
    description:
      'Create a new exam configuration for a certification. Requires authentication and admin role.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: CertificationIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CreateExamConfigRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Exam configuration created successfully',
        content: {
          'application/json': {
            schema: ExamConfigResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input data or certification ID format',
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
        description: 'Forbidden - admin role required',
        content: {
          'application/json': {
            schema: ForbiddenErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Certification not found',
        content: {
          'application/json': {
            schema: NotFoundErrorResponseSchema,
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

  // PUT /api/exams/:id
  registerPath({
    method: 'put',
    path: '/api/exams/{id}',
    summary: 'Update an exam configuration',
    description: 'Update an existing exam configuration. Requires authentication and admin role.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamConfigIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateExamConfigRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Exam configuration updated successfully',
        content: {
          'application/json': {
            schema: SuccessResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input data or exam ID format',
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
        description: 'Forbidden - admin role required',
        content: {
          'application/json': {
            schema: ForbiddenErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam configuration not found',
        content: {
          'application/json': {
            schema: NotFoundErrorResponseSchema,
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
