/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import type { ExamSessionRow } from '../db-types';

const router = express.Router();

export type TaskType = 'review_wrong_answers' | 'practice_quiz' | 'read_docs';

export interface WeakTopic {
  topicId: string;
  topicTitle: string;
  incorrectCount: number;
  docUrl: string | null;
}

export interface StudyPlanCompletion {
  topicId: string;
  taskType: TaskType;
}

export interface StudyPlanResponse {
  weakTopics: WeakTopic[];
  message: string;
  completions: StudyPlanCompletion[];
}

/**
 * Determines whether a requesting user is authorized to access a session.
 * Returns true when the requesting user owns the session, false otherwise.
 * Requirements: 5.3
 */
export function isSessionOwner(sessionUserId: string, requestingUserId: string): boolean {
  return sessionUserId === requestingUserId;
}

/**
 * Computes the top weak topics from a list of incorrect answers grouped by topic.
 * Returns at most 3 topics sorted descending by incorrectCount.
 *
 * @param topicCounts - map of topicId -> { topicTitle, incorrectCount, docUrl }
 */
export function computeWeakTopics(
  topicCounts: Map<string, { topicTitle: string; incorrectCount: number; docUrl: string | null }>,
): WeakTopic[] {
  return Array.from(topicCounts.entries())
    .map(([topicId, { topicTitle, incorrectCount, docUrl }]) => ({
      topicId,
      topicTitle,
      incorrectCount,
      docUrl,
    }))
    .sort((a, b) => b.incorrectCount - a.incorrectCount)
    .slice(0, 3);
}

/**
 * Renders the list of study plan task rows for a set of weak topics.
 * Returns an array of task descriptors: one per task type per topic.
 * Requirements: 1.1, 2.1, 3.3, 3.4
 */
export function renderStudyPlanTasks(
  weakTopics: WeakTopic[],
): Array<{ topicId: string; taskType: TaskType }> {
  const tasks: Array<{ topicId: string; taskType: TaskType }> = [];
  for (const topic of weakTopics) {
    tasks.push({ topicId: topic.topicId, taskType: 'review_wrong_answers' });
    tasks.push({ topicId: topic.topicId, taskType: 'practice_quiz' });
    if (topic.docUrl !== null) {
      tasks.push({ topicId: topic.topicId, taskType: 'read_docs' });
    }
  }
  return tasks;
}

/**
 * GET /api/exam-sessions/:id/study-plan
 * Returns the top 3 weak topics for a completed exam session,
 * including docUrl per topic and all completion records for the session.
 * Requirements: 1.1, 2.1, 3.3, 4.2
 */
router.get('/exam-sessions/:id/study-plan', authenticate, (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Verify session exists
  const session = db.prepare('SELECT id, userId FROM exam_sessions WHERE id = ?').get(sessionId) as
    | Pick<ExamSessionRow, 'id' | 'userId'>
    | undefined;
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Requirement 5.3: enforce ownership
  if (!isSessionOwner(session.userId, req.user!.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Fetch incorrect answers joined to topics (with docUrl via LEFT JOIN)
  const rows = db
    .prepare(
      `
    SELECT q.topicId, t.title AS topicTitle, t.docUrl
    FROM exam_answers ea
    JOIN questions q ON ea.questionId = q.id
    JOIN topics t ON q.topicId = t.id
    WHERE ea.examSessionId = ? AND ea.isCorrect = 0
  `,
    )
    .all(sessionId) as Array<{ topicId: string; topicTitle: string; docUrl: string | null }>;

  // Fetch completions for this session + user
  const completionRows = db
    .prepare(
      `
    SELECT topicId, taskType
    FROM study_plan_completions
    WHERE sessionId = ? AND userId = ?
  `,
    )
    .all(sessionId, req.user!.id) as Array<{ topicId: string; taskType: TaskType }>;

  const completions: StudyPlanCompletion[] = completionRows.map((r) => ({
    topicId: r.topicId,
    taskType: r.taskType,
  }));

  // Requirement 5.2: no incorrect answers
  if (rows.length === 0) {
    return res.json({
      weakTopics: [],
      message: 'Great job! No weak topics identified.',
      completions,
    } satisfies StudyPlanResponse);
  }

  // Group by topic
  const topicCounts = new Map<
    string,
    { topicTitle: string; incorrectCount: number; docUrl: string | null }
  >();
  for (const row of rows) {
    const existing = topicCounts.get(row.topicId);
    if (existing) {
      existing.incorrectCount++;
    } else {
      topicCounts.set(row.topicId, {
        topicTitle: row.topicTitle,
        incorrectCount: 1,
        docUrl: row.docUrl ?? null,
      });
    }
  }

  // Requirements 5.1, 5.5: top 3 sorted descending
  const weakTopics = computeWeakTopics(topicCounts);

  return res.json({
    weakTopics,
    message: `Study plan generated with ${weakTopics.length} weak topic(s).`,
    completions,
  } satisfies StudyPlanResponse);
});

/**
 * POST /api/study-plan-completions
 * Marks a study plan task as complete for the requesting user.
 * Requirements: 4.1, 4.4
 */
router.post('/study-plan-completions', authenticate, (req: Request, res: Response) => {
  const { sessionId, topicId, taskType } = req.body as {
    sessionId?: string;
    topicId?: string;
    taskType?: string;
  };

  const validTaskTypes: TaskType[] = ['review_wrong_answers', 'practice_quiz', 'read_docs'];

  if (!sessionId || !topicId || !taskType) {
    return res.status(400).json({ error: 'sessionId, topicId, and taskType are required' });
  }

  if (!validTaskTypes.includes(taskType as TaskType)) {
    return res
      .status(400)
      .json({ error: `Invalid taskType. Must be one of: ${validTaskTypes.join(', ')}` });
  }

  // Verify session exists and is owned by the requesting user
  const session = db.prepare('SELECT id, userId FROM exam_sessions WHERE id = ?').get(sessionId) as
    | Pick<ExamSessionRow, 'id' | 'userId'>
    | undefined;
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!isSessionOwner(session.userId, req.user!.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Verify topic exists
  const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(topicId) as
    | { id: string }
    | undefined;
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const id = crypto.randomUUID();
  const completedAt = new Date().toISOString();

  // INSERT OR IGNORE enforces idempotence via the UNIQUE constraint
  db.prepare(
    `INSERT OR IGNORE INTO study_plan_completions (id, userId, sessionId, topicId, taskType, completedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, req.user!.id, sessionId, topicId, taskType, completedAt);

  // Fetch the actual record (may have been inserted previously)
  const record = db
    .prepare(
      `SELECT id, userId, sessionId, topicId, taskType, completedAt
       FROM study_plan_completions
       WHERE userId = ? AND sessionId = ? AND topicId = ? AND taskType = ?`,
    )
    .get(req.user!.id, sessionId, topicId, taskType) as {
    id: string;
    userId: string;
    sessionId: string;
    topicId: string;
    taskType: string;
    completedAt: string;
  };

  return res.status(201).json(record);
});

/**
 * GET /api/study-plan-completions/:sessionId
 * Returns all completion records for the session owned by the requesting user.
 * Requirements: 4.2, 4.3
 */
router.get('/study-plan-completions/:sessionId', authenticate, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  // Verify session exists and is owned by the requesting user
  const session = db.prepare('SELECT id, userId FROM exam_sessions WHERE id = ?').get(sessionId) as
    | Pick<ExamSessionRow, 'id' | 'userId'>
    | undefined;
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!isSessionOwner(session.userId, req.user!.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const completions = db
    .prepare(
      `SELECT topicId, taskType
         FROM study_plan_completions
         WHERE sessionId = ? AND userId = ?`,
    )
    .all(sessionId, req.user!.id) as Array<{ topicId: string; taskType: TaskType }>;

  return res.json({ completions });
});

export default router;
