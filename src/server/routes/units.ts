import express, { type Request, type Response, type NextFunction } from 'express';
import { db } from '../db/connection';
import { authenticate, requireAdmin } from '../middleware/auth';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { CertificationService } from '../services/CertificationService';
import { UnitService } from '../services/UnitService';
import { NotFoundError } from '../errors';

const router = express.Router();
const certRepo = new CertificationRepository(db);
const questionRepo = new QuestionRepository(db);
const unitRepo = new UnitRepository(db);
const certService = new CertificationService(certRepo, questionRepo, unitRepo);
const unitService = new UnitService(unitRepo, certRepo);

// ── Subtopic-scoped Unit endpoints ────────────────────────────────────────────

/**
 * GET /subtopics/:subtopicId/units
 * Returns all units for the given subtopic.
 * Requirements: 6.1, 6.7
 */
router.get(
  '/subtopics/:subtopicId/units',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subtopicId } = req.params;
      const subtopic = certRepo.findSubTopicById(subtopicId);
      if (!subtopic) {
        throw new NotFoundError('Subtopic not found');
      }
      const units = unitRepo.findUnitsBySubTopic(subtopicId);
      res.json(units.map((u) => ({ ...u, isActive: Boolean(u.isActive) })));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /subtopics/:subtopicId/units
 * Creates a new unit under the given subtopic.
 * Requirements: 6.2, 6.7
 */
router.post(
  '/subtopics/:subtopicId/units',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subtopicId } = req.params;
      const { title, description, orderIndex, isActive } = req.body;
      const id = unitService.createUnit(subtopicId, { title, description, orderIndex, isActive });
      res.status(201).json({ id });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'A unit with this title already exists in this subtopic' });
        return;
      }
      next(err);
    }
  },
);

// ── Unit-scoped endpoints ─────────────────────────────────────────────────────

/**
 * GET /units/:id
 * Returns a unit by ID.
 * Requirements: 6.3, 19.3
 */
router.get('/units/:id', authenticate, (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = unitRepo.findUnitById(req.params.id);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }
    res.json({ ...unit, isActive: Boolean(unit.isActive) });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /units/:id
 * Updates an existing unit by ID.
 * Requirements: 6.3
 */
router.put(
  '/units/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, orderIndex, isActive } = req.body;
      unitService.updateUnit(req.params.id, { title, description, orderIndex, isActive });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /units/:id
 * Deletes a unit by ID.
 * Requirements: 6.4, 6.8
 */
router.delete(
  '/units/:id',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      unitService.deleteUnit(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /units/:unitId/questions
 * Returns all active questions for the given unit.
 * Requirements: 6.5
 */
router.get(
  '/units/:unitId/questions',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { unitId } = req.params;
      const unit = unitRepo.findUnitById(unitId);
      if (!unit) {
        throw new NotFoundError('Unit not found');
      }
      const questions = questionRepo.findByUnitId(unitId);
      res.json(
        questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
          correctAnswers: JSON.parse(q.correctAnswers),
          tags: JSON.parse(q.tags || '[]'),
          isActive: Boolean(q.isActive),
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /units/:unitId/questions
 * Creates a new question under the given unit.
 * Requirements: 6.6
 */
router.post(
  '/units/:unitId/questions',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { unitId } = req.params;
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
      const id = certService.createUnitQuestion(unitId, {
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
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
