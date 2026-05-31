import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AnalyticsService } from '../services/AnalyticsService';
import { BenchmarkService } from '../services/BenchmarkService';
import { StudyListService } from '../services/StudyListService';
import retryService from '../services/RetryService';
import { cacheService } from '../services/CacheService';
import { NotFoundError, ValidationError } from '../errors';
import { db } from '../db/connection';

const router = express.Router();

const analyticsService = new AnalyticsService();
const benchmarkService = new BenchmarkService();
const studyListService = new StudyListService();

/**
 * GET /api/insights/dashboard/:certificationId
 * Returns complete dashboard data for a certification
 * Requirements: 1.1, 2.1, 4.1, 5.1, 8.1, 9.1, 10.1, 17.1, 19.1, 24.3
 *
 * Query Parameters:
 * - examType: 'mock' | 'practice' (optional, default: 'mock')
 * - difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed' (optional, default: 'Easy')
 */
router.get(
  '/insights/dashboard/:certificationId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificationId } = req.params;
      const userId = req.user?.id as string;

      // Extract filter parameters
      const examType = (req.query.examType as string) || 'mock';
      const difficulty = (req.query.difficulty as string) || 'Easy';

      // Build filter options
      const filterOptions = {
        examType: examType as 'mock' | 'practice',
        difficulty: difficulty as 'Easy' | 'Medium' | 'Hard' | 'Mixed',
      };

      // Check cache first (include filters in cache key)
      const cacheKey = `dashboard:${userId}:${certificationId}:${examType}:${difficulty}`;
      const cached = cacheService.get<Record<string, unknown>>(cacheKey);

      if (cached) {
        return res.json(cached);
      }

      // Compute all metrics with filters
      const domainProficiency = analyticsService.calculateDomainProficiency(
        userId,
        certificationId,
        filterOptions,
      );
      const readinessScore = analyticsService.calculateReadinessScore(
        userId,
        certificationId,
        filterOptions,
      );
      const doubleDownMetric = analyticsService.identifyDoubleDownMetric(
        userId,
        certificationId,
        filterOptions,
      );
      const timeAnalysis = analyticsService.analyzeTimePerQuestion(
        userId,
        certificationId,
        filterOptions,
      );
      const hesitationAnalysis = analyticsService.analyzeHesitationPatterns(
        userId,
        certificationId,
        filterOptions,
      );
      const certaintyMatrix = analyticsService.generateCertaintyMatrix(
        userId,
        certificationId,
        filterOptions,
      );
      const consistencyMetric = analyticsService.calculateConsistencyMetric(
        userId,
        certificationId,
        filterOptions,
      );
      const communityBenchmarks = benchmarkService.getCommunityAverages(
        certificationId,
        filterOptions,
      );
      const roiRecommendations = studyListService.getTopRecommendations(userId, certificationId, 5);

      // Populate user scores in community benchmarks
      const enrichedBenchmarks = communityBenchmarks.map((benchmark) => {
        let userScore = 0;
        let difference = 0;

        if (benchmark.domainId) {
          const domain = domainProficiency.find((d) => d.domainId === benchmark.domainId);
          userScore = domain?.proficiencyScore || 0;
        } else if (benchmark.topicId) {
          const topics = analyticsService.calculateTopicProficiency(
            userId,
            certificationId,
            filterOptions,
          );
          const topic = topics.find((t) => t.topicId === benchmark.topicId);
          userScore = topic?.proficiencyScore || 0;
        }

        difference = userScore - benchmark.communityAverage;
        const needsImprovement = userScore < benchmark.communityAverage;

        return {
          ...benchmark,
          userScore,
          difference,
          needsImprovement,
        };
      });

      const response = {
        readinessScore,
        domainProficiency,
        doubleDownMetric,
        timeAnalysis,
        hesitationAnalysis,
        certaintyMatrix,
        consistencyMetric,
        communityBenchmarks: enrichedBenchmarks,
        roiRecommendations,
        lastUpdated: new Date().toISOString(),
      };

      // Cache for 5 minutes (300 seconds)
      cacheService.set(cacheKey, response, 300);

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insights/domain/:domainId/topics
 * Returns topic-level proficiency breakdown for a domain
 * Requirements: 3.1, 3.2
 */
router.get(
  '/insights/domain/:domainId/topics',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domainId } = req.params;
      const userId = req.user?.id as string;

      // Get certification ID from query parameter
      const certificationId = req.query.certificationId as string;
      if (!certificationId) {
        return res.status(400).json({ error: 'certificationId query parameter is required' });
      }

      // Get all topics for the certification
      const allTopics = analyticsService.calculateTopicProficiency(userId, certificationId);

      // Filter topics by domain
      const domainTopics = allTopics.filter((topic) => topic.domainId === domainId);

      // domainId is actually the domainName in this context
      const domainName = domainId;

      res.json({
        domainId,
        domainName,
        topics: domainTopics,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insights/topic/:topicId/subtopics
 * Returns subtopic-level proficiency breakdown for a topic
 * Requirements: 3.2, 3.5
 */
router.get(
  '/insights/topic/:topicId/subtopics',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { topicId } = req.params;
      const userId = req.user?.id as string;

      // Get certification ID from query parameter
      const certificationId = req.query.certificationId as string;
      if (!certificationId) {
        return res.status(400).json({ error: 'certificationId query parameter is required' });
      }

      // Get all subtopics for the certification
      const allSubtopics = analyticsService.calculateSubtopicProficiency(userId, certificationId);

      // Filter subtopics by topic
      const topicSubtopics = allSubtopics.filter((subtopic) => subtopic.topicId === topicId);

      // Get topic name
      const topicQuery = db
        .prepare('SELECT title FROM topics WHERE id = ? LIMIT 1')
        .get(topicId) as { title: string } | undefined;

      if (!topicQuery) {
        return next(new NotFoundError('Topic not found'));
      }

      res.json({
        topicId,
        topicName: topicQuery.title,
        subtopics: topicSubtopics,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insights/subtopic/:subtopicId/units
 * Returns unit-level proficiency breakdown for a subtopic
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
router.get(
  '/insights/subtopic/:subtopicId/units',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subtopicId } = req.params;
      const userId = req.user?.id as string;

      // Get certification ID from query parameter
      const certificationId = req.query.certificationId as string;
      if (!certificationId) {
        return res.status(400).json({ error: 'certificationId query parameter is required' });
      }

      // Verify subtopic exists
      const subtopicQuery = db
        .prepare('SELECT id, title FROM subtopics WHERE id = ? LIMIT 1')
        .get(subtopicId) as { id: string; title: string } | undefined;

      if (!subtopicQuery) {
        return next(new NotFoundError('Subtopic not found'));
      }

      // Get all unit proficiency for the certification and filter to this subtopic
      const allUnits = analyticsService.calculateUnitProficiency(userId, certificationId);
      const subtopicUnits = allUnits.filter((unit) => unit.subtopicId === subtopicId);

      res.json({
        subtopicId,
        subtopicName: subtopicQuery.title,
        units: subtopicUnits,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insights/session/:sessionId/fatigue
 * Returns fatigue analysis for a specific exam session
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
router.get(
  '/insights/session/:sessionId/fatigue',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id as string;

      // Verify session belongs to user
      const sessionQuery = db
        .prepare('SELECT id FROM exam_sessions WHERE id = ? AND userId = ? LIMIT 1')
        .get(sessionId, userId) as { id: string } | undefined;

      if (!sessionQuery) {
        return next(new NotFoundError('Session not found'));
      }

      const fatigueAnalysis = analyticsService.calculateFatigueFactor(sessionId);

      res.json({
        sessionId,
        fatigueAnalysis,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insights/study-list/:sessionId
 * Generates study list from a completed exam session
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
router.get(
  '/insights/study-list/:sessionId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id as string;

      // Verify session belongs to user
      const sessionQuery = db
        .prepare('SELECT id, status FROM exam_sessions WHERE id = ? AND userId = ? LIMIT 1')
        .get(sessionId, userId) as { id: string; status: string } | undefined;

      if (!sessionQuery) {
        return next(new NotFoundError('Session not found'));
      }

      if (sessionQuery.status !== 'completed') {
        return res.status(400).json({ error: 'Session must be completed to generate study list' });
      }

      const studyList = studyListService.generateStudyList(sessionId);

      res.json({
        sessionId,
        studyList,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/insights/retry-missed/:sessionId
 * Creates a new exam session with only missed questions from the original session
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */
router.post(
  '/insights/retry-missed/:sessionId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id as string;

      const result = retryService.createRetryFromSession(sessionId, userId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insights/topic/:topicId/questions
 * Returns questions with answers for review for a specific topic
 * Requirements: 12.1, 25.5
 */
router.get(
  '/insights/topic/:topicId/questions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { topicId } = req.params;
      const userId = req.user?.id as string;

      // Get pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Get certification ID from query parameter
      const certificationId = req.query.certificationId as string;
      if (!certificationId) {
        return res.status(400).json({ error: 'certificationId query parameter is required' });
      }

      // Verify topic exists and belongs to certification
      const topicQuery = db
        .prepare(
          `
          SELECT t.id, t.title, t.certificationId
          FROM topics t
          WHERE t.id = ? AND t.certificationId = ?
          LIMIT 1
        `,
        )
        .get(topicId, certificationId) as
        | { id: string; title: string; certificationId: string }
        | undefined;

      if (!topicQuery) {
        return next(new NotFoundError('Topic not found'));
      }

      // Get questions with incorrect answers for this topic
      const questionsQuery = db
        .prepare(
          `
          SELECT DISTINCT 
            q.id,
            q.questionText,
            q.options,
            q.correctAnswers,
            q.explanation,
            q.distractorExplanations,
            ea.userAnswer as userAnswers,
            ea.isCorrect,
            es.id as sessionId,
            es.createdAt as sessionDate
          FROM questions q
          INNER JOIN exam_answers ea ON q.id = ea.questionId
          INNER JOIN exam_sessions es ON ea.examSessionId = es.id
          WHERE q.topicId = ? 
            AND es.userId = ? 
            AND es.status = 'completed'
            AND ea.isCorrect = 0
          ORDER BY es.createdAt DESC, ea.answerOrder ASC
          LIMIT ? OFFSET ?
        `,
        )
        .all(topicId, userId, limit, offset) as Array<{
        id: string;
        questionText: string;
        options: string;
        correctAnswers: string;
        explanation: string | null;
        distractorExplanations: string | null;
        userAnswers: string;
        isCorrect: number;
        sessionId: string;
        sessionDate: string;
      }>;

      // Get total count for pagination
      const countQuery = db
        .prepare(
          `
          SELECT COUNT(DISTINCT q.id) as total
          FROM questions q
          INNER JOIN exam_answers ea ON q.id = ea.questionId
          INNER JOIN exam_sessions es ON ea.examSessionId = es.id
          WHERE q.topicId = ? 
            AND es.userId = ? 
            AND es.status = 'completed'
            AND ea.isCorrect = 0
        `,
        )
        .get(topicId, userId) as { total: number };

      // Transform the data
      const questions = questionsQuery.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: JSON.parse(q.options),
        correctAnswers: JSON.parse(q.correctAnswers),
        userAnswers: JSON.parse(q.userAnswers),
        isCorrect: q.isCorrect === 1,
        explanation: q.explanation,
        distractorExplanations: q.distractorExplanations
          ? JSON.parse(q.distractorExplanations)
          : null,
        sessionId: q.sessionId,
        sessionDate: q.sessionDate,
      }));

      const totalPages = Math.ceil(countQuery.total / limit);

      res.json({
        topicId,
        topicName: topicQuery.title,
        questions,
        pagination: {
          page,
          limit,
          total: countQuery.total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/insights/real-exam-result
 * Records user's real exam result for benchmark data
 * Requirements: 21.1, 21.2, 21.4
 */
router.post(
  '/insights/real-exam-result',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id as string;
      const { certificationId, passed, examDate } = req.body;

      if (!certificationId || typeof passed !== 'boolean') {
        return next(new ValidationError('certificationId and passed (boolean) are required'));
      }

      // Verify certification exists
      const certQuery = db
        .prepare('SELECT id FROM certifications WHERE id = ? LIMIT 1')
        .get(certificationId) as { id: string } | undefined;

      if (!certQuery) {
        return next(new NotFoundError('Certification not found'));
      }

      // Record the result
      const benchmarkUserId = benchmarkService.recordRealExamResult(
        userId,
        certificationId,
        passed,
        examDate,
      );

      // Trigger benchmark aggregation refresh for the certification
      benchmarkService.refreshBenchmarkAggregations(certificationId);

      res.json({
        success: true,
        benchmarkUserId,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/admin/domain-weights/:certificationId
 * Admin endpoint to retrieve domain weights for a certification
 * Requirements: 22.1, 22.3
 */
router.get(
  '/admin/domain-weights/:certificationId',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificationId } = req.params;

      // Verify certification exists
      const certQuery = db
        .prepare('SELECT id FROM certifications WHERE id = ? LIMIT 1')
        .get(certificationId) as { id: string } | undefined;

      if (!certQuery) {
        return next(new NotFoundError('Certification not found'));
      }

      // Get all domain weights for this certification
      const domains = db
        .prepare(
          `
          SELECT id, domainName, weightPercentage
          FROM domain_weights
          WHERE certificationId = ?
          ORDER BY domainName
        `,
        )
        .all(certificationId) as Array<{
        id: string;
        domainName: string;
        weightPercentage: number;
      }>;

      // Calculate total weight
      const totalWeight = domains.reduce((sum, d) => sum + d.weightPercentage, 0);

      res.json({
        certificationId,
        domains,
        totalWeight,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/admin/domain-weights/:certificationId
 * Admin endpoint to update domain weights for a certification
 * Requirements: 22.2, 22.3, 22.4, 22.5
 */
router.put(
  '/admin/domain-weights/:certificationId',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificationId } = req.params;
      const { domains } = req.body;

      if (!Array.isArray(domains)) {
        return next(new ValidationError('domains must be an array'));
      }

      // Verify certification exists
      const certQuery = db
        .prepare('SELECT id FROM certifications WHERE id = ? LIMIT 1')
        .get(certificationId) as { id: string } | undefined;

      if (!certQuery) {
        return next(new NotFoundError('Certification not found'));
      }

      // Validate each weight is between 0 and 100
      for (const domain of domains) {
        if (
          typeof domain.weightPercentage !== 'number' ||
          domain.weightPercentage < 0 ||
          domain.weightPercentage > 100
        ) {
          return next(
            new ValidationError(`Weight for ${domain.domainName} must be between 0 and 100`),
          );
        }
      }

      // Validate sum of weights equals 100
      const totalWeight = domains.reduce(
        (sum: number, d: { weightPercentage: number }) => sum + d.weightPercentage,
        0,
      );
      if (Math.abs(totalWeight - 100) > 0.01) {
        // Allow small floating point errors
        return next(new ValidationError(`Sum of weights must equal 100 (current: ${totalWeight})`));
      }

      // Update domain weights in a transaction
      const updateStmt = db.prepare(`
        INSERT INTO domain_weights (id, certificationId, domainName, weightPercentage, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(certificationId, domainName) 
        DO UPDATE SET 
          weightPercentage = excluded.weightPercentage,
          updatedAt = excluded.updatedAt
      `);

      const transaction = db.transaction(
        (domains: { domainName: string; weightPercentage: number }[]) => {
          for (const domain of domains) {
            const id = randomUUID();
            const updatedAt = new Date().toISOString();
            updateStmt.run(
              id,
              certificationId,
              domain.domainName,
              domain.weightPercentage,
              updatedAt,
            );
          }
        },
      );

      transaction(domains);

      // Invalidate cached readiness scores for this certification
      cacheService.invalidate(`dashboard:*:${certificationId}:*`);

      res.json({
        success: true,
        message: 'Domain weights updated successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
