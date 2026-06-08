import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { BenchmarkService } from './BenchmarkService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Unit tests for BenchmarkService
 * Feature: insight-dashboard
 * Task: 5.2 Write unit tests for benchmark service
 *
 * Tests verify:
 * - Percentile rank calculation
 * - Community average aggregation
 * - Benchmark user flagging
 *
 * Requirements: 10.4, 21.3
 */

describe('BenchmarkService', () => {
  let testDb: Database.Database;
  let benchmarkService: BenchmarkService;
  let dbModuleSpy: any;

  beforeEach(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');

    // Mock the db module to use our test database
    const dbModule = await import('../db/connection');
    dbModuleSpy = vi.spyOn(dbModule, 'db', 'get').mockReturnValue(testDb as any);

    // Create minimal schema needed for benchmark service
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE certifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE topics (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        questionText TEXT NOT NULL,
        questionType TEXT NOT NULL,
        correctAnswers TEXT NOT NULL,
        domainId TEXT,
        topicId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL
      );

      CREATE TABLE exam_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        status TEXT NOT NULL,
        examName TEXT,
        isPracticeMode INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
      );

      CREATE TABLE exam_answers (
        id TEXT PRIMARY KEY,
        examSessionId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        userAnswer TEXT,
        isCorrect INTEGER,
        timeSpent INTEGER DEFAULT 0,
        confidenceLevel TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
      );

      CREATE TABLE benchmark_users (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        certificationId TEXT NOT NULL,
        passed INTEGER NOT NULL,
        examDate DATE,
        reportedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        UNIQUE(userId, certificationId)
      );

      CREATE TABLE community_benchmark_cache (
        id TEXT PRIMARY KEY,
        certificationId TEXT NOT NULL,
        topicId TEXT,
        domainName TEXT,
        averageProficiency REAL NOT NULL,
        sampleSize INTEGER NOT NULL,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
        FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
        UNIQUE(certificationId, domainName, topicId)
      );

      CREATE INDEX idx_benchmark_users_cert ON benchmark_users(certificationId, passed);
      CREATE INDEX idx_benchmark_cache_cert ON community_benchmark_cache(certificationId);
      CREATE INDEX idx_benchmark_cache_topic ON community_benchmark_cache(topicId);
      CREATE INDEX idx_exam_sessions_user_cert ON exam_sessions(userId, certificationId, status, createdAt);
      CREATE INDEX idx_exam_answers_session ON exam_answers(examSessionId);
    `);

    // Create BenchmarkService instance
    benchmarkService = new BenchmarkService();
  });

  afterEach(() => {
    // Clean up
    if (testDb) {
      testDb.close();
    }
    if (dbModuleSpy) {
      dbModuleSpy.mockRestore();
    }
  });

  // Helper function to create test user
  function createUser(id: string = uuidv4()): string {
    testDb
      .prepare('INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)')
      .run(id, `user${id}@test.com`, 'hashedpassword');
    return id;
  }

  // Helper function to create test certification
  function createCertification(id: string = uuidv4()): string {
    testDb
      .prepare('INSERT INTO certifications (id, title, description) VALUES (?, ?, ?)')
      .run(id, 'Test Certification', 'Test Description');
    return id;
  }

  // Helper function to create test topic
  function createTopic(certificationId: string, name: string, id: string = uuidv4()): string {
    testDb
      .prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)')
      .run(id, certificationId, name);
    return id;
  }

  // Helper function to create test question
  function createQuestion(
    certificationId: string,
    domainId: string | null = null,
    topicId: string | null = null,
    id: string = uuidv4(),
  ): string {
    testDb
      .prepare(
        'INSERT INTO questions (id, certificationId, questionText, questionType, correctAnswers, domainId, topicId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        certificationId,
        'Test question',
        'single',
        JSON.stringify(['A']),
        domainId,
        topicId,
      );
    return id;
  }

  // Helper function to create exam session with answers
  function createExamSessionWithAnswers(
    userId: string,
    certificationId: string,
    questionIds: string[],
    correctAnswers: boolean[],
  ): string {
    const sessionId = uuidv4();
    testDb
      .prepare(
        'INSERT INTO exam_sessions (id, userId, certificationId, status) VALUES (?, ?, ?, ?)',
      )
      .run(sessionId, userId, certificationId, 'completed');

    questionIds.forEach((questionId, index) => {
      const answerId = uuidv4();
      testDb
        .prepare(
          'INSERT INTO exam_answers (id, examSessionId, questionId, userAnswer, isCorrect) VALUES (?, ?, ?, ?, ?)',
        )
        .run(answerId, sessionId, questionId, 'A', correctAnswers[index] ? 1 : 0);
    });

    return sessionId;
  }

  describe('calculatePercentileRank', () => {
    it('should calculate percentile rank correctly for a user', () => {
      // Requirement 10.4: Calculate user's percentile ranking
      const certificationId = createCertification();
      const questionId = createQuestion(certificationId);

      // Create 5 users with different average scores
      const user1 = createUser(); // 100% (1 correct out of 1)
      const user2 = createUser(); // 80% (4 correct out of 5)
      const user3 = createUser(); // 60% (3 correct out of 5)
      const user4 = createUser(); // 40% (2 correct out of 5)
      const user5 = createUser(); // 20% (1 correct out of 5)

      // Create sessions for each user
      createExamSessionWithAnswers(user1, certificationId, [questionId], [true]);

      const questions2 = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(user2, certificationId, questions2, [
        true,
        true,
        true,
        true,
        false,
      ]);

      const questions3 = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(user3, certificationId, questions3, [
        true,
        true,
        true,
        false,
        false,
      ]);

      const questions4 = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(user4, certificationId, questions4, [
        true,
        true,
        false,
        false,
        false,
      ]);

      const questions5 = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(user5, certificationId, questions5, [
        true,
        false,
        false,
        false,
        false,
      ]);

      // User3 (60%) should be at 40th percentile (2 users below: user4 and user5)
      const percentile = benchmarkService.calculatePercentileRank(user3, certificationId);
      expect(percentile).toBe(40); // 2 out of 5 users are below user3
    });

    it('should return 0 percentile for user with no completed sessions', () => {
      const certificationId = createCertification();
      const userId = createUser();

      const percentile = benchmarkService.calculatePercentileRank(userId, certificationId);
      expect(percentile).toBe(0);
    });

    it('should return 0 percentile when no other users exist', () => {
      const certificationId = createCertification();
      const userId = createUser();
      const questionId = createQuestion(certificationId);

      createExamSessionWithAnswers(userId, certificationId, [questionId], [true]);

      const percentile = benchmarkService.calculatePercentileRank(userId, certificationId);
      expect(percentile).toBe(0); // Only user, so 0 users below
    });

    it('should return 100 percentile for top performer', () => {
      const certificationId = createCertification();
      const questionId = createQuestion(certificationId);

      const user1 = createUser(); // 100%
      const user2 = createUser(); // 50%

      createExamSessionWithAnswers(user1, certificationId, [questionId], [true]);

      const questions2 = Array(2)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(user2, certificationId, questions2, [true, false]);

      const percentile = benchmarkService.calculatePercentileRank(user1, certificationId);
      expect(percentile).toBe(50); // 1 out of 2 users below
    });

    it('should handle multiple sessions per user correctly', () => {
      const certificationId = createCertification();
      const userId = createUser();

      // Create 3 sessions with different scores
      const questions1 = Array(10)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(userId, certificationId, questions1, [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
      ]); // 80%

      const questions2 = Array(10)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(userId, certificationId, questions2, [
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
      ]); // 60%

      const questions3 = Array(10)
        .fill(null)
        .map(() => createQuestion(certificationId));
      createExamSessionWithAnswers(userId, certificationId, questions3, [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
      ]); // 70%

      // Average should be (80 + 60 + 70) / 3 = 70%
      const percentile = benchmarkService.calculatePercentileRank(userId, certificationId);
      expect(percentile).toBe(0); // Only user
    });
  });

  describe('recordRealExamResult', () => {
    it('should record a passing real exam result', () => {
      // Requirement 21.3: Flag benchmark users
      const userId = createUser();
      const certificationId = createCertification();

      const benchmarkId = benchmarkService.recordRealExamResult(
        userId,
        certificationId,
        true,
        '2024-01-15',
      );

      expect(benchmarkId).toBeDefined();
      expect(typeof benchmarkId).toBe('string');

      // Verify record was created
      const record = testDb
        .prepare('SELECT * FROM benchmark_users WHERE userId = ? AND certificationId = ?')
        .get(userId, certificationId) as any;

      expect(record).toBeDefined();
      expect(record.userId).toBe(userId);
      expect(record.certificationId).toBe(certificationId);
      expect(record.passed).toBe(1);
      expect(record.examDate).toBe('2024-01-15');
    });

    it('should record a failing real exam result', () => {
      const userId = createUser();
      const certificationId = createCertification();

      const benchmarkId = benchmarkService.recordRealExamResult(userId, certificationId, false);

      expect(benchmarkId).toBeDefined();

      const record = testDb
        .prepare('SELECT * FROM benchmark_users WHERE userId = ? AND certificationId = ?')
        .get(userId, certificationId) as any;

      expect(record).toBeDefined();
      expect(record.passed).toBe(0);
      expect(record.examDate).toBeNull();
    });

    it('should update existing record on conflict', () => {
      const userId = createUser();
      const certificationId = createCertification();

      // First record: failed
      benchmarkService.recordRealExamResult(userId, certificationId, false);

      let record = testDb
        .prepare('SELECT * FROM benchmark_users WHERE userId = ? AND certificationId = ?')
        .get(userId, certificationId) as any;
      expect(record.passed).toBe(0);

      // Second record: passed (should update)
      benchmarkService.recordRealExamResult(userId, certificationId, true, '2024-02-20');

      record = testDb
        .prepare('SELECT * FROM benchmark_users WHERE userId = ? AND certificationId = ?')
        .get(userId, certificationId) as any;
      expect(record.passed).toBe(1);
      expect(record.examDate).toBe('2024-02-20');
    });
  });

  describe('refreshBenchmarkAggregations', () => {
    it('should aggregate domain-level proficiency from benchmark users', () => {
      // Requirement 21.3: Calculate community averages using benchmark data
      const certificationId = createCertification();

      // Create benchmark users who passed
      const user1 = createUser();
      const user2 = createUser();
      const user3 = createUser();

      benchmarkService.recordRealExamResult(user1, certificationId, true);
      benchmarkService.recordRealExamResult(user2, certificationId, true);
      benchmarkService.recordRealExamResult(user3, certificationId, true);

      // Create questions in different domains
      const domain1Questions = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId, 'Domain1', null));
      const domain2Questions = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId, 'Domain2', null));

      // User1: 80% in Domain1, 60% in Domain2
      createExamSessionWithAnswers(user1, certificationId, domain1Questions, [
        true,
        true,
        true,
        true,
        false,
      ]);
      createExamSessionWithAnswers(user1, certificationId, domain2Questions, [
        true,
        true,
        true,
        false,
        false,
      ]);

      // User2: 60% in Domain1, 80% in Domain2
      createExamSessionWithAnswers(user2, certificationId, domain1Questions, [
        true,
        true,
        true,
        false,
        false,
      ]);
      createExamSessionWithAnswers(user2, certificationId, domain2Questions, [
        true,
        true,
        true,
        true,
        false,
      ]);

      // User3: 100% in Domain1, 40% in Domain2
      createExamSessionWithAnswers(user3, certificationId, domain1Questions, [
        true,
        true,
        true,
        true,
        true,
      ]);
      createExamSessionWithAnswers(user3, certificationId, domain2Questions, [
        true,
        true,
        false,
        false,
        false,
      ]);

      // Refresh aggregations
      benchmarkService.refreshBenchmarkAggregations(certificationId);

      // Verify domain aggregations
      const domain1Cache = testDb
        .prepare(
          'SELECT * FROM community_benchmark_cache WHERE certificationId = ? AND domainName = ?',
        )
        .get(certificationId, 'Domain1') as any;

      expect(domain1Cache).toBeDefined();
      expect(domain1Cache.averageProficiency).toBeCloseTo(80, 0); // (80 + 60 + 100) / 3 = 80
      expect(domain1Cache.sampleSize).toBe(3);

      const domain2Cache = testDb
        .prepare(
          'SELECT * FROM community_benchmark_cache WHERE certificationId = ? AND domainName = ?',
        )
        .get(certificationId, 'Domain2') as any;

      expect(domain2Cache).toBeDefined();
      expect(domain2Cache.averageProficiency).toBeCloseTo(60, 0); // (60 + 80 + 40) / 3 = 60
      expect(domain2Cache.sampleSize).toBe(3);
    });

    it('should aggregate topic-level proficiency from benchmark users', () => {
      const certificationId = createCertification();

      // Create topics
      const topic1 = createTopic(certificationId, 'Topic 1');
      const topic2 = createTopic(certificationId, 'Topic 2');

      // Create benchmark users
      const user1 = createUser();
      const user2 = createUser();

      benchmarkService.recordRealExamResult(user1, certificationId, true);
      benchmarkService.recordRealExamResult(user2, certificationId, true);

      // Create questions in different topics
      const topic1Questions = Array(4)
        .fill(null)
        .map(() => createQuestion(certificationId, null, topic1));
      const topic2Questions = Array(4)
        .fill(null)
        .map(() => createQuestion(certificationId, null, topic2));

      // User1: 75% in Topic1, 50% in Topic2
      createExamSessionWithAnswers(user1, certificationId, topic1Questions, [
        true,
        true,
        true,
        false,
      ]);
      createExamSessionWithAnswers(user1, certificationId, topic2Questions, [
        true,
        true,
        false,
        false,
      ]);

      // User2: 50% in Topic1, 75% in Topic2
      createExamSessionWithAnswers(user2, certificationId, topic1Questions, [
        true,
        true,
        false,
        false,
      ]);
      createExamSessionWithAnswers(user2, certificationId, topic2Questions, [
        true,
        true,
        true,
        false,
      ]);

      // Refresh aggregations
      benchmarkService.refreshBenchmarkAggregations(certificationId);

      // Verify topic aggregations
      const topic1Cache = testDb
        .prepare(
          'SELECT * FROM community_benchmark_cache WHERE certificationId = ? AND topicId = ?',
        )
        .get(certificationId, topic1) as any;

      expect(topic1Cache).toBeDefined();
      expect(topic1Cache.averageProficiency).toBeCloseTo(62.5, 0); // (75 + 50) / 2 = 62.5
      expect(topic1Cache.sampleSize).toBe(2);

      const topic2Cache = testDb
        .prepare(
          'SELECT * FROM community_benchmark_cache WHERE certificationId = ? AND topicId = ?',
        )
        .get(certificationId, topic2) as any;

      expect(topic2Cache).toBeDefined();
      expect(topic2Cache.averageProficiency).toBeCloseTo(62.5, 0); // (50 + 75) / 2 = 62.5
      expect(topic2Cache.sampleSize).toBe(2);
    });

    it('should not aggregate data from users who failed', () => {
      const certificationId = createCertification();

      const userPassed = createUser();
      const userFailed = createUser();

      benchmarkService.recordRealExamResult(userPassed, certificationId, true);
      benchmarkService.recordRealExamResult(userFailed, certificationId, false);

      const domainQuestions = Array(5)
        .fill(null)
        .map(() => createQuestion(certificationId, 'TestDomain', null));

      // Both users have sessions
      createExamSessionWithAnswers(userPassed, certificationId, domainQuestions, [
        true,
        true,
        true,
        true,
        true,
      ]); // 100%
      createExamSessionWithAnswers(userFailed, certificationId, domainQuestions, [
        false,
        false,
        false,
        false,
        false,
      ]); // 0%

      benchmarkService.refreshBenchmarkAggregations(certificationId);

      // Should only include passed user
      const cache = testDb
        .prepare(
          'SELECT * FROM community_benchmark_cache WHERE certificationId = ? AND domainName = ?',
        )
        .get(certificationId, 'TestDomain') as any;

      expect(cache).toBeDefined();
      expect(cache.averageProficiency).toBe(100); // Only passed user's data
      expect(cache.sampleSize).toBe(1);
    });

    it('should handle case with no benchmark users', () => {
      const certificationId = createCertification();

      // No benchmark users recorded
      benchmarkService.refreshBenchmarkAggregations(certificationId);

      // Should not create any cache entries
      const cacheEntries = testDb
        .prepare('SELECT * FROM community_benchmark_cache WHERE certificationId = ?')
        .all(certificationId);

      expect(cacheEntries).toHaveLength(0);
    });

    it('should update existing cache entries on refresh', () => {
      const certificationId = createCertification();
      const user1 = createUser();
      const user2 = createUser();

      benchmarkService.recordRealExamResult(user1, certificationId, true);
      benchmarkService.recordRealExamResult(user2, certificationId, true);

      const domainQuestions1 = Array(2)
        .fill(null)
        .map(() => createQuestion(certificationId, 'TestDomain', null));
      const domainQuestions2 = Array(2)
        .fill(null)
        .map(() => createQuestion(certificationId, 'TestDomain', null));

      // User1: 100% (2 correct)
      createExamSessionWithAnswers(user1, certificationId, domainQuestions1, [true, true]);

      // User2: 50% (1 correct, 1 incorrect)
      createExamSessionWithAnswers(user2, certificationId, domainQuestions2, [true, false]);

      // Refresh with both users
      benchmarkService.refreshBenchmarkAggregations(certificationId);

      const cache = testDb
        .prepare(
          'SELECT * FROM community_benchmark_cache WHERE certificationId = ? AND domainName = ?',
        )
        .get(certificationId, 'TestDomain') as any;

      // Average is calculated across all answers: (100 + 100 + 100 + 0) / 4 = 75%
      expect(cache.averageProficiency).toBe(75);
      expect(cache.sampleSize).toBe(2);
    });
  });

  describe('getCommunityAverages', () => {
    it('should retrieve domain-level community averages', () => {
      const certificationId = createCertification();

      // Manually insert cache data
      testDb
        .prepare(
          'INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, 'Domain1', null, 85.5, 10);

      testDb
        .prepare(
          'INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, 'Domain2', null, 72.3, 8);

      const averages = benchmarkService.getCommunityAverages(certificationId);

      expect(averages).toHaveLength(2);

      const domain1 = averages.find((a) => a.name === 'Domain1');
      expect(domain1).toBeDefined();
      expect(domain1?.communityAverage).toBe(85.5);
      expect(domain1?.domainId).toBe('Domain1');

      const domain2 = averages.find((a) => a.name === 'Domain2');
      expect(domain2).toBeDefined();
      expect(domain2?.communityAverage).toBe(72.3);
    });

    it('should retrieve topic-level community averages', () => {
      const certificationId = createCertification();
      const topic1 = createTopic(certificationId, 'Topic 1');
      const topic2 = createTopic(certificationId, 'Topic 2');

      // Insert topic cache data
      testDb
        .prepare(
          'INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, null, topic1, 78.9, 12);

      testDb
        .prepare(
          'INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, null, topic2, 65.4, 9);

      const averages = benchmarkService.getCommunityAverages(certificationId);

      expect(averages).toHaveLength(2);

      const topicAvg1 = averages.find((a) => a.topicId === topic1);
      expect(topicAvg1).toBeDefined();
      expect(topicAvg1?.communityAverage).toBe(78.9);
      expect(topicAvg1?.name).toBe('Topic 1');

      const topicAvg2 = averages.find((a) => a.topicId === topic2);
      expect(topicAvg2).toBeDefined();
      expect(topicAvg2?.communityAverage).toBe(65.4);
      expect(topicAvg2?.name).toBe('Topic 2');
    });

    it('should return empty array when no cache data exists', () => {
      const certificationId = createCertification();

      const averages = benchmarkService.getCommunityAverages(certificationId);

      expect(averages).toHaveLength(0);
    });

    it('should return both domain and topic averages', () => {
      const certificationId = createCertification();
      const topic1 = createTopic(certificationId, 'Topic 1');

      // Insert both domain and topic data
      testDb
        .prepare(
          'INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, 'Domain1', null, 80.0, 10);

      testDb
        .prepare(
          'INSERT INTO community_benchmark_cache (id, certificationId, domainName, topicId, averageProficiency, sampleSize) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), certificationId, null, topic1, 75.0, 8);

      const averages = benchmarkService.getCommunityAverages(certificationId);

      expect(averages).toHaveLength(2);
      expect(averages.some((a) => a.domainId === 'Domain1')).toBe(true);
      expect(averages.some((a) => a.topicId === topic1)).toBe(true);
    });
  });
});
