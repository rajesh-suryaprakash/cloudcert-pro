import express, { type NextFunction, type Request, type Response } from 'express';
import { db } from '../db/connection';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validate,
  createCertificationSchema,
  createExamConfigSchema,
  updateTopicSchema,
} from '../middleware/validate';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { CertificationService } from '../services/CertificationService';
import { QuestionHistoryService } from '../services/QuestionHistoryService';
import { NotFoundError } from '../errors';
import { selectQuestions, type SelectionConfig } from '../services/QuestionSelector';
import type { QuestionRow } from '../db-types';

const router = express.Router();
const certRepo = new CertificationRepository(db);
const questionRepo = new QuestionRepository(db);
const unitRepo = new UnitRepository(db);
const certService = new CertificationService(certRepo, questionRepo, unitRepo);
const questionHistoryService = new QuestionHistoryService(db);

// ── Certifications ────────────────────────────────────────────────────────────

router.get('/certifications', authenticate, (_req, res) => {
  const certs = certRepo.findAll();
  res.json(certs.map((c) => ({ ...c, isActive: Boolean(c.isActive) })));
});

router.get('/certifications/:id', authenticate, (req: Request, res: Response, next: NextFunction) => {
  try {
    const cert = certRepo.findById(req.params.id);
    if (!cert) {
      throw new NotFoundError('Certification not found');
    }
    res.json({ ...cert, isActive: Boolean(cert.isActive) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/certifications',
  authenticate,
  requireAdmin,
  validate(createCertificationSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, vendor, description, level, examCode, url, iconUrl, isActive } = req.body;
      const resolvedLevel = level || 'Associate';
      const id = certService.createCertification({
        title,
        vendor,
        description,
        level,
        examCode,
        url,
        iconUrl,
        isActive,
      });
      res.json({
        id,
        title,
        vendor,
        description,
        level: resolvedLevel,
        examCode,
        url,
        iconUrl,
        isActive,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/certifications/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, vendor, description, level, examCode, url, iconUrl, isActive } = req.body;
      certService.updateCertification(req.params.id, {
        title,
        vendor,
        description,
        level,
        examCode,
        url,
        iconUrl,
        isActive,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/certifications/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      certService.deleteCertification(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Topics ────────────────────────────────────────────────────────────────────

router.get('/certifications/:certificationId/topics', authenticate, (req, res) => {
  res.json(certRepo.findTopicsByCertification(req.params.certificationId));
});

router.post(
  '/certifications/:certificationId/topics',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, orderIndex, isActive, docUrl, weightPercentage } = req.body;
      const { certificationId } = req.params;
      const id = certService.createTopic(certificationId, {
        title,
        description,
        orderIndex,
        isActive,
        docUrl,
        weightPercentage,
      });
      res.json({
        id,
        certificationId,
        title,
        description,
        orderIndex: orderIndex ?? 0,
        isActive: isActive !== false ? 1 : 0,
        docUrl,
        weightPercentage,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/topics/:id',
  authenticate,
  requireAdmin,
  validate(updateTopicSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      certService.updateTopic(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/topics/:id', authenticate, requireAdmin, (req, res, next: NextFunction) => {
  try {
    certService.deleteTopic(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Topic Weights Management ─────────────────────────────────────────────────

router.put(
  '/certifications/:certificationId/topic-weights',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificationId } = req.params;
      const { topics } = req.body;

      if (!Array.isArray(topics)) {
        return res.status(400).json({ error: 'topics must be an array' });
      }

      // Validate each weight is between 0 and 100
      for (const topic of topics) {
        if (
          typeof topic.weightPercentage !== 'number' ||
          topic.weightPercentage < 0 ||
          topic.weightPercentage > 100
        ) {
          return res.status(400).json({
            error: `Weight for ${topic.title} must be between 0 and 100`,
          });
        }
      }

      // Validate sum of weights equals 100 (only for topics with weights)
      const topicsWithWeights = topics.filter((t) => t.weightPercentage > 0);
      if (topicsWithWeights.length > 0) {
        const totalWeight = topicsWithWeights.reduce(
          (sum: number, t: { weightPercentage: number }) => sum + t.weightPercentage,
          0,
        );
        if (Math.abs(totalWeight - 100) > 0.01) {
          // Allow small floating point errors
          return res.status(400).json({
            error: `Sum of weights must equal 100 (current: ${totalWeight.toFixed(2)})`,
          });
        }
      }

      // Update topic weights in a transaction
      const updateStmt = certRepo.db.prepare(`
        UPDATE topics 
        SET weightPercentage = ?, updatedAt = ?
        WHERE id = ? AND certificationId = ?
      `);

      const transaction = certRepo.db.transaction(
        (topics: { id: string; weightPercentage: number }[]) => {
          const now = new Date().toISOString();
          for (const topic of topics) {
            updateStmt.run(topic.weightPercentage || null, now, topic.id, certificationId);
          }
        },
      );

      transaction(topics);

      res.json({
        success: true,
        message: 'Topic weights updated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/certifications/:certificationId/topic-weights',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificationId } = req.params;

      const topics = certRepo.findTopicsByCertification(certificationId);
      const totalWeight = topics.reduce((sum, t) => sum + (t.weightPercentage || 0), 0);

      res.json({
        certificationId,
        topics,
        totalWeight,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Effective topic weights for an exam (derived from topics when not explicitly set) ──

router.get(
  '/exams/:examId/effective-topic-weights',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { examId } = req.params;
      const config = certRepo.findExamById(examId);
      if (!config) return res.status(404).json({ error: 'Exam not found' });

      const topics = certRepo.findTopicsByCertification(config.certificationId);

      // Parse explicit weights from exam config
      let explicitWeights: Record<string, number> = {};
      try {
        const parsed = JSON.parse(config.topicWeights || '{}');
        if (parsed && Object.keys(parsed).length > 0) explicitWeights = parsed;
      } catch {
        /* ignore */
      }

      const hasExplicitWeights = Object.keys(explicitWeights).length > 0;

      // Build effective weights: explicit override OR derived from topic.weightPercentage
      const weightedTopics = topics.map((t) => {
        const explicit = explicitWeights[t.id];
        const derived = t.weightPercentage ?? 0;
        return {
          id: t.id,
          title: t.title,
          weightPercentage: t.weightPercentage ?? 0,
          effectiveWeight: hasExplicitWeights ? (explicit ?? 0) : derived,
          source: hasExplicitWeights ? 'explicit' : 'derived',
        };
      });

      // Normalise effectiveWeight to 0-1 for display
      const totalEffective = weightedTopics.reduce((s, t) => s + t.effectiveWeight, 0);
      const normalised = weightedTopics.map((t) => ({
        ...t,
        normalisedWeight: totalEffective > 0 ? t.effectiveWeight / totalEffective : 0,
      }));

      res.json({
        examId,
        certificationId: config.certificationId,
        strategy: config.questionSelectionStrategy,
        hasExplicitWeights,
        topics: normalised,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── SubTopics ─────────────────────────────────────────────────────────────────

router.get('/topics/:topicId/subtopics', authenticate, (req, res) => {
  res.json(certRepo.findSubTopicsByTopic(req.params.topicId));
});

router.post(
  '/topics/:topicId/subtopics',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, orderIndex, isActive } = req.body;
      const id = certService.createSubTopic(req.params.topicId, {
        title,
        description,
        orderIndex,
        isActive,
      });
      res.json({
        id,
        topicId: req.params.topicId,
        title,
        description,
        orderIndex: orderIndex ?? 0,
        isActive: isActive !== false ? 1 : 0,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/subtopics/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      certService.updateSubTopic(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/subtopics/:id', authenticate, requireAdmin, (req, res, next: NextFunction) => {
  try {
    certService.deleteSubTopic(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Questions ─────────────────────────────────────────────────────────────────

router.get('/topics/:topicId/questions', authenticate, (req, res, next: NextFunction) => {
  try {
    const topicId = req.params.topicId;
    const _userId = req.user?.id;

    // Get certification ID from topic
    const topic = certRepo.findTopicById(topicId);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }

    // For topic-wise tests, allow users to retake questions for practice
    // Don't exclude seen questions - users should be able to practice repeatedly
    const questions = questionRepo.findByTopicId(topicId);

    // Only check if there are any questions at all for this topic
    if (questions.length === 0) {
      res.status(400).json({
        error: 'No questions available for this topic.',
      });
      return;
    }

    res.json(
      questions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
        correctAnswers: JSON.parse(q.correctAnswers),
        tags: JSON.parse(q.tags),
        isActive: q.isActive === 1,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post(
  '/topics/:topicId/questions',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
      } = req.body;
      const id = certService.createQuestion(req.params.topicId, {
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
      });
      res.json({
        id,
        topicId: req.params.topicId,
        subTopicId: null,
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/subtopics/:subtopicId/questions', authenticate, (req, res, next: NextFunction) => {
  try {
    const subtopicId = req.params.subtopicId;
    const _userId = req.user?.id;

    // Get certification ID from subtopic via topic
    const subtopic = certRepo.findSubTopicById(subtopicId);
    if (!subtopic) {
      throw new NotFoundError('Subtopic not found');
    }

    const topic = certRepo.findTopicById(subtopic.topicId);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }

    // For subtopic-wise tests, allow users to retake questions for practice
    // Don't exclude seen questions - users should be able to practice repeatedly
    const questions = questionRepo.findBySubTopicId(subtopicId);

    // Only check if there are any questions at all for this subtopic
    if (questions.length === 0) {
      res.status(400).json({
        error: 'No questions available for this subtopic.',
      });
      return;
    }

    res.json(
      questions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
        correctAnswers: JSON.parse(q.correctAnswers),
        tags: JSON.parse(q.tags),
        isActive: q.isActive === 1,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post(
  '/subtopics/:subtopicId/questions',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
      } = req.body;
      const id = certService.createSubTopicQuestion(req.params.subtopicId, {
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
      });
      res.json({
        id,
        subTopicId: req.params.subtopicId,
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/questions/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
        unitId,
      } = req.body;
      certService.updateQuestion(req.params.id, {
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        difficulty,
        tags,
        points,
        isActive,
        unitId,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/questions/:id', authenticate, requireAdmin, (req, res, next: NextFunction) => {
  try {
    certService.deleteQuestion(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Questions by Certification ────────────────────────────────────────────────

export const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export type Difficulty = (typeof VALID_DIFFICULTIES)[number];

/** Returns true when the value is a recognised difficulty string. */
export function isValidDifficulty(value: unknown): value is Difficulty {
  return VALID_DIFFICULTIES.includes(value as Difficulty);
}

router.get(
  '/certifications/:id/questions',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { difficulty } = req.query;
      const _userId = req.user?.id;
      const certificationId = req.params.id;

      if (difficulty !== undefined) {
        if (!isValidDifficulty(difficulty)) {
          res.status(400).json({
            error: `Invalid difficulty value "${difficulty}". Must be one of: Easy, Medium, Hard.`,
          });
          return;
        }
      }

      // For custom quizzes, allow users to retake questions for practice
      // Don't exclude seen questions - users should be able to practice repeatedly
      const questions = questionRepo.findByCertification(
        certificationId,
        difficulty ? (difficulty as string) : null,
      );

      // Only check if there are any questions at all for this certification/difficulty
      if (questions.length === 0) {
        const difficultyText = difficulty ? ` with difficulty "${difficulty}"` : '';
        res.status(400).json({
          error: `No questions available for this certification${difficultyText}.`,
        });
        return;
      }

      res.json(
        questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
          correctAnswers: JSON.parse(q.correctAnswers),
          tags: JSON.parse(q.tags),
          isActive: q.isActive === 1,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ── Exam Configurations ───────────────────────────────────────────────────────

router.get('/certifications/:certificationId/exams', authenticate, (req, res) => {
  const showAll =
    req.query.all === 'true' &&
    (req as Request & { user?: { role: string } }).user?.role === 'admin';
  const exams = showAll
    ? certRepo.findExamsByCertification(req.params.certificationId)
    : certRepo.findActiveExamsByCertification(req.params.certificationId);
  res.json(
    exams.map((e) => ({
      ...e,
      isActive: Boolean(e.isActive),
      topicWeights: JSON.parse(e.topicWeights || '{}'),
    })),
  );
});

router.post(
  '/certifications/:certificationId/exams',
  authenticate,
  requireAdmin,
  validate(createExamConfigSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        description,
        duration,
        totalQuestions,
        passingScore,
        questionSelectionStrategy,
        topicWeights,
        isActive,
      } = req.body;
      const id = certService.createExamConfig(req.params.certificationId, {
        name,
        description,
        duration,
        totalQuestions,
        passingScore,
        questionSelectionStrategy,
        topicWeights,
        isActive,
      });
      res.json({
        id,
        certificationId: req.params.certificationId,
        name,
        description,
        duration,
        totalQuestions,
        passingScore,
        questionSelectionStrategy,
        topicWeights,
        isActive,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/exams/:id',
  authenticate,
  requireAdmin,
  validate(createExamConfigSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        description,
        duration,
        totalQuestions,
        passingScore,
        questionSelectionStrategy,
        topicWeights,
        isActive,
      } = req.body;
      certService.updateExamConfig(req.params.id, {
        name,
        description,
        duration,
        totalQuestions,
        passingScore,
        questionSelectionStrategy,
        topicWeights,
        isActive,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Partial update — used for toggling isActive without requiring all fields
router.patch(
  '/exams/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const exam = certRepo.findExamById(req.params.id);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      // Merge patch fields over existing values
      const merged = {
        name: req.body.name ?? exam.name,
        description: req.body.description ?? exam.description ?? undefined,
        duration: req.body.duration ?? exam.duration,
        totalQuestions: req.body.totalQuestions ?? exam.totalQuestions,
        passingScore: req.body.passingScore ?? exam.passingScore,
        questionSelectionStrategy:
          req.body.questionSelectionStrategy ?? exam.questionSelectionStrategy,
        topicWeights: req.body.topicWeights ?? JSON.parse(exam.topicWeights || '{}'),
        isActive: req.body.isActive !== undefined ? req.body.isActive : Boolean(exam.isActive),
      };

      certService.updateExamConfig(req.params.id, merged);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/exams/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const exam = certRepo.findExamById(req.params.id);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      certService.deleteExamConfig(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Question History ──────────────────────────────────────────────────────────

// GET /certifications/:id/question-history/stats
// Requirements: 7.1, 7.2, 7.3, 10.2, 10.5
router.get(
  '/certifications/:id/question-history/stats',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = req.params.id;
      const userId = req.user?.id as string;

      // Validate certification exists
      const certification = certRepo.findAll().find((c) => c.id === certificationId);
      if (!certification) {
        throw new NotFoundError('Certification not found');
      }

      // Get history statistics
      const stats = questionHistoryService.getHistoryStats(userId, certificationId);

      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

// POST /certifications/:id/question-history/reset
// Requirements: 4.1, 4.2, 4.3, 10.3, 10.5
router.post(
  '/certifications/:id/question-history/reset',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = req.params.id;
      const userId = req.user?.id as string;

      // Validate certification exists
      const certification = certRepo.findAll().find((c) => c.id === certificationId);
      if (!certification) {
        throw new NotFoundError('Certification not found');
      }

      // Reset history (only affects authenticated user's records)
      const recordsCleared = questionHistoryService.resetHistory(userId, certificationId);

      res.json({ recordsCleared });
    } catch (err) {
      next(err);
    }
  },
);

// GET /certifications/:id/questions/unseen
// Requirements: 3.4, 6.3, 10.1, 10.4, 10.5
router.get(
  '/certifications/:id/questions/unseen',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = req.params.id;
      const userId = req.user?.id as string;
      const { difficulty, topicId, subtopicId, unitId } = req.query;

      // Validate certification exists
      const certification = certRepo.findAll().find((c) => c.id === certificationId);
      if (!certification) {
        throw new NotFoundError('Certification not found');
      }

      // Validate difficulty if provided
      if (difficulty !== undefined && !isValidDifficulty(difficulty)) {
        res.status(400).json({
          error: `Invalid difficulty value "${difficulty}". Must be one of: Easy, Medium, Hard.`,
        });
        return;
      }

      // Get seen question IDs
      const seenQuestionIds = questionHistoryService.getSeenQuestionIds(userId, certificationId);

      let unseenQuestions;
      let totalCount;

      if (unitId) {
        // Validate unit exists
        const unit = unitRepo.findUnitById(unitId as string);
        if (!unit) {
          throw new NotFoundError('Unit not found');
        }

        // Get unseen questions for unit
        unseenQuestions = questionRepo.findByUnitExcludingSeen(unitId as string, seenQuestionIds);
        totalCount = questionRepo.findByUnitId(unitId as string).length;
      } else if (subtopicId) {
        // Validate subtopic exists
        const subtopic = certRepo.findSubTopicById(subtopicId as string);
        if (!subtopic) {
          throw new NotFoundError('Subtopic not found');
        }

        // Get unseen questions for subtopic
        unseenQuestions = questionRepo.findBySubTopicExcludingSeen(
          subtopicId as string,
          seenQuestionIds,
        );
        totalCount = questionRepo
          .findBySubTopicId(subtopicId as string)
          .filter((q) => q.isActive === 1).length;
      } else if (topicId) {
        // Validate topic exists
        const topic = certRepo.findTopicById(topicId as string);
        if (!topic) {
          throw new NotFoundError('Topic not found');
        }

        // Get unseen questions for topic
        unseenQuestions = questionRepo.findByTopicExcludingSeen(topicId as string, seenQuestionIds);
        totalCount = questionRepo
          .findByTopicId(topicId as string)
          .filter((q) => q.isActive === 1).length;
      } else {
        // Get unseen questions for certification
        unseenQuestions = questionRepo.findByCertificationExcludingSeen(
          certificationId,
          seenQuestionIds,
          difficulty ? (difficulty as string) : null,
        );
        totalCount = questionRepo.countByCertification(certificationId);
      }

      res.json({
        unseenCount: unseenQuestions.length,
        totalCount,
        // Requirement 3.2: Include warning flag when insufficient questions
        hasInsufficientQuestions: unseenQuestions.length < totalCount && unseenQuestions.length > 0,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Unified Question Selection ────────────────────────────────────────────────
// Single server-side endpoint for all quiz types. Applies QuestionSelector
// so the configured strategy (random/difficulty_balanced/topic_based) is
// consistently enforced regardless of quiz type.

router.post(
  '/questions/select',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        scope, // 'certification' | 'topic' | 'subtopic' | 'subtopics'
        scopeId, // string or string[] for 'subtopics'
        strategy = 'random',
        totalQuestions,
        difficulty, // optional filter: 'Easy' | 'Medium' | 'Hard'
        topicWeights, // optional, for topic_based strategy
      } = req.body;

      if (!scope || !scopeId) {
        return res.status(400).json({ error: 'scope and scopeId are required' });
      }
      if (!totalQuestions || totalQuestions < 1) {
        return res.status(400).json({ error: 'totalQuestions must be >= 1' });
      }

      // Build the raw question pool based on scope
      let pool: QuestionRow[] = [];

      if (scope === 'certification') {
        pool = questionRepo.findByCertification(scopeId as string);
      } else if (scope === 'topic') {
        pool = questionRepo.findByTopicId(scopeId as string);
      } else if (scope === 'subtopic') {
        pool = questionRepo.findBySubTopicId(scopeId as string);
      } else if (scope === 'subtopics' && Array.isArray(scopeId)) {
        for (const id of scopeId as string[]) {
          pool.push(...questionRepo.findBySubTopicId(id));
        }
      } else if (scope === 'unit') {
        pool = questionRepo.findByUnitId(scopeId as string);
      } else if (scope === 'units' && Array.isArray(scopeId)) {
        for (const id of scopeId as string[]) {
          pool.push(...questionRepo.findByUnitId(id));
        }
      } else {
        return res.status(400).json({ error: `Unknown scope: ${scope}` });
      }
      // Filter to active questions only
      pool = pool.filter((q) => q.isActive === 1);

      // Optional difficulty pre-filter (for custom quizzes)
      if (difficulty && difficulty !== 'Mixed') {
        pool = pool.filter((q) => q.difficulty === difficulty);
      }

      if (pool.length === 0) {
        return res
          .status(400)
          .json({ error: 'No questions available for the given scope/filters' });
      }

      // Resolve topicWeights: use provided weights, or derive from topic.weightPercentage
      // when strategy is topic_based and no explicit weights given
      let resolvedWeights: Record<string, number> | undefined = topicWeights;
      if (
        strategy === 'topic_based' &&
        (!resolvedWeights || Object.keys(resolvedWeights).length === 0)
      ) {
        if (scope === 'certification') {
          const topics = db
            .prepare(
              'SELECT id, weightPercentage FROM topics WHERE certificationId = ? AND isActive = 1 AND weightPercentage > 0',
            )
            .all(scopeId as string) as Array<{ id: string; weightPercentage: number }>;
          if (topics.length > 0) {
            const total = topics.reduce((s, t) => s + t.weightPercentage, 0);
            resolvedWeights = Object.fromEntries(
              topics.map((t) => [t.id, t.weightPercentage / total]),
            );
          }
        }
      }

      const selectionConfig: SelectionConfig = {
        strategy: strategy as SelectionConfig['strategy'],
        totalQuestions,
        topicWeights: resolvedWeights,
      };

      const selected = selectQuestions(pool, selectionConfig);

      res.json(
        selected.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
          correctAnswers: JSON.parse(q.correctAnswers),
          tags: JSON.parse(q.tags || '[]'),
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

export default router;
