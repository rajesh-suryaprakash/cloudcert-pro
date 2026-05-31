import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { runMigrations } from './src/server/db/migrations';
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
app.use((req, res, next) => {
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
app.use('/api', authRoutes);
app.use('/api', certificationRoutes);
app.use('/api', examRoutes);
app.use('/api/srs', srsRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api', studyPlanRoutes);
app.use('/api', insightsRoutes);
app.use('/api', unitsRoutes);

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${config.port}`);
  });
}

startServer();
