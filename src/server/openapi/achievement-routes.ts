import { registerPath } from './registry.js';
import {
  AchievementsListResponseSchema,
  UserAchievementsListResponseSchema,
  CheckAchievementsRequestSchema,
  CheckAchievementsResponseSchema,
} from './achievement-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all achievement route endpoints with OpenAPI metadata
 */
export function registerAchievementRoutes(): void {
  // GET /api/achievements/
  registerPath({
    method: 'get',
    path: '/api/achievements/',
    summary: 'Get all active achievements',
    description:
      'Retrieve a list of all active achievements in the system. Requires authentication.',
    tags: ['Achievements'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'List of active achievements retrieved successfully',
        content: {
          'application/json': {
            schema: AchievementsListResponseSchema,
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

  // GET /api/achievements
  registerPath({
    method: 'get',
    path: '/api/achievements',
    summary: 'Get all active achievements',
    description:
      'Retrieve a list of all active achievements in the system. Requires authentication.',
    tags: ['Achievements'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'List of active achievements retrieved successfully',
        content: {
          'application/json': {
            schema: AchievementsListResponseSchema,
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

  // GET /api/achievements/user
  registerPath({
    method: 'get',
    path: '/api/achievements/user',
    summary: 'Get user achievements with progress',
    description:
      'Retrieve all achievements for the authenticated user with their progress, completion status, and timestamps. Requires authentication.',
    tags: ['Achievements'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'User achievements retrieved successfully',
        content: {
          'application/json': {
            schema: UserAchievementsListResponseSchema,
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

  // POST /api/achievements/check
  registerPath({
    method: 'post',
    path: '/api/achievements/check',
    summary: 'Check and update user achievements',
    description:
      'Check if the user has unlocked any new achievements in a specific category. This endpoint evaluates achievement criteria and updates user progress. Requires authentication.',
    tags: ['Achievements'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CheckAchievementsRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Achievements checked successfully',
        content: {
          'application/json': {
            schema: CheckAchievementsResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid category or metadata',
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
