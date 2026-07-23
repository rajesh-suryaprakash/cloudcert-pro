import { registerPath } from './registry.js';
import {
  CreateExamSessionRequestSchema,
  CreateExamSessionResponseSchema,
  ExamSessionIdParamSchema,
  ExamSessionResponseSchema,
  ExamSessionsListResponseSchema,
  SubmitAnswerRequestSchema,
  SubmitAnswerResponseSchema,
  SubmitExamResponseSchema,
  ExamIdParamSchema,
  SessionIdParamSchema,
  QuestionsListResponseSchema,
  AbandonExamResponseSchema,
  AttemptsListResponseSchema,
  PauseExamResponseSchema,
  ResumeExamResponseSchema,
} from './exam-schemas.js';
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from './schemas.js';

/**
 * Register all exam route endpoints with OpenAPI metadata
 */
export function registerExamRoutes(): void {
  // POST /api/exam-sessions
  registerPath({
    method: 'post',
    path: '/api/exam-sessions',
    summary: 'Create a new exam session',
    description: 'Start a new exam session with specified questions. Requires authentication.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateExamSessionRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Exam session created successfully',
        content: {
          'application/json': {
            schema: CreateExamSessionResponseSchema,
          },
        },
      },
      400: {
        description:
          'Validation error - invalid input data or question IDs do not belong to exam configuration',
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

  // GET /api/exam-sessions/:id
  registerPath({
    method: 'get',
    path: '/api/exam-sessions/{id}',
    summary: 'Get exam session by ID',
    description:
      'Retrieve a specific exam session with all answers. Requires authentication and user must own the session.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamSessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam session retrieved successfully',
        content: {
          'application/json': {
            schema: ExamSessionResponseSchema,
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
        description: 'Forbidden - session does not belong to authenticated user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // POST /api/exam-sessions/:id/answers
  registerPath({
    method: 'post',
    path: '/api/exam-sessions/{id}/answers',
    summary: 'Submit an answer for a question',
    description:
      'Submit or update an answer for a specific question in an exam session. Requires authentication and user must own the session.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamSessionIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: SubmitAnswerRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Answer submitted successfully',
        content: {
          'application/json': {
            schema: SubmitAnswerResponseSchema,
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
        description: 'Forbidden - session does not belong to authenticated user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // POST /api/exam-sessions/:id/submit
  registerPath({
    method: 'post',
    path: '/api/exam-sessions/{id}/submit',
    summary: 'Submit exam for grading',
    description:
      'Submit an exam session for grading and receive results. Requires authentication and user must own the session.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamSessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam submitted and graded successfully',
        content: {
          'application/json': {
            schema: SubmitExamResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - session already submitted',
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
        description: 'Forbidden - session does not belong to authenticated user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // POST /api/exams/:id/submit (backward compatibility)
  registerPath({
    method: 'post',
    path: '/api/exams/{id}/submit',
    summary: 'Submit exam for grading (backward compatibility)',
    description:
      'Submit an exam session for grading and receive results. Requires authentication and user must own the session. This is a backward compatibility endpoint.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamSessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam submitted and graded successfully',
        content: {
          'application/json': {
            schema: SubmitExamResponseSchema,
          },
        },
      },
      400: {
        description: 'Validation error - session already submitted',
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
        description: 'Forbidden - session does not belong to authenticated user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // GET /api/exam-sessions
  registerPath({
    method: 'get',
    path: '/api/exam-sessions',
    summary: 'Get all exam sessions for authenticated user',
    description:
      'Retrieve a list of all exam sessions belonging to the authenticated user. Requires authentication.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'List of exam sessions retrieved successfully',
        content: {
          'application/json': {
            schema: ExamSessionsListResponseSchema,
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

  // GET /api/exams/:id/questions
  registerPath({
    method: 'get',
    path: '/api/exams/{id}/questions',
    summary: 'Get questions for an exam configuration',
    description:
      'Retrieve all questions associated with a specific exam configuration. Public endpoint.',
    tags: ['Exams'],
    security: [],
    request: {
      params: ExamIdParamSchema,
    },
    responses: {
      200: {
        description: 'Questions retrieved successfully',
        content: {
          'application/json': {
            schema: QuestionsListResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam configuration not found',
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

  // GET /api/exam-sessions/:id/questions
  registerPath({
    method: 'get',
    path: '/api/exam-sessions/{id}/questions',
    summary: 'Get questions for an exam session',
    description:
      'Retrieve all questions associated with a specific exam session for historical review. Requires authentication and user must own the session.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: SessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Questions retrieved successfully',
        content: {
          'application/json': {
            schema: QuestionsListResponseSchema,
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
        description: 'Forbidden - session does not belong to authenticated user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // POST /api/exam-sessions/:id/abandon
  registerPath({
    method: 'post',
    path: '/api/exam-sessions/{id}/abandon',
    summary: 'Abandon an exam session',
    description:
      'Abandon an in-progress exam session. Requires authentication and user must own the session.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: SessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam session abandoned successfully',
        content: {
          'application/json': {
            schema: AbandonExamResponseSchema,
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
        description: 'Forbidden - session does not belong to authenticated user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // GET /api/attempts
  registerPath({
    method: 'get',
    path: '/api/attempts',
    summary: 'Get all exam attempts for authenticated user',
    description:
      'Retrieve a list of all exam attempts (backward compatibility endpoint). Requires authentication.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: 'List of exam attempts retrieved successfully',
        content: {
          'application/json': {
            schema: AttemptsListResponseSchema,
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

  // POST /api/exam-sessions/:id/pause
  registerPath({
    method: 'post',
    path: '/api/exam-sessions/{id}/pause',
    summary: 'Pause an in-progress exam session',
    description:
      'Pauses an in-progress exam session, locking answers and freezing remaining time. Enforces limits (max 3 pauses, max 30min duration). Requires authentication.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamSessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam session paused successfully',
        content: {
          'application/json': {
            schema: PauseExamResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad request - e.g. practice mode session or already paused',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
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
        description: 'Forbidden - session does not belong to user or pause limits exceeded',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
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

  // POST /api/exam-sessions/:id/resume
  registerPath({
    method: 'post',
    path: '/api/exam-sessions/{id}/resume',
    summary: 'Resume a paused exam session',
    description:
      'Resumes a paused exam session, shifting the auto-submit deadline by the duration of the pause. Requires authentication.',
    tags: ['Exams'],
    security: [{ cookieAuth: [] }],
    request: {
      params: ExamSessionIdParamSchema,
    },
    responses: {
      200: {
        description: 'Exam session resumed successfully',
        content: {
          'application/json': {
            schema: ResumeExamResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad request - session is not paused',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
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
        description: 'Forbidden - session does not belong to user',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Exam session not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      409: {
        description: 'Conflict - failed to resume session',
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
