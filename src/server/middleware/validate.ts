import { z } from 'zod';
import type { RequestHandler } from 'express';

/**
 * Creates an Express middleware that validates req.body against the given Zod schema.
 * On failure: responds with HTTP 400 and { error: "<message>" }.
 * On success: sets req.body to the parsed value and calls next().
 */
export function validate<T>(schema: z.ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error.issues[0].message });
      return;
    }
    req.body = result.data;
    next();
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/\d/, 'Password must contain at least one number'),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/\d/, 'Password must contain at least one number'),
});

export const createCertificationSchema = z.object({
  title: z
    .string()
    .min(5, 'title must be at least 5 characters')
    .max(255, 'title must be at most 255 characters'),
});

export const createExamConfigSchema = z.object({
  name: z
    .string()
    .min(5, 'name must be at least 5 characters')
    .max(255, 'name must be at most 255 characters'),
  description: z.string().max(1000).optional(),
  duration: z
    .number()
    .int()
    .min(15, 'duration must be at least 15')
    .max(480, 'duration must be at most 480'),
  totalQuestions: z
    .number()
    .int()
    .min(5, 'totalQuestions must be at least 5')
    .max(500, 'totalQuestions must be at most 500'),
  passingScore: z
    .number()
    .int()
    .min(0, 'passingScore must be at least 0')
    .max(100, 'passingScore must be at most 100'),
  questionSelectionStrategy: z
    .enum(['random', 'difficulty_balanced', 'topic_based'])
    .optional()
    .default('random'),
  topicWeights: z.record(z.number()).optional().default({}),
});

export const patchExamConfigSchema = createExamConfigSchema.partial();

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid('questionId must be a valid UUID'),
  userAnswer: z.union([z.string(), z.array(z.string())]).nullable(),
  markedForReview: z.boolean().optional().default(false),
  confidenceLevel: z.number().int().min(1).max(5).nullable().optional(),
  answerOrder: z.number().int().min(0).optional().default(0),
  timeSpent: z.number().int().min(0).max(86400).optional(),
});

export const createSessionSchema = z.object({
  examConfigurationId: z.string().uuid('examConfigurationId must be a valid UUID').optional(),
  certificationId: z.string().uuid('certificationId must be a valid UUID').optional(),
  sessionName: z.string().max(255).optional(),
  questions: z
    .array(z.string().uuid('each question ID must be a valid UUID'))
    .min(1, 'questions must contain at least one item')
    .max(500, 'questions must contain at most 500 items'),
  isPracticeMode: z.boolean().optional().default(false),
  // Wizard overrides — take priority over the exam config's stored values
  durationMinutes: z
    .number()
    .int()
    .min(1, 'durationMinutes must be at least 1')
    .max(480, 'durationMinutes must be at most 480')
    .optional(),
  passingScore: z
    .number()
    .int()
    .min(0, 'passingScore must be at least 0')
    .max(100, 'passingScore must be at most 100')
    .optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().min(1, 'Reset code is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/\d/, 'Password must contain at least one number'),
});

export const updateTopicSchema = z.object({
  title: z
    .string()
    .min(1, 'title is required')
    .max(255, 'title must be at most 255 characters')
    .optional(),
  description: z.string().max(1000, 'description must be at most 1000 characters').optional(),
  orderIndex: z.number().int().min(0, 'orderIndex must be non-negative').optional(),
  isActive: z.boolean().optional(),
  docUrl: z
    .string()
    .startsWith('https://', 'docUrl must start with https://')
    .nullable()
    .optional(),
  // New fields for unified domain weight management
  weightPercentage: z
    .number()
    .min(0, 'weightPercentage must be at least 0')
    .max(100, 'weightPercentage must be at most 100')
    .optional(),
});

// ── Schemas added to cover previously-unvalidated mutation routes ─────────────

/** PUT /certifications/:id */
export const updateCertificationSchema = z.object({
  title: z
    .string()
    .min(5, 'title must be at least 5 characters')
    .max(255, 'title must be at most 255 characters')
    .optional(),
  vendor: z.string().min(1, 'vendor is required').max(100).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

/** POST /certifications/:certificationId/topics */
export const createTopicSchema = z.object({
  title: z
    .string()
    .min(2, 'title must be at least 2 characters')
    .max(255, 'title must be at most 255 characters'),
  description: z.string().max(1000).optional(),
  orderIndex: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  docUrl: z
    .string()
    .startsWith('https://', 'docUrl must start with https://')
    .nullable()
    .optional(),
  weightPercentage: z
    .number()
    .min(0, 'weightPercentage must be at least 0')
    .max(100, 'weightPercentage must be at most 100')
    .optional(),
});

/** POST /topics/:topicId/subtopics */
export const createSubTopicSchema = z.object({
  title: z
    .string()
    .min(2, 'title must be at least 2 characters')
    .max(255, 'title must be at most 255 characters'),
  description: z.string().max(1000).optional(),
  orderIndex: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

/** PUT /subtopics/:id */
export const updateSubTopicSchema = z.object({
  title: z
    .string()
    .min(2, 'title must be at least 2 characters')
    .max(255, 'title must be at most 255 characters')
    .optional(),
  description: z.string().max(1000).optional(),
  orderIndex: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** POST /questions and PUT /questions/:id */
export const questionSchema = z.object({
  topicId: z.string().uuid('topicId must be a valid UUID'),
  subTopicId: z.string().uuid('subTopicId must be a valid UUID').nullable().optional(),
  unitId: z.string().uuid('unitId must be a valid UUID').nullable().optional(),
  questionText: z.string().min(10, 'questionText must be at least 10 characters').max(5000),
  questionType: z.enum(['single', 'multiple'], {
    message: 'questionType must be single or multiple',
  }),
  options: z.array(z.string().min(1)).min(2, 'at least 2 options required').max(10),
  correctAnswers: z.array(z.string().min(1)).min(1, 'at least 1 correct answer required'),
  explanation: z.string().max(5000).optional().nullable(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'], {
    message: 'difficulty must be Easy, Medium, or Hard',
  }),
  tags: z.array(z.string()).optional().default([]),
  points: z.number().int().min(1).max(100).optional().default(1),
  isActive: z.boolean().optional().default(true),
});
