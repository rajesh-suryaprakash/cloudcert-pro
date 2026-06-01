import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

/**
 * OpenAPI Schema Definitions Module
 *
 * This module defines all reusable Zod schemas for the CloudCert Pro API.
 * Schemas are organized into two categories:
 *
 * 1. Error Response Schemas
 *    - ErrorResponse: Generic error response
 *    - ValidationErrorResponse: Validation errors with details
 *    - UnauthorizedErrorResponse: Authentication failures
 *    - ForbiddenErrorResponse: Authorization failures
 *    - NotFoundErrorResponse: Resource not found
 *
 * 2. Domain Schemas
 *    - User: User account information
 *    - Certification: Cloud certification metadata
 *    - Exam: Exam configuration and parameters
 *    - Topic: Topic within a certification
 *    - Question: Exam question with answers
 *    - Achievement: User achievement definition
 *
 * Schema Documentation Best Practices:
 *
 * 1. Field Descriptions:
 *    - Use .describe() on every field
 *    - Describe what the field represents, not its type
 *    - Include constraints (e.g., "minimum 8 characters")
 *    - Example: z.string().describe('User email address')
 *
 * 2. Schema-Level Metadata:
 *    - Use .openapi() for schema-level documentation
 *    - Include description: explains the schema's purpose
 *    - Include example: realistic data showing all fields
 *    - Example: .openapi({ description: '...', example: {...} })
 *
 * 3. Reusability:
 *    - Register schemas as components using registry.register()
 *    - Use $ref in routes to reference registered schemas
 *    - Reduces OpenAPI document size
 *    - Ensures consistency across endpoints
 *
 * 4. Validation Constraints:
 *    - Preserve all Zod validation rules in OpenAPI
 *    - min/max for strings and numbers
 *    - pattern for regex validation
 *    - enum for enumerated values
 *    - These constraints appear in Swagger UI and SDK generation
 */

// Extend Zod with OpenAPI methods for schema documentation
extendZodWithOpenApi(z);

// ── Error Response Schemas ────────────────────────────────────────────────────
//
// Error schemas are used in all error responses (400, 401, 403, 404, 500).
// They provide consistent error information to API clients.
//
// Usage in routes:
//   400: {
//     description: 'Invalid request body',
//     content: {
//       'application/json': { schema: ValidationErrorResponseSchema }
//     }
//   }

/**
 * Generic error response schema
 *
 * Used for unexpected errors and generic error conditions.
 * Provides a simple error message without additional details.
 */
export const ErrorResponseSchema = z
  .object({
    error: z.string().describe('Error message describing what went wrong'),
  })
  .openapi({
    description: 'Standard error response returned by the API',
    example: {
      error: 'An unexpected error occurred',
    },
  });

/**
 * Validation error response schema
 *
 * Used when request validation fails (400 Bad Request).
 * Includes the main error message and optional detailed error information.
 *
 * Example:
 *   {
 *     "error": "Invalid email format",
 *     "details": ["Email must be a valid email address"]
 *   }
 */
export const ValidationErrorResponseSchema = z
  .object({
    error: z.string().describe('Validation error message'),
    details: z.array(z.string()).optional().describe('Additional validation error details'),
  })
  .openapi({
    description: 'Validation error response with detailed error information',
    example: {
      error: 'Invalid email format',
      details: ['Email must be a valid email address'],
    },
  });

/**
 * Unauthorized error response schema
 *
 * Used when authentication fails or is missing (401 Unauthorized).
 * Indicates the client must provide valid credentials.
 *
 * Common causes:
 * - Missing authentication cookie or Authorization header
 * - Expired JWT token
 * - Invalid JWT signature
 */
export const UnauthorizedErrorResponseSchema = z
  .object({
    error: z.string().describe('Authentication error message'),
  })
  .openapi({
    description: 'Unauthorized error response when authentication fails or is missing',
    example: {
      error: 'Authentication required',
    },
  });

/**
 * Forbidden error response schema
 *
 * Used when the authenticated user lacks permission (403 Forbidden).
 * Indicates the client is authenticated but not authorized for this resource.
 *
 * Common causes:
 * - User is not an admin but endpoint requires admin role
 * - User is trying to access another user's resource
 * - User's role doesn't have permission for this action
 */
export const ForbiddenErrorResponseSchema = z
  .object({
    error: z.string().describe('Authorization error message'),
  })
  .openapi({
    description: 'Forbidden error response when user lacks permission to access resource',
    example: {
      error: 'Forbidden',
    },
  });

/**
 * Not found error response schema
 *
 * Used when a requested resource doesn't exist (404 Not Found).
 * Indicates the resource ID is invalid or the resource has been deleted.
 */
export const NotFoundErrorResponseSchema = z
  .object({
    error: z.string().describe('Resource not found error message'),
  })
  .openapi({
    description: 'Not found error response when requested resource does not exist',
    example: {
      error: 'Resource not found',
    },
  });

// Register error response schemas as reusable components
// These are referenced in route definitions for error responses
registry.register('ErrorResponse', ErrorResponseSchema);
registry.register('ValidationErrorResponse', ValidationErrorResponseSchema);
registry.register('UnauthorizedErrorResponse', UnauthorizedErrorResponseSchema);
registry.register('ForbiddenErrorResponse', ForbiddenErrorResponseSchema);
registry.register('NotFoundErrorResponse', NotFoundErrorResponseSchema);

// ── Common Domain Schemas ─────────────────────────────────────────────────────
//
// Domain schemas represent the core entities in the CloudCert Pro system.
// They are used in request bodies and response payloads across multiple endpoints.
//
// Registering these as components allows them to be reused via $ref,
// reducing the OpenAPI document size and ensuring consistency.

/**
 * User schema
 *
 * Represents a user account in the system.
 * Includes authentication information, role, and experience points.
 *
 * Fields:
 * - id: Unique identifier (UUID v4)
 * - email: Email address (unique, used for login)
 * - name: Full name for display
 * - role: Either 'user' (learner) or 'admin' (content manager)
 * - xp: Experience points earned through achievements
 * - createdAt: Account creation timestamp (Unix seconds)
 * - updatedAt: Last profile update timestamp (Unix seconds)
 */
export const UserSchema = z
  .object({
    id: z.string().uuid().describe('Unique user identifier'),
    email: z.string().email().describe('User email address'),
    name: z.string().describe('User full name'),
    role: z.enum(['user', 'admin']).describe('User role in the system'),
    xp: z.number().int().min(0).describe('User experience points'),
    createdAt: z.number().int().describe('Unix timestamp of user creation'),
    updatedAt: z.number().int().describe('Unix timestamp of last update'),
  })
  .openapi({
    description: 'User account information',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      name: 'John Doe',
      role: 'user',
      xp: 1250,
      createdAt: 1704067200,
      updatedAt: 1704153600,
    },
  });

/**
 * Certification schema
 *
 * Represents a cloud certification (e.g., AWS SAA, GCP ACE).
 * Contains metadata about the certification and links to official resources.
 *
 * Fields:
 * - id: Unique identifier (UUID v5 from slug)
 * - title: Display name (e.g., "AWS Certified Solutions Architect")
 * - description: Detailed description of the certification
 * - vendor: Cloud provider (AWS, GCP, Azure, etc.)
 * - level: Certification level (Foundational, Associate, Professional, Expert)
 * - examCode: Official exam code (e.g., SAA-C03)
 * - url: Official certification page URL
 * - iconUrl: URL to certification badge/icon
 * - isActive: Whether the certification is available for study
 * - createdAt: When the certification was added to the system
 * - updatedAt: When the certification was last updated
 */
export const CertificationSchema = z
  .object({
    id: z.string().uuid().describe('Unique certification identifier'),
    title: z.string().describe('Certification title'),
    description: z.string().nullable().describe('Certification description'),
    vendor: z.string().nullable().describe('Certification vendor (e.g., AWS, GCP, Azure)'),
    level: z.string().describe('Certification level (e.g., Associate, Professional)'),
    examCode: z.string().nullable().describe('Official exam code'),
    url: z.string().url().nullable().describe('Official certification URL'),
    iconUrl: z.string().url().nullable().describe('Certification icon URL'),
    isActive: z.boolean().describe('Whether the certification is active'),
    createdAt: z.number().int().describe('Unix timestamp of creation'),
    updatedAt: z.number().int().describe('Unix timestamp of last update'),
  })
  .openapi({
    description: 'Cloud certification information',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'AWS Certified Solutions Architect',
      description: 'Design and deploy scalable systems on AWS',
      vendor: 'AWS',
      level: 'Associate',
      examCode: 'SAA-C03',
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      iconUrl: 'https://example.com/aws-saa.png',
      isActive: true,
      createdAt: 1704067200,
      updatedAt: 1704153600,
    },
  });

/**
 * Exam configuration schema
 *
 * Defines the parameters for an exam session (duration, question count, passing score).
 * Multiple exam configurations can exist for a single certification.
 *
 * Fields:
 * - id: Unique identifier for this exam configuration
 * - certificationId: Which certification this exam is for
 * - name: Display name (e.g., "Full-Length Practice Exam")
 * - description: Detailed description of the exam
 * - duration: Time limit in minutes (15-480)
 * - totalQuestions: Number of questions in the exam (5-500)
 * - passingScore: Minimum percentage to pass (0-100)
 * - questionSelectionStrategy: How questions are selected (random, difficulty_balanced, topic_based)
 * - topicWeights: Weights for each topic (used by topic_based strategy)
 * - isActive: Whether this exam configuration is available
 * - createdAt: When the configuration was created
 * - updatedAt: When the configuration was last updated
 */
export const ExamSchema = z
  .object({
    id: z.string().uuid().describe('Unique exam configuration identifier'),
    certificationId: z.string().uuid().describe('Associated certification ID'),
    name: z.string().describe('Exam configuration name'),
    description: z.string().nullable().describe('Exam description'),
    duration: z.number().int().min(15).max(480).describe('Exam duration in minutes'),
    totalQuestions: z.number().int().min(5).max(500).describe('Total number of questions'),
    passingScore: z.number().int().min(0).max(100).describe('Passing score percentage'),
    questionSelectionStrategy: z
      .enum(['random', 'difficulty_balanced', 'topic_based'])
      .describe('Strategy for selecting questions'),
    topicWeights: z.record(z.number()).describe('Topic weights for question selection'),
    isActive: z.boolean().describe('Whether the exam configuration is active'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
  })
  .openapi({
    description: 'Exam configuration defining exam parameters',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'AWS SAA Practice Exam',
      description: 'Full-length practice exam for AWS Solutions Architect Associate',
      duration: 130,
      totalQuestions: 65,
      passingScore: 72,
      questionSelectionStrategy: 'difficulty_balanced',
      topicWeights: { compute: 0.3, storage: 0.2, networking: 0.25, security: 0.25 },
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  });

/**
 * Topic schema
 *
 * Represents a major topic within a certification (e.g., "EC2" in AWS SAA).
 * Topics are organized hierarchically with subtopics.
 *
 * Fields:
 * - id: Unique identifier
 * - certificationId: Which certification this topic belongs to
 * - title: Topic name (e.g., "EC2 - Elastic Compute Cloud")
 * - description: Detailed description of the topic
 * - orderIndex: Display order (0, 1, 2, ...)
 * - isActive: Whether the topic is available for study
 * - docUrl: Link to official documentation
 * - createdAt: When the topic was created
 * - updatedAt: When the topic was last updated
 */
export const TopicSchema = z
  .object({
    id: z.string().uuid().describe('Unique topic identifier'),
    certificationId: z.string().uuid().describe('Associated certification ID'),
    title: z.string().describe('Topic title'),
    description: z.string().nullable().describe('Topic description'),
    orderIndex: z.number().int().min(0).describe('Display order index'),
    isActive: z.boolean().describe('Whether the topic is active'),
    docUrl: z.string().url().nullable().describe('Documentation URL for the topic'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
  })
  .openapi({
    description: 'Topic within a certification',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'EC2 - Elastic Compute Cloud',
      description: 'Virtual servers in the cloud',
      orderIndex: 1,
      isActive: true,
      docUrl: 'https://docs.aws.amazon.com/ec2/',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  });

/**
 * Question schema
 *
 * Represents an exam question with answers and metadata.
 * Questions are organized under topics and optionally subtopics.
 *
 * Fields:
 * - id: Unique identifier
 * - topicId: Which topic this question belongs to
 * - subTopicId: Optional subtopic for finer categorization
 * - questionText: The question text (may include HTML formatting)
 * - questionType: 'single' (one correct answer) or 'multiple' (multiple correct answers)
 * - options: Array of answer options
 * - correctAnswers: Array of correct answer(s)
 * - explanation: Explanation of why the answer is correct
 * - difficulty: Easy, Medium, or Hard
 * - tags: Keywords for categorization (e.g., "networking", "security")
 * - points: Points awarded for correct answer
 * - isActive: Whether the question is available for exams
 * - createdAt: When the question was created
 * - updatedAt: When the question was last updated
 */
export const QuestionSchema = z
  .object({
    id: z.string().uuid().describe('Unique question identifier'),
    topicId: z.string().uuid().describe('Associated topic ID'),
    subTopicId: z.string().uuid().nullable().describe('Associated subtopic ID'),
    questionText: z.string().describe('Question text'),
    questionType: z
      .enum(['single', 'multiple'])
      .describe('Question type (single or multiple choice)'),
    options: z.array(z.string()).describe('Answer options'),
    correctAnswers: z.array(z.string()).describe('Correct answer(s)'),
    explanation: z.string().nullable().describe('Explanation of the correct answer'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('Question difficulty level'),
    tags: z.array(z.string()).describe('Question tags for categorization'),
    points: z.number().int().min(1).describe('Points awarded for correct answer'),
    isActive: z.boolean().describe('Whether the question is active'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
  })
  .openapi({
    description: 'Exam question with answers and metadata',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      topicId: '550e8400-e29b-41d4-a716-446655440003',
      subTopicId: null,
      questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
      questionType: 'single',
      options: ['T3', 'R5', 'C5', 'M5'],
      correctAnswers: ['R5'],
      explanation:
        'R5 instances are memory-optimized and designed for memory-intensive applications.',
      difficulty: 'Medium',
      tags: ['ec2', 'instance-types', 'memory'],
      points: 1,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  });

/**
 * Achievement schema
 *
 * Represents an achievement that users can earn.
 * Achievements are organized by category and tier.
 *
 * Fields:
 * - id: Unique identifier
 * - key: Unique key for programmatic reference (e.g., 'first_exam_completed')
 * - title: Display name (e.g., "First Steps")
 * - description: What the user must do to earn this achievement
 * - category: Category (exam, study, streak, score, social, speed, mastery)
 * - tier: Rarity tier (bronze, silver, gold, platinum, diamond)
 * - iconName: Icon identifier for display
 * - xpReward: Experience points awarded when earned
 * - requiredValue: Threshold value to earn the achievement
 * - isActive: Whether the achievement is available
 * - createdAt: When the achievement was created
 * - updatedAt: When the achievement was last updated
 */
export const AchievementSchema = z
  .object({
    id: z.number().int().describe('Unique achievement identifier'),
    key: z.string().describe('Unique achievement key'),
    title: z.string().describe('Achievement title'),
    description: z.string().describe('Achievement description'),
    category: z
      .enum(['exam', 'study', 'streak', 'score', 'social', 'speed', 'mastery'])
      .describe('Achievement category'),
    tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).describe('Achievement tier'),
    iconName: z.string().describe('Icon name for the achievement'),
    xpReward: z.number().int().min(0).describe('XP reward for completing the achievement'),
    requiredValue: z.number().int().describe('Required value to complete the achievement'),
    isActive: z.boolean().describe('Whether the achievement is active'),
    createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
    updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
  })
  .openapi({
    description: 'User achievement definition',
    example: {
      id: 1,
      key: 'first_exam_completed',
      title: 'First Steps',
      description: 'Complete your first exam',
      category: 'exam',
      tier: 'bronze',
      iconName: 'trophy',
      xpReward: 100,
      requiredValue: 1,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  });

// Register common domain schemas as reusable components
// These schemas are referenced in route definitions via $ref
// This reduces the OpenAPI document size and ensures consistency
registry.register('User', UserSchema);
registry.register('Certification', CertificationSchema);
registry.register('Exam', ExamSchema);
registry.register('Topic', TopicSchema);
registry.register('Question', QuestionSchema);
registry.register('Achievement', AchievementSchema);
