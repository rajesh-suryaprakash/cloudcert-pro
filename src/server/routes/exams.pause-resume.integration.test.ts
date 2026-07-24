process.env.JWT_SECRET = 'test_jwt_secret_must_be_at_least_32_chars_long';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { overrideDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import examRouter from './exams';
import { errorHandler } from '../middleware/errorHandler';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', examRouter);
  app.use(errorHandler);
  return app;
}

describe('Exam Session Pause/Resume Integration Tests', () => {
  let app: express.Express;
  let testDb: Database.Database;
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const user1Token = jwt.sign(
    { id: 'user-1', email: 'user1@example.com', role: 'user' },
    jwtSecret,
  );
  const user2Token = jwt.sign(
    { id: 'user-2', email: 'user2@example.com', role: 'user' },
    jwtSecret,
  );

  beforeEach(() => {
    testDb = new Database(':memory:');
    runMigrations(testDb);
    overrideDb(testDb);
    app = createApp();

    // Insert test users
    testDb
      .prepare(
        "INSERT INTO users (id, email, password, role) VALUES ('user-1', 'user1@example.com', 'hash', 'user')",
      )
      .run();
    testDb
      .prepare(
        "INSERT INTO users (id, email, password, role) VALUES ('user-2', 'user2@example.com', 'hash', 'user')",
      )
      .run();

    // Insert certification, topic, and question matching production schema columns
    testDb
      .prepare(
        `
      INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
      VALUES ('cert-1', 'AWS Developer Associate', 'AWS', 'AWS DVA', 'Associate', 0, 0)
    `,
      )
      .run();

    testDb
      .prepare(
        `
      INSERT INTO topics (id, certificationId, title, orderIndex, isActive, createdAt, updatedAt)
      VALUES ('topic-1', 'cert-1', 'EC2 Essentials', 1, 1, '2026-06-28', '2026-06-28')
    `,
      )
      .run();

    testDb
      .prepare(
        `
      INSERT INTO questions (id, topicId, questionText, questionType, options, correctAnswers, tags, createdAt, updatedAt)
      VALUES ('q-1', 'topic-1', 'Which is correct?', 'single', '["A", "B"]', '["A"]', '[]', '2026-06-28', '2026-06-28')
    `,
      )
      .run();
  });

  afterEach(() => {
    overrideDb(null);
    testDb.close();
  });

  it('fails with 401 when request is unauthorized', async () => {
    const res = await request(app).post('/api/exam-sessions/session-1/pause').send();
    expect(res.status).toBe(401);
  });

  it('fails with 404 when session belongs to another user', async () => {
    testDb
      .prepare(
        `
      INSERT INTO exam_sessions (id, userId, questions, status, totalQuestions, startTime, autoSubmitAt, createdAt, updatedAt)
      VALUES ('session-1', 'user-1', '["q-1"]', 'in_progress', 1, '2026-06-28T07:00:00Z', '2026-06-28T09:00:00Z', '2026-06-28T07:00:00Z', '2026-06-28T07:00:00Z')
    `,
      )
      .run();

    const res = await request(app)
      .post('/api/exam-sessions/session-1/pause')
      .set('Authorization', `Bearer ${user2Token}`)
      .send();
    expect(res.status).toBe(404);
  });

  it('fails with 400 when trying to pause a practice mode session', async () => {
    testDb
      .prepare(
        `
      INSERT INTO exam_sessions (id, userId, questions, status, totalQuestions, isPracticeMode, startTime, autoSubmitAt, createdAt, updatedAt)
      VALUES ('session-practice', 'user-1', '["q-1"]', 'in_progress', 1, 1, '2026-06-28T07:00:00Z', '2026-06-28T09:00:00Z', '2026-06-28T07:00:00Z', '2026-06-28T07:00:00Z')
    `,
      )
      .run();

    const res = await request(app)
      .post('/api/exam-sessions/session-practice/pause')
      .set('Authorization', `Bearer ${user1Token}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Practice mode sessions cannot be paused');
  });

  it('successfully pauses and resumes a session shifting deadlines correctly', async () => {
    const startTimeStr = new Date(Date.now() - 5000).toISOString();
    const autoSubmitAtStr = new Date(Date.now() + 3600000).toISOString(); // 1 hour remaining

    testDb
      .prepare(
        `
      INSERT INTO exam_sessions (id, userId, questions, status, totalQuestions, isPracticeMode, startTime, autoSubmitAt, createdAt, updatedAt)
      VALUES ('session-1', 'user-1', '["q-1"]', 'in_progress', 1, 0, ?, ?, ?, ?)
    `,
      )
      .run(startTimeStr, autoSubmitAtStr, startTimeStr, startTimeStr);

    // 1. Pause the session
    const pauseRes = await request(app)
      .post('/api/exam-sessions/session-1/pause')
      .set('Authorization', `Bearer ${user1Token}`)
      .send();

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body).toEqual({ ok: true, status: 'paused' });

    // Check DB status and pause details
    const dbSessionAfterPause = testDb
      .prepare("SELECT * FROM exam_sessions WHERE id = 'session-1'")
      .get() as any;
    expect(dbSessionAfterPause.status).toBe('paused');
    expect(dbSessionAfterPause.pauseCount).toBe(1);
    expect(dbSessionAfterPause.pausedAt).toBeDefined();

    // Mock a pause duration of 5 seconds (5000 ms) by shifting the pausedAt back in time
    const fakePausedAt = new Date(Date.now() - 5000).toISOString();
    testDb
      .prepare("UPDATE exam_sessions SET pausedAt = ? WHERE id = 'session-1'")
      .run(fakePausedAt);

    // 2. Resume the session
    const resumeRes = await request(app)
      .post('/api/exam-sessions/session-1/resume')
      .set('Authorization', `Bearer ${user1Token}`)
      .send();

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.ok).toBe(true);
    expect(resumeRes.body.status).toBe('in_progress');

    // Confirm that the deadline autoSubmitAt shifted by approximately 5 seconds
    const dbSessionAfterResume = testDb
      .prepare("SELECT * FROM exam_sessions WHERE id = 'session-1'")
      .get() as any;
    expect(dbSessionAfterResume.status).toBe('in_progress');
    expect(dbSessionAfterResume.accumulatedPausedMs).toBeGreaterThanOrEqual(5000);

    const originalDeadline = new Date(autoSubmitAtStr).getTime();
    const newDeadline = new Date(dbSessionAfterResume.autoSubmitAt).getTime();
    expect(newDeadline).toBeGreaterThanOrEqual(originalDeadline + 5000);
  });
});
