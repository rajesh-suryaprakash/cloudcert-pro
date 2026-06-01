import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Authentication Request Schemas ────────────────────────────────────────────

/**
 * Register request schema
 */
export const RegisterRequestSchema = z
  .object({
    email: z.string().email().describe('User email address'),
    password: z
      .string()
      .min(8)
      .describe('User password (minimum 8 characters, must contain at least one number)'),
    name: z.string().min(1).describe('User full name'),
  })
  .openapi({
    description: 'User registration request',
    example: {
      email: 'user@example.com',
      password: 'password123',
      name: 'John Doe',
    },
  });

/**
 * Login request schema
 */
export const LoginRequestSchema = z
  .object({
    email: z.string().email().describe('User email address'),
    password: z.string().min(8).describe('User password'),
  })
  .openapi({
    description: 'User login request',
    example: {
      email: 'user@example.com',
      password: 'password123',
    },
  });

/**
 * Forgot password request schema
 */
export const ForgotPasswordRequestSchema = z
  .object({
    email: z.string().email().describe('User email address'),
  })
  .openapi({
    description: 'Forgot password request',
    example: {
      email: 'user@example.com',
    },
  });

/**
 * Reset password request schema
 */
export const ResetPasswordRequestSchema = z
  .object({
    email: z.string().email().describe('User email address'),
    code: z.string().min(1).describe('Password reset code from email'),
    password: z
      .string()
      .min(8)
      .describe('New password (minimum 8 characters, must contain at least one number)'),
  })
  .openapi({
    description: 'Reset password request',
    example: {
      email: 'user@example.com',
      code: 'abc123def456',
      password: 'newpassword123',
    },
  });

// ── Authentication Response Schemas ───────────────────────────────────────────

/**
 * Auth response schema (register/login)
 */
export const AuthResponseSchema = z
  .object({
    user: z.object({
      id: z.string().uuid().describe('User ID'),
      email: z.string().email().describe('User email'),
      name: z.string().describe('User name'),
      role: z.enum(['user', 'admin']).describe('User role'),
      xp: z.number().int().min(0).describe('User experience points'),
    }),
  })
  .openapi({
    description: 'Successful authentication response',
    example: {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'user',
        xp: 0,
      },
    },
  });

/**
 * Logout response schema
 */
export const LogoutResponseSchema = z
  .object({
    success: z.boolean().describe('Logout success status'),
  })
  .openapi({
    description: 'Successful logout response',
    example: {
      success: true,
    },
  });

/**
 * Forgot password response schema
 */
export const ForgotPasswordResponseSchema = z
  .object({
    message: z.string().describe('Generic message (same regardless of whether email exists)'),
  })
  .openapi({
    description: 'Forgot password response',
    example: {
      message: 'If that email exists, a reset link has been sent.',
    },
  });

/**
 * Reset password response schema
 */
export const ResetPasswordResponseSchema = z
  .object({
    success: z.boolean().describe('Reset success status'),
  })
  .openapi({
    description: 'Successful password reset response',
    example: {
      success: true,
    },
  });

/**
 * Get current user response schema
 */
export const GetMeResponseSchema = z
  .object({
    user: z
      .object({
        id: z.string().uuid().describe('User ID'),
        email: z.string().email().describe('User email'),
        name: z.string().describe('User name'),
        role: z.enum(['user', 'admin']).describe('User role'),
        xp: z.number().int().min(0).describe('User experience points'),
      })
      .nullable(),
  })
  .openapi({
    description: 'Current user information',
    example: {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'user',
        xp: 1250,
      },
    },
  });

// Register all auth schemas
registry.register('RegisterRequest', RegisterRequestSchema);
registry.register('LoginRequest', LoginRequestSchema);
registry.register('ForgotPasswordRequest', ForgotPasswordRequestSchema);
registry.register('ResetPasswordRequest', ResetPasswordRequestSchema);
registry.register('AuthResponse', AuthResponseSchema);
registry.register('LogoutResponse', LogoutResponseSchema);
registry.register('ForgotPasswordResponse', ForgotPasswordResponseSchema);
registry.register('ResetPasswordResponse', ResetPasswordResponseSchema);
registry.register('GetMeResponse', GetMeResponseSchema);
