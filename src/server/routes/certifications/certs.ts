import express, { type NextFunction, type Request, type Response } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import {
  validate,
  createCertificationSchema,
  updateCertificationSchema,
  createTopicSchema,
  updateTopicSchema,
  createSubTopicSchema,
  updateSubTopicSchema,
} from '../../middleware/validate';
import { NotFoundError } from '../../errors';
import { certRepo, certService } from './shared';

const router = express.Router();

// ── Certifications ────────────────────────────────────────────────────────────

router.get('/certifications', authenticate, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

  const certs = certRepo.findAll(limit, offset);
  const total = certRepo.countAll();
  res.setHeader('X-Total-Count', total);
  res.json(certs.map((c) => ({ ...c, isActive: Boolean(c.isActive) })));
});

router.get(
  '/certifications/:id',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const cert = certRepo.findAll().find((c) => c.id === req.params.id);
      if (!cert) {
        throw new NotFoundError('Certification not found');
      }
      res.json({ ...cert, isActive: Boolean(cert.isActive) });
    } catch (err) {
      next(err);
    }
  },
);

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
  validate(updateCertificationSchema),
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
  validate(createTopicSchema),
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
  ['/topics/:id', '/certifications/:certificationId/topics/:id'],
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

router.delete(
  ['/topics/:id', '/certifications/:certificationId/topics/:id'],
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      certService.deleteTopic(req.params.id);
      res.json({ success: true });
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
  validate(createSubTopicSchema),
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
  ['/subtopics/:id', '/topics/:topicId/subtopics/:id'],
  authenticate,
  requireAdmin,
  validate(updateSubTopicSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      certService.updateSubTopic(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  ['/subtopics/:id', '/topics/:topicId/subtopics/:id'],
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      certService.deleteSubTopic(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
