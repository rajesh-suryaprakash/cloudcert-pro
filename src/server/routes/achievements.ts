/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express, { type Request, type Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements WHERE isActive = 1').all();
  res.json(achievements);
});

router.get('/user', authenticate, (req: Request, res: Response) => {
  const userAchievements = db
    .prepare(
      `
    SELECT a.*, ua.progress, ua.isCompleted, ua.completedAt, ua.notified, ua.createdAt as userAchievementCreatedAt
    FROM achievements a
    JOIN user_achievements ua ON a.id = ua.achievementId
    WHERE ua.userId = ?
    ORDER BY ua.completedAt DESC, ua.updatedAt DESC
  `,
    )
    .all(req.user!.id);
  res.json(
    userAchievements.map((ua: Record<string, unknown>) => ({
      ...ua,
      isCompleted: ua.isCompleted === 1,
      notified: ua.notified === 1,
    })),
  );
});

export default router;
