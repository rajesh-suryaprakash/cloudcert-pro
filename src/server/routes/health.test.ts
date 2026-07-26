import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { db, overrideDb } from '../db/connection';
import { runMigrations } from '../db/migrations';
import { errorHandler } from '../middleware/errorHandler';

// Import routers
import authRoutes from './auth';
import certificationRoutes from './certifications';
import examRoutes from './exams';
import srsRoutes from './srs';
import achievementRoutes from './achievements';
import studyPlanRoutes from './study-plan';
import insightsRoutes from './insights';
import unitsRoutes from './units';

function createApp() {
  const app = express();
  app.use(express.json());

  const apiRouter = express.Router();

  apiRouter.get('/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(503).json({
        status: 'error',
        db: 'disconnected',
        error: err?.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  apiRouter.use(authRoutes);
  apiRouter.use(certificationRoutes);
  apiRouter.use(examRoutes);
  apiRouter.use('/srs', srsRoutes);
  apiRouter.use('/achievements', achievementRoutes);
  apiRouter.use(studyPlanRoutes);
  apiRouter.use(insightsRoutes);
  apiRouter.use(unitsRoutes);

  app.use('/api', apiRouter);
  app.use('/api/v1', apiRouter);
  app.use(errorHandler);

  return app;
}

describe('Health Check Routes Integration', () => {
  let app: express.Express;
  let testDb: Database.Database;

  beforeEach(() => {
    testDb = new Database(':memory:');
    runMigrations(testDb);
    overrideDb(testDb);
    app = createApp();
  });

  afterEach(() => {
    overrideDb(null);
    testDb.close();
  });

  it('GET /api/health should return 200 when database is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/v1/health should return 200 when database is connected', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/health should return 503 when database is disconnected', async () => {
    // Force a closed state or error on Select 1
    testDb.close();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.db).toBe('disconnected');
  });
});
