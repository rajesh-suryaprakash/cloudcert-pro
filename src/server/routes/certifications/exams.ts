import express, { type NextFunction, type Request, type Response } from 'express';
import { db } from '../../db/connection';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { validate, createExamConfigSchema, patchExamConfigSchema } from '../../middleware/validate';
import { certRepo, certService } from './shared';

const router = express.Router();

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
      const updateStmt = db.prepare(`
        UPDATE topics 
        SET weightPercentage = ?, updatedAt = ?
        WHERE id = ? AND certificationId = ?
      `);

      const transaction = db.transaction((topics: { id: string; weightPercentage: number }[]) => {
        const now = new Date().toISOString();
        for (const topic of topics) {
          updateStmt.run(topic.weightPercentage || null, now, topic.id, certificationId);
        }
      });

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
  validate(patchExamConfigSchema),
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

export default router;
