/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express, { type Request, type Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { SrsService } from '../services/srs';

const srsService = new SrsService(db);
import { updateUserStreak, checkAchievements } from '../services/achievements';
import { nowIso } from '../utils/time';

const router = express.Router();

router.get('/streak', authenticate, (req: Request, res: Response) => {
  const streak = db.prepare('SELECT * FROM user_streaks WHERE userId = ?').get(req.user!.id);
  if (!streak) {
    return res.json({ currentStreak: 0, longestStreak: 0, totalActiveDays: 0, weeklyStreak: 0 });
  }
  res.json(streak);
});

router.get('/due', authenticate, (req: Request, res: Response) => {
  const now = nowIso();
  const dueReviews = db
    .prepare(
      `
    SELECT qr.*, q.questionText, q.options, q.correctAnswers, q.explanation, q.difficulty
    FROM question_reviews qr
    JOIN questions q ON qr.questionId = q.id
    WHERE qr.userId = ? AND qr.nextReviewDate <= ?
    ORDER BY qr.nextReviewDate ASC
  `,
    )
    .all(req.user!.id, now);

  res.json(dueReviews);
});

router.post('/review', authenticate, (req: Request, res: Response) => {
  const { questionId, quality } = req.body;
  if (quality === undefined || quality < 0 || quality > 5) {
    return res.status(400).json({ error: 'Quality must be between 0 and 5' });
  }

  // Verify the user has an existing review record for this question (IDOR protection)
  const existing = db
    .prepare('SELECT id FROM question_reviews WHERE userId = ? AND questionId = ?')
    .get(req.user!.id, questionId);
  if (!existing) {
    return res.status(404).json({ error: 'Review not found' });
  }

  const result = srsService.updateQuestionReview(req.user!.id, questionId, quality);

  // Run side effects before responding so any errors are caught and returned to the client
  updateUserStreak(req.user!.id);
  checkAchievements(req.user!.id, 'study', 1);

  res.json({ success: true, ...result });
});

export default router;
