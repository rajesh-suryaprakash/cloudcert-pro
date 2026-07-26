import express, { type NextFunction, type Request, type Response } from 'express';
import { db } from '../../db/connection';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { validate, questionSchema } from '../../middleware/validate';
import { NotFoundError } from '../../errors';
import { selectQuestions, type SelectionConfig } from '../../services/QuestionSelector';
import type { QuestionRow } from '../../db-types';
import { certRepo, questionRepo, certService, questionHistoryService } from './shared';
import { shuffleQuestions } from '../../utils/questionShuffle';
import { questionRowsToQuestions } from '../../utils/questionTransforms';

const router = express.Router();

export const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export type Difficulty = (typeof VALID_DIFFICULTIES)[number];

/** Returns true when the value is a recognised difficulty string. */
export function isValidDifficulty(value: unknown): value is Difficulty {
  return VALID_DIFFICULTIES.includes(value as Difficulty);
}

// ── Questions ─────────────────────────────────────────────────────────────────

router.get(
  '/topics/:topicId/questions',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const topicId = req.params.topicId;

      // Get certification ID from topic
      const topic = certRepo.findTopicById(topicId);
      if (!topic) {
        throw new NotFoundError('Topic not found');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

      const questions = questionRepo.findByTopicId(topicId, limit, offset);
      const total = questionRepo.countByTopicId(topicId);

      // Only check if there are any questions at all for this topic (use total check)
      if (total === 0) {
        res.status(400).json({
          error: 'No questions available for this topic.',
        });
        return;
      }

      res.setHeader('X-Total-Count', total);
      res.json(questionRowsToQuestions(questions));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/topics/:topicId/questions',
  authenticate,
  requireAdmin,
  validate(questionSchema),
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

    // Get certification ID from subtopic via topic
    const subtopic = certRepo.findSubTopicById(subtopicId);
    if (!subtopic) {
      throw new NotFoundError('Subtopic not found');
    }

    const topic = certRepo.findTopicById(subtopic.topicId);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }

    const questions = questionRepo.findBySubTopicId(subtopicId);

    // Only check if there are any questions at all for this subtopic
    if (questions.length === 0) {
      res.status(400).json({
        error: 'No questions available for this subtopic.',
      });
      return;
    }

    res.json(questionRowsToQuestions(questions));
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

router.get(
  '/certifications/:id/questions',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { difficulty } = req.query;
      const certificationId = req.params.id;

      if (difficulty !== undefined) {
        if (!isValidDifficulty(difficulty)) {
          res.status(400).json({
            error: `Invalid difficulty value "${difficulty}". Must be one of: Easy, Medium, Hard.`,
          });
          return;
        }
      }

      const allQuestions = questionRepo.findByCertification(certificationId);
      const questions = difficulty
        ? allQuestions.filter((q) => q.difficulty === (difficulty as string))
        : allQuestions;

      // Only check if there are any questions at all for this certification/difficulty
      if (questions.length === 0) {
        const difficultyText = difficulty ? ` with difficulty "${difficulty}"` : '';
        res.status(400).json({
          error: `No questions available for this certification${difficultyText}.`,
        });
        return;
      }

      res.json(questionRowsToQuestions(questions));
    } catch (err) {
      next(err);
    }
  },
);

// ── Unified Question Selection ────────────────────────────────────────────────

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

      // Resolve topicWeights
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

      // Resolve certification ID to fetch seen questions
      let certId: string | null = null;
      if (scope === 'certification') {
        certId = scopeId as string;
      } else if (scope === 'topic') {
        const topic = certRepo.findTopicById(scopeId as string);
        if (topic) certId = topic.certificationId;
      } else if (scope === 'subtopic') {
        const subtopic = certRepo.findSubTopicById(scopeId as string);
        if (subtopic) {
          const topic = certRepo.findTopicById(subtopic.topicId);
          if (topic) certId = topic.certificationId;
        }
      } else if (scope === 'subtopics' && Array.isArray(scopeId) && scopeId.length > 0) {
        const subtopic = certRepo.findSubTopicById(scopeId[0]);
        if (subtopic) {
          const topic = certRepo.findTopicById(subtopic.topicId);
          if (topic) certId = topic.certificationId;
        }
      }

      let seenQuestionIds: Set<string> | undefined;
      if (certId && req.user?.id) {
        const ids = questionHistoryService.getSeenQuestionIds(req.user.id, certId);
        if (ids.length > 0) {
          seenQuestionIds = new Set(ids);
        }
      }

      const selectionConfig: SelectionConfig = {
        strategy: strategy as SelectionConfig['strategy'],
        totalQuestions,
        topicWeights: resolvedWeights,
        seenQuestionIds,
      };

      const selected = selectQuestions(pool, selectionConfig);

      // Parse and convert to Question format
      const questions = questionRowsToQuestions(selected);

      // Apply immutable shuffle to eliminate 88% index-0 bias
      const shuffled = shuffleQuestions(questions);

      res.json(shuffled);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
