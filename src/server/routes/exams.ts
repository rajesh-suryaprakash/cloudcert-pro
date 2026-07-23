import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/connection';
import { authenticate, requireUser } from '../middleware/auth';
import { updateUserStreak, checkAchievements } from '../services/achievements';
import { SrsService } from '../services/srs';
import { ExamSessionRepository } from '../repositories/ExamSessionRepository';
import { ExamAnswerRepository } from '../repositories/ExamAnswerRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ExamGradingService } from '../services/ExamGradingService';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import {
  computeConfidenceMatrix,
  type ConfidenceMatrix,
  type AnswerForMatrix,
} from '../utils/examUtils';
import { nowIso, nowMs } from '../utils/time';
import { NotFoundError, ValidationError } from '../errors';
import { validate, submitAnswerSchema, createSessionSchema } from '../middleware/validate';
import { questionRowsToQuestions } from '../utils/questionTransforms';
import { cacheService } from '../services/CacheService';
import { selectQuestions, type SelectionConfig } from '../services/QuestionSelector';
import { logger } from '../logger';
import { shuffleQuestions } from '../utils/questionShuffle';

export type { ConfidenceMatrix, AnswerForMatrix };
export { computeConfidenceMatrix };

const sessionRepo = new ExamSessionRepository(db);
const answerRepo = new ExamAnswerRepository(db);
const questionRepo = new QuestionRepository(db);
const userRepo = new UserRepository(db);
const srsService = new SrsService(db);
const gradingService = new ExamGradingService();
const questionHistoryService = new QuestionHistoryService(db);

const router = express.Router();

/**
 * Computes the autoSubmitAt timestamp for an exam session.
 * @param startTime - session start time in ms (Date.getTime())
 * @param durationMinutes - exam duration in minutes
 * @returns ISO string of the deadline
 */
export function computeAutoSubmitAt(startTime: number, durationMinutes: number): string {
  return new Date(startTime + durationMinutes * 60 * 1000).toISOString();
}

/**
 * Computes the percentile rank for a given score against a list of prior scores.
 * Returns an integer 0–100 representing the percentage of prior scores strictly
 * lower than the target score, or null when there are no prior scores.
 */
export function computePercentileRank(priorScores: number[], targetScore: number): number | null {
  if (priorScores.length === 0) return null;
  const lowerCount = priorScores.filter((s) => s < targetScore).length;
  return Math.round((lowerCount / priorScores.length) * 100);
}

// Exam Sessions
router.get('/exam-sessions', authenticate, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  const userId = requireUser(req).id;

  const sessions = sessionRepo.findByUser(userId, limit, offset);
  const total = sessionRepo.countByUser(userId);
  res.setHeader('X-Total-Count', total);

  const parsedSessions = sessions.map((s) => ({
    ...s,
    parsedQuestions: JSON.parse(s.questions) as string[],
  }));

  const allQuestionIds = parsedSessions.flatMap((s) => s.parsedQuestions);

  // Build a questionId → difficulty lookup map from a single DB query
  const difficultyMap = new Map<string, string>();
  if (allQuestionIds.length > 0) {
    const placeholders = allQuestionIds.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT id, difficulty FROM questions WHERE id IN (${placeholders})`)
      .all(...allQuestionIds) as Array<{ id: string; difficulty: string }>;
    for (const row of rows) {
      difficultyMap.set(row.id, row.difficulty);
    }
  }

  const enhancedSessions = parsedSessions.map((s) => {
    const { parsedQuestions, ...sessionData } = s;
    const uniqueDifficulties = new Set(
      parsedQuestions.map((id) => difficultyMap.get(id)).filter(Boolean),
    );
    const sessionDifficulty = uniqueDifficulties.size === 1 ? [...uniqueDifficulties][0] : 'Mixed';

    return { ...sessionData, questions: parsedQuestions, difficulty: sessionDifficulty };
  });

  res.json(enhancedSessions);
});

router.get('/exam-sessions/:id', authenticate, (req: Request, res: Response) => {
  const session = sessionRepo.findById(req.params.id, requireUser(req).id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const answers = answerRepo.findBySession(req.params.id);

  // Compute remaining seconds so the client can restore the countdown after a
  // refresh (or if the session is paused and reopened).
  let timeLeftSeconds: number | null = null;
  if (session.status === 'in_progress') {
    const deadline = new Date(session.autoSubmitAt).getTime();
    timeLeftSeconds = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  } else if (session.status === 'paused' && session.pausedAt) {
    // While paused the deadline is NOT ticking — return how many seconds were
    // left at the moment the session was paused.
    const deadline = new Date(session.autoSubmitAt).getTime();
    const pausedAtMs = new Date(session.pausedAt).getTime();
    timeLeftSeconds = Math.max(0, Math.floor((deadline - pausedAtMs) / 1000));
  }

  res.json({
    ...session,
    questions: JSON.parse(session.questions),
    answers: answers.map((a) => ({ ...a, userAnswer: JSON.parse(a.userAnswer || 'null') })),
    timeLeftSeconds,
  });
});

router.post(
  '/exam-sessions',
  authenticate,
  validate(createSessionSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        examConfigurationId,
        certificationId,
        sessionName,
        questions,
        isPracticeMode,
        // Wizard overrides — take priority over exam config DB values
        durationMinutes: wizardDuration,
        passingScore: wizardPassingScore,
      } = req.body;

      // If tied to an exam config, verify all question IDs belong to that config
      if (examConfigurationId) {
        const validIds = questionRepo.findIdsByExamConfig(examConfigurationId, questions);
        if (validIds.length !== questions.length) {
          return next(
            new ValidationError(
              'One or more question IDs do not belong to the specified exam configuration',
            ),
          );
        }
      }

      const id = crypto.randomUUID();
      const startMs = nowMs();
      const startIso = nowIso();

      // Resolve certification ID from exam configuration if needed
      let resolvedCertificationId = certificationId;
      if (!resolvedCertificationId && examConfigurationId) {
        const config = sessionRepo.findConfig(examConfigurationId);
        resolvedCertificationId = config?.certificationId ?? null;
      }

      // Determine duration: wizard override > exam config > default 120 minutes
      let durationMinutes = 120;
      if (wizardDuration !== undefined && wizardDuration !== null) {
        // Wizard's choice takes priority
        durationMinutes = wizardDuration;
      } else if (examConfigurationId) {
        const duration = sessionRepo.findConfigDuration(examConfigurationId);
        if (duration !== null && duration !== undefined) {
          durationMinutes = duration;
        }
      }

      // Store wizard's passingScore override so submit can use it
      // We persist it in the session row so grading uses the right threshold
      const resolvedPassingScore = wizardPassingScore !== undefined ? wizardPassingScore : null;

      const autoSubmitAt = computeAutoSubmitAt(startMs, durationMinutes);

      const currentUser = requireUser(req);
      sessionRepo.create({
        id,
        userId: currentUser.id,
        examConfigurationId: examConfigurationId ?? null,
        certificationId: resolvedCertificationId,
        sessionName: sessionName ?? null,
        questions: JSON.stringify(questions),
        totalQuestions: questions.length,
        isPracticeMode: isPracticeMode ? 1 : 0,
        autoSubmitAt,
        startTime: startIso,
        passingScoreOverride: resolvedPassingScore,
      });

      // Record question history after successful session creation
      // Requirements: 1.1, 1.2, 1.4
      try {
        // Record history if we have a certification ID
        if (resolvedCertificationId) {
          questionHistoryService.recordQuestionsSeen(
            currentUser.id,
            resolvedCertificationId,
            questions,
          );
        }
      } catch (historyError) {
        // Log error but don't block session creation
        logger.error({ err: historyError }, 'Failed to record question history');
      }

      res.json({ id, examConfigurationId, questions, status: 'in_progress', autoSubmitAt });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/exam-sessions/:id/answers',
  authenticate,
  validate(submitAnswerSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify the session belongs to the authenticated user before writing
      const session = sessionRepo.findById(req.params.id, requireUser(req).id);
      if (!session) return next(new NotFoundError('Session not found'));

      const { questionId, userAnswer, markedForReview, confidenceLevel, answerOrder, timeSpent } =
        req.body;

      const id = answerRepo.upsert({
        examSessionId: req.params.id,
        questionId,
        userAnswer,
        markedForReview: !!markedForReview,
        confidenceLevel: confidenceLevel ?? null,
        answerOrder,
        timeSpent,
      });

      res.json({ id });
    } catch (err) {
      next(err);
    }
  },
);

// Questions for Exam
// Accepts optional query params that let the session-creation wizard override the
// exam config defaults:
//   ?count=<n>        — number of questions to select (wizard's numQuestions)
//   ?difficulty=<d>   — pre-filter pool to Easy|Medium|Hard before selection
// These are intentionally query params (not body) because this is a GET request.
router.get('/exams/:id/questions', authenticate, (req, res) => {
  const config = sessionRepo.findConfig(req.params.id);
  if (!config) return res.status(404).json({ error: 'Exam configuration not found' });

  let pool = questionRepo.findByCertification(config.certificationId);

  // Apply optional difficulty pre-filter from wizard override
  const difficultyOverride = req.query.difficulty as string | undefined;
  if (difficultyOverride && difficultyOverride !== 'Mixed') {
    pool = pool.filter((q) => q.difficulty === difficultyOverride);
    if (pool.length === 0) {
      return res.status(400).json({
        error: `No active questions with difficulty "${difficultyOverride}" for this exam`,
      });
    }
  }

  // Wizard's numQuestions takes priority over the exam config's totalQuestions
  const countOverride =
    req.query.count !== undefined ? parseInt(req.query.count as string, 10) : NaN;
  const totalQuestions =
    !isNaN(countOverride) && countOverride >= 1
      ? Math.min(countOverride, pool.length) // never ask for more than the pool has
      : config.totalQuestions;

  let topicWeights: Record<string, number> = {};

  // Try to parse explicit topicWeights from exam config first
  if (config.topicWeights) {
    try {
      const parsed = JSON.parse(config.topicWeights);
      if (parsed && Object.keys(parsed).length > 0) {
        topicWeights = parsed;
      }
    } catch {
      logger.warn('[QuestionSelector] Failed to parse topicWeights, will derive from topics');
    }
  }

  // If no explicit weights and strategy is topic_based, derive from topic weightPercentage
  if (
    Object.keys(topicWeights).length === 0 &&
    config.questionSelectionStrategy === 'topic_based'
  ) {
    const topics = db
      .prepare(
        'SELECT id, weightPercentage FROM topics WHERE certificationId = ? AND isActive = 1 AND weightPercentage > 0',
      )
      .all(config.certificationId) as Array<{ id: string; weightPercentage: number }>;

    if (topics.length > 0) {
      const total = topics.reduce((s, t) => s + t.weightPercentage, 0);
      // Normalise to 0-1 scale so QuestionSelector's largestRemainder works correctly
      topicWeights = Object.fromEntries(topics.map((t) => [t.id, t.weightPercentage / total]));
    }
  }

  const selectionConfig: SelectionConfig = {
    strategy: (config.questionSelectionStrategy as SelectionConfig['strategy']) ?? 'random',
    totalQuestions,
    topicWeights,
  };

  const user = req.user;
  if (user?.id) {
    const ids = questionHistoryService.getSeenQuestionIds(user.id, config.certificationId);
    if (ids.length > 0) {
      selectionConfig.seenQuestionIds = new Set(ids);
    }
  }

  const selected = selectQuestions(pool, selectionConfig);

  // Parse and convert to Question format
  const questions = questionRowsToQuestions(selected);

  // Apply immutable shuffle to eliminate 88% index-0 bias
  const shuffled = shuffleQuestions(questions);

  res.json(shuffled);
});

// Fetch questions by session (for historical review of custom/topic quizzes)
router.get('/exam-sessions/:id/questions', authenticate, (req: Request, res: Response) => {
  const session = sessionRepo.findById(req.params.id, requireUser(req).id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const questionIds: string[] = JSON.parse(session.questions);
  const questions = questionRepo.findByIds(questionIds);

  // Parse and convert to Question format
  const parsedQuestions = questionRowsToQuestions(questions);

  // Apply immutable shuffle for historical review consistency
  const shuffled = shuffleQuestions(parsedQuestions);

  res.json(shuffled);
});

// Submit Exam
router.post(
  ['/exam-sessions/:id/submit', '/exams/:id/submit'],
  authenticate,
  (req: Request, res: Response) => {
    const currentUser = requireUser(req);
    const session = sessionRepo.findById(req.params.id, currentUser.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'in_progress' && session.status !== 'paused')
      return res.status(400).json({ error: 'Session already submitted' });

    const nowMs_ = nowMs();
    const endTime = nowIso();
    const answers = answerRepo.findBySession(req.params.id);
    const questions = questionRepo.findByIds(JSON.parse(session.questions));

    // Effective passing score: wizard override > exam config > 0
    const passingScore =
      session.passingScoreOverride !== null && session.passingScoreOverride !== undefined
        ? session.passingScoreOverride
        : session.examConfigurationId
          ? (sessionRepo.findConfigPassingScore(session.examConfigurationId) ?? 0)
          : 0;

    const result = gradingService.grade(session, answers, questions, passingScore);

    // Persist isCorrect on each answer and trigger SRS updates
    for (const detail of result.detailedResults) {
      const answer = answers.find((a) => a.questionId === detail.questionId);
      if (answer) answerRepo.markCorrect(answer.id, detail.isCorrect);
      if (detail.userAnswer !== null)
        srsService.updateQuestionReview(
          currentUser.id,
          detail.questionId,
          detail.isCorrect ? 5 : 1,
        );
    }

    const wallMs = nowMs_ - new Date(session.startTime).getTime();
    const timeTaken = Math.max(0, Math.floor((wallMs - (session.accumulatedPausedMs ?? 0)) / 1000));
    sessionRepo.complete(req.params.id, { ...result, endTime, timeTaken });
    userRepo.updateXp(currentUser.id, result.xpAwarded);
    updateUserStreak(currentUser.id);
    checkAchievements(currentUser.id, 'exam', 1, { score: result.score });
    checkAchievements(currentUser.id, 'score', result.score, { score: result.score });

    // Invalidate dashboard metrics cache for this user
    cacheService.invalidateUser(currentUser.id);

    let percentileRank: number | null = null;
    if (session.examConfigurationId) {
      const priorScores = sessionRepo.findCompletedScoresByConfig(
        session.examConfigurationId,
        req.params.id,
      );
      percentileRank = computePercentileRank(priorScores, result.score);
    }

    res.json({ ...result, percentileRank });
  },
);

// Abandon Exam
router.post('/exam-sessions/:id/abandon', authenticate, (req: Request, res: Response) => {
  const session = sessionRepo.findById(req.params.id, requireUser(req).id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'in_progress' && session.status !== 'paused')
    return res.json({ ok: true }); // already done
  sessionRepo.abandon(req.params.id);
  res.json({ ok: true });
});

// Pause Exam
router.post('/exam-sessions/:id/pause', authenticate, (req: Request, res: Response) => {
  const session = sessionRepo.findById(req.params.id, requireUser(req).id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (session.isPracticeMode) {
    return res.status(400).json({ error: 'Practice mode sessions cannot be paused' });
  }
  if (session.status === 'paused') {
    return res.status(400).json({ error: 'Session is already paused' });
  }
  if (session.status !== 'in_progress') {
    return res
      .status(400)
      .json({ error: `Cannot pause a session with status '${session.status}'` });
  }

  // pause() now enforces limits (MAX_PAUSE_COUNT=3, MAX_TOTAL_PAUSE_MS=30min)
  const pauseResult = sessionRepo.pause(req.params.id);
  if (!pauseResult.ok) {
    // 403 Forbidden — policy limit exceeded, not a server error
    return res.status(403).json({ error: (pauseResult as { reason: string }).reason });
  }

  res.json({ ok: true, status: 'paused' });
});

// Resume Exam
router.post('/exam-sessions/:id/resume', authenticate, (req: Request, res: Response) => {
  const session = sessionRepo.findById(req.params.id, requireUser(req).id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (session.status !== 'paused') {
    return res.status(400).json({ error: `Session is not paused (status: '${session.status}')` });
  }

  const result = sessionRepo.resume(req.params.id);
  if (!result) return res.status(409).json({ error: 'Failed to resume session' });

  res.json({ ok: true, status: 'in_progress', ...result });
});

// Backward compatibility for attempts
router.get('/attempts', authenticate, (req: Request, res: Response) => {
  const sessions = sessionRepo.findByUser(requireUser(req).id);
  res.json(
    sessions.map((s) => ({
      ...s,
      examId: s.examConfigurationId,
      answers: [], // Simplified for backward compat
    })),
  );
});

export default router;
