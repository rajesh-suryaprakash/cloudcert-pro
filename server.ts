import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { runMigrations } from './src/server/db/migrations';
import { db, closeDb } from './src/server/db/connection';
import { seedAdmin, seedAchievements, seedLearner } from './src/server/db/seeds';
import { seedGcpCertifications } from './src/server/db/seedCertifications';
import authRoutes from './src/server/routes/auth';
import certificationRoutes from './src/server/routes/certifications';
import examRoutes from './src/server/routes/exams';
import srsRoutes from './src/server/routes/srs';
import achievementRoutes from './src/server/routes/achievements';
import studyPlanRoutes from './src/server/routes/study-plan';
import insightsRoutes from './src/server/routes/insights';
import unitsRoutes from './src/server/routes/units';
import openapiRoutes from './src/server/openapi/routes';
import { errorHandler } from './src/server/middleware/errorHandler';
import { correlationId } from './src/server/middleware/correlationId';
import { httpLogger } from './src/server/middleware/httpLogger';
import { logger } from './src/server/logger';
import { config } from './src/server/config';
import { apiLimiter } from './src/server/middleware/rateLimiter';
import { registerAuthRoutes } from './src/server/openapi/auth-routes';
import { registerCertificationRoutes } from './src/server/openapi/certification-routes';
import { registerExamRoutes } from './src/server/openapi/exam-routes';
import { registerExamConfigRoutes } from './src/server/openapi/exam-config-routes';
import { registerTopicRoutes } from './src/server/openapi/topic-routes';
import { registerSubtopicRoutes } from './src/server/openapi/subtopic-routes';
import { registerQuestionRoutes } from './src/server/openapi/question-routes';
import { registerSubtopicQuestionRoutes } from './src/server/openapi/subtopic-question-routes';
import { registerAchievementRoutes } from './src/server/openapi/achievement-routes';
import { registerSrsRoutes } from './src/server/openapi/srs-routes';
import { registerStudyPlanRoutes } from './src/server/openapi/study-plan-routes';

// Register OpenAPI routes
registerAuthRoutes();
registerCertificationRoutes();
registerExamRoutes();
registerExamConfigRoutes();
registerTopicRoutes();
registerSubtopicRoutes();
registerQuestionRoutes();
registerSubtopicQuestionRoutes();
registerAchievementRoutes();
registerSrsRoutes();
registerStudyPlanRoutes();

const app = express();

// Disable X-Powered-By header for security (must be before helmet)
app.disable('x-powered-by');

// Additional middleware to ensure X-Powered-By is removed from all responses
app.use((_req, res, next) => {
  res.removeHeader('X-Powered-By');
  next();
});

// Security headers with Content Security Policy
// In development, use permissive CSP to allow Vite HMR with inline scripts and WebSocket
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  // Development: Very permissive CSP for Vite HMR and Swagger UI
  app.use(
    helmet({
      xPoweredBy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }),
  );
} else {
  // Production: Strict CSP with Swagger UI CDN allowed
  app.use(
    helmet({
      xPoweredBy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
}
// CORS configuration - restrict origins and allow credentials (for httpOnly cookies)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
// Parse cookies (required for httpOnly JWT cookie auth)
app.use(cookieParser());
// Limit request body size to prevent large payload attacks
app.use(express.json({ limit: '1mb' }));

// Logging middleware (must be before routes)
app.use(correlationId);
app.use(httpLogger);

// Initialize Database
runMigrations();
seedAdmin();
seedLearner();
seedAchievements();
seedGcpCertifications();

// Documentation Routes (mounted before API routes, no rate limiting)
// Requirements: 12.1, 12.2, 12.5, 15.3
app.use('/api-docs', openapiRoutes);

// API Routes
const apiRouter = express.Router();

// Apply base rate-limiting to all API routes
apiRouter.use(apiLimiter);

// Health check — used by the Docker HEALTHCHECK directive and Kubernetes probes.
// Verifies the DB connection is alive so orchestrators get accurate readiness signals.
// better-sqlite3 is synchronous — no await needed.
apiRouter.get('/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res
      .status(503)
      .json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
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

// Centralized error handling (must be last middleware)
app.use(errorHandler);

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${config.port}`);
  });

  // Graceful shutdown — flush in-flight requests and close the DB before exit.
  // Using SIGTERM (Docker/Kubernetes) and SIGINT (Ctrl+C / local dev).
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received, closing server...');
    server.close(() => {
      logger.info('HTTP server closed. Closing database...');
      closeDb();
      logger.info('Database closed. Exiting.');
      process.exit(0);
    });

    // Force-exit after 10s if graceful shutdown stalls
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

startServer();
