import express, { type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { NotFoundError } from '../../errors';
import { certRepo, questionRepo, unitRepo, questionHistoryService } from './shared';
import { isValidDifficulty } from './questions';

const router = express.Router();

// ── Question History ──────────────────────────────────────────────────────────

router.get(
  '/certifications/:id/question-history/stats',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = req.params.id;
      const userId = req.user?.id as string;

      const certification = certRepo.findAll().find((c) => c.id === certificationId);
      if (!certification) {
        throw new NotFoundError('Certification not found');
      }

      const stats = questionHistoryService.getHistoryStats(userId, certificationId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/certifications/:id/question-history/reset',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = req.params.id;
      const userId = req.user?.id as string;

      const certification = certRepo.findAll().find((c) => c.id === certificationId);
      if (!certification) {
        throw new NotFoundError('Certification not found');
      }

      const recordsCleared = questionHistoryService.resetHistory(userId, certificationId);
      res.json({ recordsCleared });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/certifications/:id/questions/unseen',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificationId = req.params.id;
      const userId = req.user?.id as string;
      const { difficulty, topicId, subtopicId, unitId } = req.query;

      const certification = certRepo.findAll().find((c) => c.id === certificationId);
      if (!certification) {
        throw new NotFoundError('Certification not found');
      }

      if (difficulty !== undefined && !isValidDifficulty(difficulty)) {
        res.status(400).json({
          error: `Invalid difficulty value "${difficulty}". Must be one of: Easy, Medium, Hard.`,
        });
        return;
      }

      const seenQuestionIds = questionHistoryService.getSeenQuestionIds(userId, certificationId);

      let unseenQuestions;
      let totalCount;

      if (unitId) {
        const unit = unitRepo.findUnitById(unitId as string);
        if (!unit) {
          throw new NotFoundError('Unit not found');
        }

        unseenQuestions = questionRepo.findByUnitExcludingSeen(unitId as string, seenQuestionIds);
        totalCount = questionRepo.findByUnitId(unitId as string).length;
      } else if (subtopicId) {
        const subtopic = certRepo.findSubTopicById(subtopicId as string);
        if (!subtopic) {
          throw new NotFoundError('Subtopic not found');
        }

        unseenQuestions = questionRepo.findBySubTopicExcludingSeen(
          subtopicId as string,
          seenQuestionIds,
        );
        totalCount = questionRepo
          .findBySubTopicId(subtopicId as string)
          .filter((q) => q.isActive === 1).length;
      } else if (topicId) {
        const topic = certRepo.findTopicById(topicId as string);
        if (!topic) {
          throw new NotFoundError('Topic not found');
        }

        unseenQuestions = questionRepo.findByTopicExcludingSeen(topicId as string, seenQuestionIds);
        totalCount = questionRepo
          .findByTopicId(topicId as string)
          .filter((q) => q.isActive === 1).length;
      } else {
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
        hasInsufficientQuestions: unseenQuestions.length < totalCount && unseenQuestions.length > 0,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
