import { registerPath } from './registry.js';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  AuthResponseSchema,
  LogoutResponseSchema,
  ForgotPasswordResponseSchema,
  ResetPasswordResponseSchema,
  GetMeResponseSchema,
} from './auth-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all authentication route endpoints with OpenAPI metadata
 */
export function registerAuthRoutes(): void {
  // POST /api/auth/register
  registerPath({
    method: 'post',
    path: '/api/auth/register',
    summary: 'Register a new user account',
    description:
      'Create a new user account with email, password, and name. Returns user information and sets authentication cookie.',
    tags: ['Authentication'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: RegisterRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'User successfully registered',
        content: {
          'application/json': {
            schema: AuthResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid input or email already exists',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
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

  // POST /api/auth/login
  registerPath({
    method: 'post',
    path: '/api/auth/login',
    summary: 'Login to user account',
    description:
      'Authenticate user with email and password. Returns user information and sets authentication cookie.',
    tags: ['Authentication'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: LoginRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'User successfully authenticated',
        content: {
          'application/json': {
            schema: AuthResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid email format or password requirements',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
          },
        },
      },
      401: {
        description: 'Authentication failed - invalid email or password',
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

  // POST /api/auth/logout
  registerPath({
    method: 'post',
    path: '/api/auth/logout',
    summary: 'Logout from user account',
    description: 'Clear authentication cookie and end user session.',
    tags: ['Authentication'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'User successfully logged out',
        content: {
          'application/json': {
            schema: LogoutResponseSchema,
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

  // POST /api/auth/forgot
  registerPath({
    method: 'post',
    path: '/api/auth/forgot',
    summary: 'Request password reset',
    description:
      'Send password reset email if account exists. Returns generic message for security.',
    tags: ['Authentication'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: ForgotPasswordRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Password reset email sent (if account exists)',
        content: {
          'application/json': {
            schema: ForgotPasswordResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid email format',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
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

  // POST /api/auth/reset
  registerPath({
    method: 'post',
    path: '/api/auth/reset',
    summary: 'Reset password with code',
    description: 'Reset user password using the code from reset email.',
    tags: ['Authentication'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: ResetPasswordRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Password successfully reset',
        content: {
          'application/json': {
            schema: ResetPasswordResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - invalid or expired reset code',
        content: {
          'application/json': {
            schema: ValidationErrorResponseSchema,
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

  // GET /api/auth/me
  registerPath({
    method: 'get',
    path: '/api/auth/me',
    summary: 'Get current user information',
    description: 'Retrieve information about the currently authenticated user.',
    tags: ['Authentication'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'Current user information',
        content: {
          'application/json': {
            schema: GetMeResponseSchema,
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
}
