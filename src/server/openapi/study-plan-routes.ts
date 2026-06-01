import { registerPath } from './registry.js';
import {
  StudyPlanCompletionRequestSchema,
  StudyPlanResponseSchema,
  StudyPlanCompletionRecordSchema,
  StudyPlanCompletionsResponseSchema,
} from './study-plan-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  NotFoundErrorResponseSchema,
} from './schemas.js';
import { z } from 'zod';

/**
 * Register all Study Plan route endpoints with OpenAPI metadata
 */
export function registerStudyPlanRoutes(): void {
  // GET /api/exam-sessions/:id/study-plan
  registerPath({
    method: 'get',
    path: '/api/exam-sessions/{id}/study-plan',
    summary: 'Get study plan for exam session',
    description:
      'Retrieve a personalized study plan based on weak topics identified from a completed exam session. Returns the top 3 topics with the most incorrect answers, along with recommended study tasks and completion status.',
    tags: ['Study Plan'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().uuid().describe('Exam session ID'),
      }),
    },
    responses: {
      200: {
        description: 'Study plan successfully generated',
        content: {
          'application/json': {
            schema: StudyPlanResponseSchema,
          },
        },
      },
      401: {
        description: 'Not authenticated - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - user does not own this exam session',
        content: {
          'application/json': {
            schema: ForbiddenErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // POST /api/study-plan-completions
  registerPath({
    method: 'post',
    path: '/api/study-plan-completions',
    summary: 'Mark study task as complete',
    description:
      'Mark a study plan task as complete for the authenticated user. This endpoint is idempotent - submitting the same completion multiple times will not create duplicates.',
    tags: ['Study Plan'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: StudyPlanCompletionRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Study task marked as complete',
        content: {
          'application/json': {
            schema: StudyPlanCompletionRecordSchema,
          },
        },
      },
      400: {
        description: 'Validation error - missing required fields or invalid taskType',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      401: {
        description: 'Not authenticated - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - user does not own this exam session',
        content: {
          'application/json': {
            schema: ForbiddenErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Session or topic not found',
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

  // GET /api/study-plan-completions/:sessionId
  registerPath({
    method: 'get',
    path: '/api/study-plan-completions/{sessionId}',
    summary: 'Get study plan completions',
    description:
      'Retrieve all completed study tasks for a specific exam session owned by the authenticated user.',
    tags: ['Study Plan'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        sessionId: z.string().uuid().describe('Exam session ID'),
      }),
    },
    responses: {
      200: {
        description: 'List of completed study tasks',
        content: {
          'application/json': {
            schema: StudyPlanCompletionsResponseSchema,
          },
        },
      },
      401: {
        description: 'Not authenticated - no valid session',
        content: {
          'application/json': {
            schema: UnauthorizedErrorResponseSchema,
          },
        },
      },
      403: {
        description: 'Forbidden - user does not own this exam session',
        content: {
          'application/json': {
            schema: ForbiddenErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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
