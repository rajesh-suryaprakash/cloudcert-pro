import { registerPath } from './registry.js';
import {
  ReviewRequestSchema,
  StreakResponseSchema,
  DueReviewsResponseSchema,
  ReviewResponseSchema,
} from './srs-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all SRS (Spaced Repetition System) route endpoints with OpenAPI metadata
 */
export function registerSrsRoutes(): void {
  // GET /api/srs/streak
  registerPath({
    method: 'get',
    path: '/api/srs/streak',
    summary: 'Get user study streak',
    description:
      "Retrieve the current user's study streak information including current streak, longest streak, and total active days.",
    tags: ['SRS'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'User streak information',
        content: {
          'application/json': {
            schema: StreakResponseSchema,
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

  // GET /api/srs/due
  registerPath({
    method: 'get',
    path: '/api/srs/due',
    summary: 'Get due review questions',
    description:
      'Retrieve all questions that are due for review based on the spaced repetition algorithm. Returns questions with full details including text, options, and current SRS parameters.',
    tags: ['SRS'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'List of questions due for review',
        content: {
          'application/json': {
            schema: DueReviewsResponseSchema,
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

  // POST /api/srs/review
  registerPath({
    method: 'post',
    path: '/api/srs/review',
    summary: 'Submit a review',
    description:
      'Submit a spaced repetition review for a question with a quality rating (0-5). Updates the SRS algorithm parameters and schedules the next review. Also updates user streak and checks for achievements.',
    tags: ['SRS'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: ReviewRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Review successfully submitted',
        content: {
          'application/json': {
            schema: ReviewResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - quality must be between 0 and 5',
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
      404: {
        description: 'Review not found - user does not have a review record for this question',
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
