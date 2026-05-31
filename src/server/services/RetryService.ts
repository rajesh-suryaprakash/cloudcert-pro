import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { NotFoundError, ValidationError } from '../errors';

/**
 * RetryService
 * Handles retry missed questions functionality
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

export interface RetrySessionResult {
  newSessionId: string;
  questionCount: number;
}

export class RetryService {
  /**
   * Get incorrect answers from a completed exam session
   * Requirement 14.3: Filter to only incorrect answers
   */
  getIncorrectAnswers(sessionId: string): string[] {
    const incorrectAnswers = db
      .prepare(
        `
        SELECT DISTINCT ea.questionId
        FROM exam_answers ea
        WHERE ea.examSessionId = ? AND ea.isCorrect = 0
        ORDER BY ea.answerOrder
      `,
      )
      .all(sessionId) as Array<{ questionId: string }>;

    return incorrectAnswers.map((a) => a.questionId);
  }

  /**
   * Randomize question order using Fisher-Yates shuffle
   * Requirement 14.4: Randomize question order
   */
  randomizeQuestionOrder(questionIds: string[]): string[] {
    const shuffled = [...questionIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Create a new exam session with specified questions
   * Requirement 14.5: Record retry session separately
   */
  createRetrySession(
    userId: string,
    certificationId: string,
    questionIds: string[],
    _originalSessionId?: string,
  ): string {
    const newSessionId = randomUUID();
    const startTime = new Date().toISOString();
    const autoSubmitAt = new Date(Date.now() + 120 * 60 * 1000).toISOString(); // 2 hours default

    db.prepare(
      `
      INSERT INTO exam_sessions (
        id, userId, certificationId, sessionName, questions, 
        totalQuestions, isPracticeMode, autoSubmitAt, startTime, status
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'in_progress')
    `,
    ).run(
      newSessionId,
      userId,
      certificationId,
      'Retry Missed Questions',
      JSON.stringify(questionIds),
      questionIds.length,
      autoSubmitAt,
      startTime,
    );

    return newSessionId;
  }

  /**
   * Verify session exists, belongs to user, and is completed
   */
  verifySession(
    sessionId: string,
    userId: string,
  ): {
    id: string;
    status: string;
    certificationId: string;
    questions: string;
  } {
    const session = db
      .prepare(
        'SELECT id, status, certificationId, questions FROM exam_sessions WHERE id = ? AND userId = ? LIMIT 1',
      )
      .get(sessionId, userId) as
      | { id: string; status: string; certificationId: string; questions: string }
      | undefined;

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (session.status !== 'completed') {
      throw new ValidationError('Session must be completed to retry missed questions');
    }

    return session;
  }

  /**
   * Main method to create a retry session from a completed session
   * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
   */
  createRetryFromSession(sessionId: string, userId: string): RetrySessionResult {
    // Verify session
    const session = this.verifySession(sessionId, userId);

    // Get incorrect answers (Requirement 14.3)
    const incorrectQuestionIds = this.getIncorrectAnswers(sessionId);

    if (incorrectQuestionIds.length === 0) {
      throw new ValidationError('No incorrect answers found in this session');
    }

    // Randomize question order (Requirement 14.4)
    const randomizedQuestionIds = this.randomizeQuestionOrder(incorrectQuestionIds);

    // Create new session (Requirement 14.5)
    const newSessionId = this.createRetrySession(
      userId,
      session.certificationId,
      randomizedQuestionIds,
      sessionId,
    );

    return {
      newSessionId,
      questionCount: randomizedQuestionIds.length,
    };
  }
}

export default new RetryService();
