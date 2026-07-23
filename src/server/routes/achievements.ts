import express, { type Request, type Response } from 'express';
import { db } from '../db/connection';
import { authenticate, requireUser } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, (_req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements WHERE isActive = 1').all();
  res.json(achievements);
});

interface UserAchievementRow {
  isCompleted: number;
  notified: number;
  [key: string]: unknown;
}

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
    .all(requireUser(req).id);
  res.json(
    (userAchievements as UserAchievementRow[]).map((ua) => ({
      ...ua,
      isCompleted: ua.isCompleted === 1,
      notified: ua.notified === 1,
    })),
  );
});

export default router;
