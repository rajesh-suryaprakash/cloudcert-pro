import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ── Exam Session Request/Response Schemas ─────────────────────────────────────

/**
 * Create exam session request schema
 */
export const CreateExamSessionRequestSchema = z
  .object({
    examConfigurationId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe('Exam configuration ID (optional for custom quizzes)'),
    certificationId: z.string().uuid().nullable().optional().describe('Certification ID'),
    sessionName: z.string().nullable().optional().describe('Custom session name'),
    questions: z.array(z.string().uuid()).min(1).describe('Array of question IDs for this session'),
    isPracticeMode: z.boolean().optional().describe('Whether this is a practice mode session'),
  })
  .openapi({
    description: 'Create exam session request',
    example: {
      examConfigurationId: '550e8400-e29b-41d4-a716-446655440002',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      sessionName: 'My Practice Exam',
      questions: ['550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011'],
      isPracticeMode: false,
    },
  });

/**
 * Create exam session response schema
 */
export const CreateExamSessionResponseSchema = z
  .object({
    id: z.string().uuid().describe('Exam session ID'),
    examConfigurationId: z.string().uuid().nullable().describe('Exam configuration ID'),
    questions: z.array(z.string().uuid()).describe('Array of question IDs'),
    status: z.enum(['in_progress', 'completed', 'abandoned']).describe('Session status'),
    autoSubmitAt: z.string().datetime().describe('ISO 8601 timestamp when exam will auto-submit'),
  })
  .openapi({
    description: 'Create exam session response',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440020',
      examConfigurationId: '550e8400-e29b-41d4-a716-446655440002',
      questions: ['550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011'],
      status: 'in_progress',
      autoSubmitAt: '2024-01-01T12:00:00Z',
    },
  });

/**
 * Exam session ID path parameter schema
 */
export const ExamSessionIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Exam session ID'),
  })
  .openapi({
    description: 'Exam session ID path parameter',
  });

/**
 * Exam session response schema
 */
export const ExamSessionResponseSchema = z
  .object({
    id: z.string().uuid().describe('Exam session ID'),
    userId: z.string().uuid().describe('User ID'),
    examConfigurationId: z.string().uuid().nullable().describe('Exam configuration ID'),
    certificationId: z.string().uuid().nullable().describe('Certification ID'),
    sessionName: z.string().nullable().describe('Session name'),
    questions: z.array(z.string().uuid()).describe('Array of question IDs'),
    totalQuestions: z.number().int().min(1).describe('Total number of questions'),
    status: z.enum(['in_progress', 'completed', 'abandoned']).describe('Session status'),
    score: z.number().int().min(0).max(100).nullable().describe('Final score percentage'),
    isPracticeMode: z.boolean().describe('Whether this is a practice mode session'),
    autoSubmitAt: z.string().datetime().describe('ISO 8601 timestamp when exam will auto-submit'),
    startTime: z.string().datetime().describe('ISO 8601 timestamp of session start'),
    endTime: z.string().datetime().nullable().describe('ISO 8601 timestamp of session end'),
    answers: z
      .array(
        z.object({
          id: z.number().int().describe('Answer ID'),
          examSessionId: z.string().uuid().describe('Exam session ID'),
          questionId: z.string().uuid().describe('Question ID'),
          userAnswer: z
            .union([z.string(), z.array(z.string())])
            .nullable()
            .describe('User answer(s)'),
          isCorrect: z.boolean().nullable().describe('Whether the answer is correct'),
          markedForReview: z.boolean().describe('Whether marked for review'),
          confidenceLevel: z
            .number()
            .int()
            .min(1)
            .max(5)
            .nullable()
            .describe('Confidence level (1-5)'),
          answerOrder: z.number().int().min(0).describe('Order in which question was answered'),
          timeSpent: z.number().int().min(0).describe('Time spent on question in seconds'),
          createdAt: z.string().datetime().describe('ISO 8601 timestamp of answer creation'),
          updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
        }),
      )
      .describe('Array of user answers'),
  })
  .openapi({
    description: 'Exam session with answers',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440020',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      examConfigurationId: '550e8400-e29b-41d4-a716-446655440002',
      certificationId: '550e8400-e29b-41d4-a716-446655440001',
      sessionName: 'My Practice Exam',
      questions: ['550e8400-e29b-41d4-a716-446655440010'],
      totalQuestions: 1,
      status: 'in_progress',
      score: null,
      isPracticeMode: false,
      autoSubmitAt: '2024-01-01T12:00:00Z',
      startTime: '2024-01-01T10:00:00Z',
      endTime: null,
      answers: [],
    },
  });

/**
 * Exam sessions list response schema
 */
export const ExamSessionsListResponseSchema = z
  .array(
    z.object({
      id: z.string().uuid().describe('Exam session ID'),
      userId: z.string().uuid().describe('User ID'),
      examConfigurationId: z.string().uuid().nullable().describe('Exam configuration ID'),
      certificationId: z.string().uuid().nullable().describe('Certification ID'),
      sessionName: z.string().nullable().describe('Session name'),
      questions: z.array(z.string().uuid()).describe('Array of question IDs'),
      totalQuestions: z.number().int().min(1).describe('Total number of questions'),
      status: z.enum(['in_progress', 'completed', 'abandoned']).describe('Session status'),
      score: z.number().int().min(0).max(100).nullable().describe('Final score percentage'),
      isPracticeMode: z.boolean().describe('Whether this is a practice mode session'),
      autoSubmitAt: z.string().datetime().describe('ISO 8601 timestamp when exam will auto-submit'),
      startTime: z.string().datetime().describe('ISO 8601 timestamp of session start'),
      endTime: z.string().datetime().nullable().describe('ISO 8601 timestamp of session end'),
    }),
  )
  .openapi({
    description: 'List of exam sessions',
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        examConfigurationId: '550e8400-e29b-41d4-a716-446655440002',
        certificationId: '550e8400-e29b-41d4-a716-446655440001',
        sessionName: 'My Practice Exam',
        questions: ['550e8400-e29b-41d4-a716-446655440010'],
        totalQuestions: 1,
        status: 'completed',
        score: 85,
        isPracticeMode: false,
        autoSubmitAt: '2024-01-01T12:00:00Z',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:30:00Z',
      },
    ],
  });

// ── Submit Answer Request/Response Schemas ────────────────────────────────────

/**
 * Submit answer request schema
 */
export const SubmitAnswerRequestSchema = z
  .object({
    questionId: z.string().uuid().describe('Question ID'),
    userAnswer: z
      .union([z.string(), z.array(z.string())])
      .nullable()
      .describe('User answer(s) - string for single choice, array for multiple choice'),
    markedForReview: z.boolean().optional().describe('Whether to mark this question for review'),
    confidenceLevel: z
      .number()
      .int()
      .min(1)
      .max(5)
      .nullable()
      .optional()
      .describe('Confidence level (1-5)'),
    answerOrder: z.number().int().min(0).describe('Order in which question was answered'),
    timeSpent: z.number().int().min(0).describe('Time spent on question in seconds'),
  })
  .openapi({
    description: 'Submit answer request',
    example: {
      questionId: '550e8400-e29b-41d4-a716-446655440010',
      userAnswer: 'R5',
      markedForReview: false,
      confidenceLevel: 4,
      answerOrder: 0,
      timeSpent: 45,
    },
  });

/**
 * Submit answer response schema
 */
export const SubmitAnswerResponseSchema = z
  .object({
    id: z.number().int().describe('Answer ID'),
  })
  .openapi({
    description: 'Submit answer response',
    example: {
      id: 1,
    },
  });

// ── Submit Exam Request/Response Schemas ──────────────────────────────────────

/**
 * Submit exam response schema
 */
export const SubmitExamResponseSchema = z
  .object({
    score: z.number().int().min(0).max(100).describe('Final score percentage'),
    passed: z.boolean().describe('Whether the exam was passed'),
    correctAnswers: z.number().int().min(0).describe('Number of correct answers'),
    incorrectAnswers: z.number().int().min(0).describe('Number of incorrect answers'),
    unansweredQuestions: z.number().int().min(0).describe('Number of unanswered questions'),
    xpAwarded: z.number().int().min(0).describe('Experience points awarded'),
    detailedResults: z
      .array(
        z.object({
          questionId: z.string().uuid().describe('Question ID'),
          isCorrect: z.boolean().describe('Whether the answer is correct'),
          userAnswer: z
            .union([z.string(), z.array(z.string())])
            .nullable()
            .describe('User answer(s)'),
          correctAnswers: z.array(z.string()).describe('Correct answer(s)'),
        }),
      )
      .describe('Detailed results for each question'),
    percentileRank: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .describe('Percentile rank compared to other attempts'),
  })
  .openapi({
    description: 'Submit exam response with grading results',
    example: {
      score: 85,
      passed: true,
      correctAnswers: 55,
      incorrectAnswers: 10,
      unansweredQuestions: 0,
      xpAwarded: 500,
      detailedResults: [
        {
          questionId: '550e8400-e29b-41d4-a716-446655440010',
          isCorrect: true,
          userAnswer: 'R5',
          correctAnswers: ['R5'],
        },
      ],
      percentileRank: 75,
    },
  });

// ── Exam ID Path Parameter Schema ────────────────────────────────────────────

/**
 * Exam ID path parameter schema
 */
export const ExamIdParamSchema = z
  .object({
    examId: z.string().uuid().describe('Exam configuration ID'),
  })
  .openapi({
    description: 'Exam configuration ID path parameter',
  });

// ── Session ID Path Parameter Schema ─────────────────────────────────────────

/**
 * Session ID path parameter schema
 */
export const SessionIdParamSchema = z
  .object({
    sessionId: z.string().uuid().describe('Exam session ID'),
  })
  .openapi({
    description: 'Exam session ID path parameter',
  });

// ── Questions List Response Schema ───────────────────────────────────────────

/**
 * Questions list response schema
 */
export const QuestionsListResponseSchema = z
  .array(
    z.object({
      id: z.string().uuid().describe('Question ID'),
      topicId: z.string().uuid().describe('Topic ID'),
      subTopicId: z.string().uuid().nullable().describe('Subtopic ID'),
      questionText: z.string().describe('Question text'),
      questionType: z.enum(['single', 'multiple']).describe('Question type'),
      options: z.array(z.string()).describe('Answer options'),
      correctAnswers: z.array(z.string()).describe('Correct answer(s)'),
      explanation: z.string().nullable().describe('Explanation of correct answer'),
      difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe('Question difficulty'),
      tags: z.array(z.string()).describe('Question tags'),
      points: z.number().int().min(1).describe('Points for correct answer'),
      isActive: z.boolean().describe('Whether question is active'),
      createdAt: z.string().datetime().describe('ISO 8601 timestamp of creation'),
      updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
    }),
  )
  .openapi({
    description: 'List of questions',
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        topicId: '550e8400-e29b-41d4-a716-446655440003',
        subTopicId: null,
        questionText: 'Which EC2 instance type is optimized for memory-intensive applications?',
        questionType: 'single',
        options: ['T3', 'R5', 'C5', 'M5'],
        correctAnswers: ['R5'],
        explanation: 'R5 instances are memory-optimized.',
        difficulty: 'Medium',
        tags: ['ec2', 'instance-types'],
        points: 1,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ],
  });

// ── Abandon Exam Response Schema ─────────────────────────────────────────────

/**
 * Abandon exam response schema
 */
export const AbandonExamResponseSchema = z
  .object({
    ok: z.boolean().describe('Whether the operation was successful'),
  })
  .openapi({
    description: 'Abandon exam response',
    example: {
      ok: true,
    },
  });

// ── Attempts List Response Schema ────────────────────────────────────────────

/**
 * Attempts list response schema
 */
export const AttemptsListResponseSchema = z
  .array(
    z.object({
      id: z.string().uuid().describe('Exam session ID'),
      userId: z.string().uuid().describe('User ID'),
      examId: z.string().uuid().nullable().describe('Exam configuration ID'),
      examConfigurationId: z.string().uuid().nullable().describe('Exam configuration ID'),
      certificationId: z.string().uuid().nullable().describe('Certification ID'),
      sessionName: z.string().nullable().describe('Session name'),
      questions: z.array(z.string().uuid()).describe('Array of question IDs'),
      totalQuestions: z.number().int().min(1).describe('Total number of questions'),
      status: z.enum(['in_progress', 'completed', 'abandoned']).describe('Session status'),
      score: z.number().int().min(0).max(100).nullable().describe('Final score percentage'),
      isPracticeMode: z.boolean().describe('Whether this is a practice mode session'),
      autoSubmitAt: z.string().datetime().describe('ISO 8601 timestamp when exam will auto-submit'),
      startTime: z.string().datetime().describe('ISO 8601 timestamp of session start'),
      endTime: z.string().datetime().nullable().describe('ISO 8601 timestamp of session end'),
      answers: z.array(z.any()).describe('Simplified answers array for backward compatibility'),
    }),
  )
  .openapi({
    description: 'List of exam attempts (backward compatibility endpoint)',
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        examId: '550e8400-e29b-41d4-a716-446655440002',
        examConfigurationId: '550e8400-e29b-41d4-a716-446655440002',
        certificationId: '550e8400-e29b-41d4-a716-446655440001',
        sessionName: 'My Practice Exam',
        questions: ['550e8400-e29b-41d4-a716-446655440010'],
        totalQuestions: 1,
        status: 'completed',
        score: 85,
        isPracticeMode: false,
        autoSubmitAt: '2024-01-01T12:00:00Z',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:30:00Z',
        answers: [],
      },
    ],
  });

// ── Pause Exam Response Schema ───────────────────────────────────────────────

/**
 * Pause exam response schema
 */
export const PauseExamResponseSchema = z
  .object({
    ok: z.boolean().describe('Whether the operation was successful'),
    status: z.enum(['paused']).describe('New session status'),
  })
  .openapi({
    description: 'Pause exam response',
    example: {
      ok: true,
      status: 'paused',
    },
  });

// ── Resume Exam Response Schema ──────────────────────────────────────────────

/**
 * Resume exam response schema
 */
export const ResumeExamResponseSchema = z
  .object({
    ok: z.boolean().describe('Whether the operation was successful'),
    status: z.enum(['in_progress']).describe('New session status'),
    autoSubmitAt: z.string().datetime().describe('Updated ISO 8601 timestamp for auto-submission'),
    timeLeftSeconds: z.number().int().min(0).describe('Remaining seconds left in the exam'),
  })
  .openapi({
    description: 'Resume exam response',
    example: {
      ok: true,
      status: 'in_progress',
      autoSubmitAt: '2024-01-01T12:30:00Z',
      timeLeftSeconds: 1800,
    },
  });

// Register all exam schemas
registry.register('CreateExamSessionRequest', CreateExamSessionRequestSchema);
registry.register('CreateExamSessionResponse', CreateExamSessionResponseSchema);
registry.register('ExamSessionIdParam', ExamSessionIdParamSchema);
registry.register('ExamSessionResponse', ExamSessionResponseSchema);
registry.register('ExamSessionsListResponse', ExamSessionsListResponseSchema);
registry.register('SubmitAnswerRequest', SubmitAnswerRequestSchema);
registry.register('SubmitAnswerResponse', SubmitAnswerResponseSchema);
registry.register('SubmitExamResponse', SubmitExamResponseSchema);
registry.register('ExamIdParam', ExamIdParamSchema);
registry.register('SessionIdParam', SessionIdParamSchema);
registry.register('QuestionsList', QuestionsListResponseSchema);
registry.register('AbandonExamResponse', AbandonExamResponseSchema);
registry.register('AttemptsList', AttemptsListResponseSchema);
registry.register('PauseExamResponse', PauseExamResponseSchema);
registry.register('ResumeExamResponse', ResumeExamResponseSchema);
