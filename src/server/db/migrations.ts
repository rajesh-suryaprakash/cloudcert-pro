import type Database from 'better-sqlite3';
import { db as defaultDb } from './connection';
import { logger } from '../logger';
import { QuestionHistoryService } from '../services/QuestionHistoryService';

interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          password TEXT,
          name TEXT,
          role TEXT,
          xp INTEGER DEFAULT 0,
          resetPasswordToken TEXT,
          resetPasswordExpire INTEGER,
          createdAt INTEGER,
          updatedAt INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_reset ON users(resetPasswordToken, resetPasswordExpire);

        CREATE TABLE IF NOT EXISTS certifications (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          vendor TEXT,
          level TEXT DEFAULT 'Associate',
          examCode TEXT,
          url TEXT,
          iconUrl TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          UNIQUE(title, level)
        );

        CREATE TABLE IF NOT EXISTS exam_configurations (
          id TEXT PRIMARY KEY,
          certificationId TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          duration INTEGER NOT NULL,
          totalQuestions INTEGER NOT NULL,
          passingScore INTEGER NOT NULL,
          questionSelectionStrategy TEXT DEFAULT 'random' CHECK(questionSelectionStrategy IN ('random', 'difficulty_balanced', 'topic_based')),
          topicWeights TEXT DEFAULT '{}',
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS topics (
          id TEXT PRIMARY KEY,
          certificationId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          orderIndex INTEGER DEFAULT 0,
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
          UNIQUE(certificationId, title)
        );
        CREATE INDEX IF NOT EXISTS idx_topics_certificationId ON topics(certificationId);
        CREATE INDEX IF NOT EXISTS idx_topics_certificationId_orderIndex ON topics(certificationId, orderIndex);

        CREATE TABLE IF NOT EXISTS subtopics (
          id TEXT PRIMARY KEY,
          topicId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          orderIndex INTEGER DEFAULT 0,
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
          UNIQUE(topicId, title)
        );
        CREATE INDEX IF NOT EXISTS idx_subtopics_topicId ON subtopics(topicId);
        CREATE INDEX IF NOT EXISTS idx_subtopics_topicId_orderIndex ON subtopics(topicId, orderIndex);

        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          topicId TEXT NOT NULL,
          subTopicId TEXT,
          questionText TEXT NOT NULL,
          questionType TEXT DEFAULT 'single' CHECK(questionType IN ('single', 'multiple')),
          options TEXT NOT NULL,
          correctAnswers TEXT NOT NULL,
          explanation TEXT,
          difficulty TEXT DEFAULT 'Medium' CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
          tags TEXT DEFAULT '[]',
          points INTEGER DEFAULT 1,
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
          FOREIGN KEY(subTopicId) REFERENCES subtopics(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_questions_topicId ON questions(topicId);
        CREATE INDEX IF NOT EXISTS idx_questions_subTopicId ON questions(subTopicId);
        CREATE INDEX IF NOT EXISTS idx_questions_isActive ON questions(isActive);
        CREATE INDEX IF NOT EXISTS idx_questions_composite ON questions(topicId, difficulty, isActive);

        CREATE TABLE IF NOT EXISTS exam_sessions (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          examConfigurationId TEXT,
          certificationId TEXT,
          topicId TEXT,
          sessionName TEXT,
          questions TEXT NOT NULL,
          status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'abandoned')),
          score REAL,
          totalQuestions INTEGER NOT NULL,
          correctAnswers INTEGER DEFAULT 0,
          incorrectAnswers INTEGER DEFAULT 0,
          unansweredQuestions INTEGER DEFAULT 0,
          timeTaken INTEGER,
          startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
          endTime DATETIME,
          autoSubmitAt DATETIME NOT NULL,
          isPracticeMode INTEGER DEFAULT 0,
          isTopicQuiz INTEGER DEFAULT 0,
          isCustomQuiz INTEGER DEFAULT 0,
          isSRSReview INTEGER DEFAULT 0,
          ipAddress TEXT,
          userAgent TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE RESTRICT,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL,
          FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_exam_sessions_userId ON exam_sessions(userId);
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_examConfigurationId ON exam_sessions(examConfigurationId);
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_history ON exam_sessions(userId, createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_auto_submit ON exam_sessions(status, autoSubmitAt);

        CREATE TABLE IF NOT EXISTS exam_answers (
          id TEXT PRIMARY KEY,
          examSessionId TEXT NOT NULL,
          questionId TEXT NOT NULL,
          userAnswer TEXT,
          isCorrect INTEGER,
          markedForReview INTEGER DEFAULT 0,
          timeSpent INTEGER DEFAULT 0,
          confidenceLevel TEXT,
          answerOrder INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
          UNIQUE(examSessionId, questionId)
        );

        CREATE INDEX IF NOT EXISTS idx_exam_answers_examSessionId ON exam_answers(examSessionId);
        CREATE INDEX IF NOT EXISTS idx_exam_answers_questionId ON exam_answers(questionId);
        CREATE INDEX IF NOT EXISTS idx_exam_answers_session_order ON exam_answers(examSessionId, answerOrder);

        CREATE TABLE IF NOT EXISTS discussions (
          id TEXT PRIMARY KEY,
          userId TEXT,
          questionId TEXT,
          content TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_discussions_questionId ON discussions(questionId);

        CREATE TABLE IF NOT EXISTS discussion_votes (
          id TEXT PRIMARY KEY,
          userId TEXT,
          discussionId TEXT,
          vote INTEGER,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(discussionId) REFERENCES discussions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_streaks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL UNIQUE,
          currentStreak INTEGER DEFAULT 0,
          longestStreak INTEGER DEFAULT 0,
          lastActivityDate TEXT,
          totalActiveDays INTEGER DEFAULT 0,
          weeklyStreak INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_user_streaks_currentStreak ON user_streaks(currentStreak DESC);

        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL CHECK(category IN ('exam', 'study', 'streak', 'score', 'social', 'speed', 'mastery')),
          tier TEXT NOT NULL CHECK(tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
          iconName TEXT NOT NULL,
          xpReward INTEGER DEFAULT 0,
          requiredValue INTEGER NOT NULL,
          isActive INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_achievements_key ON achievements(key);
        CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
        CREATE INDEX IF NOT EXISTS idx_achievements_isActive ON achievements(isActive);

        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          achievementId INTEGER NOT NULL,
          progress INTEGER DEFAULT 0 CHECK (progress >= 0),
          isCompleted INTEGER DEFAULT 0 CHECK (isCompleted IN (0, 1)),
          completedAt DATETIME,
          notified INTEGER DEFAULT 0 CHECK (notified IN (0, 1)),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(achievementId) REFERENCES achievements(id) ON DELETE CASCADE,
          UNIQUE(userId, achievementId)
        );
        CREATE INDEX IF NOT EXISTS idx_user_achievements_userId_completedAt ON user_achievements(userId, completedAt DESC);
        CREATE INDEX IF NOT EXISTS idx_user_achievements_isCompleted ON user_achievements(isCompleted);

        CREATE TABLE IF NOT EXISTS question_reports (
          id TEXT PRIMARY KEY,
          userId TEXT,
          questionId TEXT,
          status TEXT DEFAULT 'pending',
          comment TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_question_reports_questionId ON question_reports(questionId);

        CREATE TABLE IF NOT EXISTS question_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          questionId TEXT NOT NULL,
          easeFactor REAL DEFAULT 2.5 CHECK (easeFactor >= 1.3 AND easeFactor <= 5.0),
          interval INTEGER DEFAULT 0 CHECK (interval >= 0),
          repetitions INTEGER DEFAULT 0 CHECK (repetitions >= 0),
          nextReviewDate TEXT NOT NULL,
          lastReviewDate TEXT,
          quality INTEGER CHECK (quality >= 0 AND quality <= 5),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
          UNIQUE(userId, questionId)
        );
        CREATE INDEX IF NOT EXISTS idx_question_reviews_userId_nextReview ON question_reviews(userId, nextReviewDate);
        CREATE INDEX IF NOT EXISTS idx_question_reviews_nextReviewDate ON question_reviews(nextReviewDate);
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        ALTER TABLE topics ADD COLUMN docUrl TEXT;

        CREATE TABLE IF NOT EXISTS study_plan_completions (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          sessionId TEXT NOT NULL,
          topicId TEXT NOT NULL,
          taskType TEXT NOT NULL CHECK(taskType IN ('review_wrong_answers', 'practice_quiz', 'read_docs')),
          completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(sessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE,
          UNIQUE(userId, sessionId, topicId, taskType)
        );
        CREATE INDEX IF NOT EXISTS idx_spc_session ON study_plan_completions(sessionId, userId);
      `);
    },
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        -- Answer change history table
        CREATE TABLE IF NOT EXISTS answer_change_history (
          id TEXT PRIMARY KEY,
          examSessionId TEXT NOT NULL,
          questionId TEXT NOT NULL,
          previousAnswer TEXT,
          newAnswer TEXT,
          changeTimestamp DATETIME NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(examSessionId) REFERENCES exam_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_answer_changes_session ON answer_change_history(examSessionId);
        CREATE INDEX IF NOT EXISTS idx_answer_changes_question ON answer_change_history(questionId);

        -- Benchmark users table
        CREATE TABLE IF NOT EXISTS benchmark_users (
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

        CREATE INDEX IF NOT EXISTS idx_benchmark_users_cert ON benchmark_users(certificationId, passed);

        -- Domain weights table
        CREATE TABLE IF NOT EXISTS domain_weights (
          id TEXT PRIMARY KEY,
          certificationId TEXT NOT NULL,
          domainName TEXT NOT NULL,
          weightPercentage REAL NOT NULL CHECK(weightPercentage >= 0 AND weightPercentage <= 100),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
          UNIQUE(certificationId, domainName)
        );

        CREATE INDEX IF NOT EXISTS idx_domain_weights_cert ON domain_weights(certificationId);

        -- Community benchmark cache table
        CREATE TABLE IF NOT EXISTS community_benchmark_cache (
          id TEXT PRIMARY KEY,
          certificationId TEXT NOT NULL,
          topicId TEXT,
          domainName TEXT,
          averageProficiency REAL NOT NULL,
          sampleSize INTEGER NOT NULL,
          lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
          FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_benchmark_cache_cert ON community_benchmark_cache(certificationId);
        CREATE INDEX IF NOT EXISTS idx_benchmark_cache_topic ON community_benchmark_cache(topicId);

        -- Dashboard metrics cache table
        CREATE TABLE IF NOT EXISTS dashboard_metrics_cache (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          certificationId TEXT NOT NULL,
          metricType TEXT NOT NULL,
          metricData TEXT NOT NULL,
          computedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          expiresAt DATETIME NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_cache_lookup ON dashboard_metrics_cache(userId, certificationId, metricType, expiresAt);

        -- Add domainId column to questions table
        ALTER TABLE questions ADD COLUMN domainId TEXT;
        CREATE INDEX IF NOT EXISTS idx_questions_domainId ON questions(domainId);
      `);
    },
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        -- Question history tracking table
        -- Requirements: 1.1, 1.2, 1.3, 5.1, 6.1
        CREATE TABLE IF NOT EXISTS question_history (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          certificationId TEXT NOT NULL,
          questionId TEXT NOT NULL,
          seenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
          FOREIGN KEY(questionId) REFERENCES questions(id) ON DELETE CASCADE,
          UNIQUE(userId, certificationId, questionId)
        );

        -- Composite index for efficient user-certification queries
        CREATE INDEX IF NOT EXISTS idx_question_history_user_cert 
        ON question_history(userId, certificationId);

        -- Lookup index for fast seen question checks during selection
        CREATE INDEX IF NOT EXISTS idx_question_history_lookup 
        ON question_history(userId, certificationId, questionId);
      `);

      // Backfill question history from existing exam sessions
      // Requirements: 9.1, 9.2, 9.3, 9.4
      const questionHistoryService = new QuestionHistoryService(db);
      const backfillResult = questionHistoryService.backfillFromExistingSessions();

      logger.info(
        {
          sessionsProcessed: backfillResult.sessionsProcessed,
          recordsCreated: backfillResult.recordsCreated,
        },
        'Question history backfill completed',
      );
    },
  },
  {
    version: 5,
    up: (db) => {
      db.exec(`
        -- Performance optimization indexes for analytics queries
        -- Requirements: 25.2, 25.3
        
        -- Composite index for exam sessions analytics queries
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_analytics 
        ON exam_sessions(userId, certificationId, status, createdAt DESC);
        
        -- Composite index for exam answers analytics queries
        CREATE INDEX IF NOT EXISTS idx_exam_answers_analytics 
        ON exam_answers(examSessionId, isCorrect, timeSpent);
        
        -- Composite index for questions domain/topic/subtopic queries
        CREATE INDEX IF NOT EXISTS idx_questions_hierarchy 
        ON questions(domainId, topicId, subTopicId);
      `);
    },
  },
  {
    version: 6,
    up: (db) => {
      db.exec(`
        -- Add distractorExplanations column to questions table for question review functionality
        ALTER TABLE questions ADD COLUMN distractorExplanations TEXT;
      `);
    },
  },
  {
    version: 7,
    up: (db) => {
      // Check if column already exists to avoid duplicate column errors
      const tableInfo = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>;
      const distractorExists = tableInfo.some((col) => col.name === 'distractorExplanations');

      if (!distractorExists) {
        db.exec(`ALTER TABLE questions ADD COLUMN distractorExplanations TEXT;`);
      }
    },
  },
  {
    version: 8,
    up: (db) => {
      // Check if columns already exist to avoid duplicate column errors
      const tableInfo = db.prepare('PRAGMA table_info(topics)').all() as Array<{ name: string }>;
      const weightExists = tableInfo.some((col) => col.name === 'weightPercentage');

      // Add weight fields to topics table for unified domain weight management
      if (!weightExists) {
        db.exec(
          `ALTER TABLE topics ADD COLUMN weightPercentage REAL DEFAULT 0 CHECK(weightPercentage >= 0 AND weightPercentage <= 100);`,
        );
      }

      // Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_topics_weight ON topics(certificationId, weightPercentage);
      `);

      // Migrate existing domain weights to topics (only if domain_weights table exists)
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='domain_weights'")
        .all();
      if (tables.length > 0) {
        db.exec(`
          -- Create topics for domains that don't have corresponding topics yet
          INSERT INTO topics (id, certificationId, title, weightPercentage, orderIndex, isActive, createdAt, updatedAt)
          SELECT 
            'topic-' || LOWER(REPLACE(REPLACE(dw.domainName, ' ', '-'), '&', 'and')) || '-' || SUBSTR(dw.id, 1, 8) as id,
            dw.certificationId,
            dw.domainName as title,
            dw.weightPercentage,
            ROW_NUMBER() OVER (PARTITION BY dw.certificationId ORDER BY dw.domainName) - 1 as orderIndex,
            1 as isActive,
            CURRENT_TIMESTAMP as createdAt,
            CURRENT_TIMESTAMP as updatedAt
          FROM domain_weights dw
          WHERE NOT EXISTS (
            SELECT 1 FROM topics t 
            WHERE t.certificationId = dw.certificationId 
            AND t.title = dw.domainName
          );
          
          -- Update existing topics with domain weights where titles match domain names
          UPDATE topics 
          SET 
            weightPercentage = COALESCE(weightPercentage, (
              SELECT dw.weightPercentage 
              FROM domain_weights dw 
              WHERE dw.certificationId = topics.certificationId 
              AND dw.domainName = topics.title
              LIMIT 1
            ))
          WHERE EXISTS (
            SELECT 1 FROM domain_weights dw 
            WHERE dw.certificationId = topics.certificationId 
            AND dw.domainName = topics.title
          );
        `);
      }
    },
  },
  {
    version: 9,
    up: (db) => {
      // Remove domainName column from topics table since we use topic title as domain name
      // Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table

      // Check if domainName column exists
      const tableInfo = db.prepare('PRAGMA table_info(topics)').all() as Array<{ name: string }>;
      const domainNameExists = tableInfo.some((col) => col.name === 'domainName');

      if (domainNameExists) {
        db.exec(`
          -- Create new topics table without domainName column
          CREATE TABLE topics_new (
            id TEXT PRIMARY KEY,
            certificationId TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            orderIndex INTEGER DEFAULT 0,
            isActive INTEGER DEFAULT 1,
            docUrl TEXT,
            weightPercentage REAL DEFAULT 0 CHECK(weightPercentage >= 0 AND weightPercentage <= 100),
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE CASCADE,
            UNIQUE(certificationId, title)
          );
          
          -- Copy data from old table to new table (excluding domainName)
          INSERT INTO topics_new (id, certificationId, title, description, orderIndex, isActive, docUrl, weightPercentage, createdAt, updatedAt)
          SELECT id, certificationId, title, description, orderIndex, isActive, docUrl, weightPercentage, createdAt, updatedAt
          FROM topics;
          
          -- Drop old table
          DROP TABLE topics;
          
          -- Rename new table
          ALTER TABLE topics_new RENAME TO topics;
          
          -- Recreate indexes
          CREATE INDEX IF NOT EXISTS idx_topics_certificationId ON topics(certificationId);
          CREATE INDEX IF NOT EXISTS idx_topics_certificationId_orderIndex ON topics(certificationId, orderIndex);
          CREATE INDEX IF NOT EXISTS idx_topics_weight ON topics(certificationId, weightPercentage);
        `);
      }
    },
  },
  {
    version: 10,
    up: (db) => {
      // Add passingScoreOverride column to exam_sessions.
      // When the session-creation wizard specifies a custom passing score, it is
      // stored here so the submit route can use it instead of the exam config's
      // stored passingScore.  NULL means "use the exam config default".
      const tableInfo = db.prepare('PRAGMA table_info(exam_sessions)').all() as Array<{
        name: string;
      }>;
      const columnExists = tableInfo.some((col) => col.name === 'passingScoreOverride');
      if (!columnExists) {
        db.exec(`ALTER TABLE exam_sessions ADD COLUMN passingScoreOverride INTEGER;`);
      }
    },
  },
  {
    version: 11,
    up: (db) => {
      // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
      // Create the units table with all columns, constraints, and indexes.
      // Add unitId column to questions and create its index.
      const questionsTableInfo = db.prepare('PRAGMA table_info(questions)').all() as Array<{
        name: string;
      }>;
      const unitIdExists = questionsTableInfo.some((col) => col.name === 'unitId');

      db.exec(`
        CREATE TABLE IF NOT EXISTS units (
          id          TEXT PRIMARY KEY,
          subTopicId  TEXT NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
          title       TEXT NOT NULL,
          description TEXT,
          orderIndex  INTEGER DEFAULT 0,
          isActive    INTEGER DEFAULT 1,
          createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(subTopicId, title)
        );

        CREATE INDEX IF NOT EXISTS idx_units_subTopicId ON units(subTopicId);
        CREATE INDEX IF NOT EXISTS idx_units_subTopicId_orderIndex ON units(subTopicId, orderIndex);
      `);

      if (!unitIdExists) {
        db.exec(`
          ALTER TABLE questions ADD COLUMN unitId TEXT REFERENCES units(id) ON DELETE CASCADE;
        `);
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_questions_unitId ON questions(unitId);
      `);

      // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
      // Backfill: create one Default Unit per existing subtopic, then assign
      // questions.unitId = 'default-unit-' || subTopicId for all questions
      // that have a non-null subTopicId.  subTopicId and topicId are left untouched.
      const subtopics = db.prepare('SELECT id FROM subtopics').all() as Array<{ id: string }>;

      const insertDefaultUnit = db.prepare(`
        INSERT OR IGNORE INTO units (id, subTopicId, title, orderIndex, isActive)
        VALUES (?, ?, 'General', 0, 1)
      `);

      for (const subtopic of subtopics) {
        insertDefaultUnit.run(`default-unit-${subtopic.id}`, subtopic.id);
      }

      db.exec(`
        UPDATE questions
        SET unitId = 'default-unit-' || subTopicId
        WHERE subTopicId IS NOT NULL
      `);

      logger.info(
        { subtopicsBackfilled: subtopics.length },
        'Migration V11: Default Units created and questions backfilled',
      );
    },
  },
  {
    version: 12,
    up: (db) => {
      // Pause / Resume support for time-boxed exam sessions.
      // Adds two columns to exam_sessions:
      //   pausedAt             – ISO timestamp of when the session was last paused (NULL = active)
      //   accumulatedPausedMs  – running total of pause durations in milliseconds
      //
      // Also widens the status CHECK constraint to allow 'paused' as a valid value.
      // SQLite does not support ALTER COLUMN to change a CHECK constraint, so we
      // recreate the table with a safe copy-and-swap.

      const tableInfo = db.prepare('PRAGMA table_info(exam_sessions)').all() as Array<{
        name: string;
      }>;
      const pausedAtExists = tableInfo.some((col) => col.name === 'pausedAt');
      const accumulatedExists = tableInfo.some((col) => col.name === 'accumulatedPausedMs');

      // Add columns first (idempotent guards prevent errors on re-runs)
      if (!pausedAtExists) {
        db.exec(`ALTER TABLE exam_sessions ADD COLUMN pausedAt DATETIME;`);
      }
      if (!accumulatedExists) {
        db.exec(
          `ALTER TABLE exam_sessions ADD COLUMN accumulatedPausedMs INTEGER NOT NULL DEFAULT 0;`,
        );
      }

      // Widen the status CHECK constraint to include 'paused'.
      // Only do this when the constraint still excludes 'paused'.
      const sqlRow = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='exam_sessions'`)
        .get() as { sql: string } | undefined;

      if (sqlRow && !sqlRow.sql.includes("'paused'")) {
        db.exec(`
          -- Step 1: Replacement table with widened CHECK constraint.
          CREATE TABLE exam_sessions_v12 (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            examConfigurationId TEXT,
            certificationId TEXT,
            topicId TEXT,
            sessionName TEXT,
            questions TEXT NOT NULL,
            status TEXT DEFAULT 'in_progress'
              CHECK(status IN ('in_progress', 'completed', 'abandoned', 'paused')),
            score REAL,
            totalQuestions INTEGER NOT NULL,
            correctAnswers INTEGER DEFAULT 0,
            incorrectAnswers INTEGER DEFAULT 0,
            unansweredQuestions INTEGER DEFAULT 0,
            timeTaken INTEGER,
            startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
            endTime DATETIME,
            autoSubmitAt DATETIME NOT NULL,
            isPracticeMode INTEGER DEFAULT 0,
            isTopicQuiz INTEGER DEFAULT 0,
            isCustomQuiz INTEGER DEFAULT 0,
            isSRSReview INTEGER DEFAULT 0,
            ipAddress TEXT,
            userAgent TEXT,
            passingScoreOverride INTEGER,
            pausedAt DATETIME,
            accumulatedPausedMs INTEGER NOT NULL DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(examConfigurationId) REFERENCES exam_configurations(id) ON DELETE RESTRICT,
            FOREIGN KEY(certificationId) REFERENCES certifications(id) ON DELETE SET NULL,
            FOREIGN KEY(topicId) REFERENCES topics(id) ON DELETE SET NULL
          );

          -- Step 2: Copy all existing data.
          INSERT INTO exam_sessions_v12
          SELECT
            id, userId, examConfigurationId, certificationId, topicId, sessionName,
            questions, status, score, totalQuestions, correctAnswers, incorrectAnswers,
            unansweredQuestions, timeTaken, startTime, endTime, autoSubmitAt,
            isPracticeMode, isTopicQuiz, isCustomQuiz, isSRSReview, ipAddress, userAgent,
            passingScoreOverride,
            pausedAt,
            accumulatedPausedMs,
            createdAt, updatedAt
          FROM exam_sessions;

          -- Step 3: Swap tables.
          DROP TABLE exam_sessions;
          ALTER TABLE exam_sessions_v12 RENAME TO exam_sessions;

          -- Step 4: Recreate indexes.
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_userId
            ON exam_sessions(userId);
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_examConfigurationId
            ON exam_sessions(examConfigurationId);
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_status
            ON exam_sessions(status);
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_history
            ON exam_sessions(userId, createdAt DESC);
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_auto_submit
            ON exam_sessions(status, autoSubmitAt);
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_analytics
            ON exam_sessions(userId, certificationId, status, createdAt DESC);
        `);
      }
    },
  },
  {
    version: 13,
    up: (db) => {
      // Add pauseCount column to track how many times a session has been paused.
      // Used to enforce the MAX_PAUSE_COUNT=3 integrity limit in ExamSessionRepository.pause().
      // Existing sessions default to 0 (no pauses recorded before this migration).
      db.exec(`
        ALTER TABLE exam_sessions ADD COLUMN pauseCount INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    version: 14,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expiresAt INTEGER NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens(userId);
      `);
    },
  },
  {
    version: 15,
    up: (db) => {
      // Compound index covering the most common query patterns on exam_sessions:
      //   1. GET /exam-sessions → WHERE userId = ? (ORDER BY createdAt)
      //   2. Analytics queries → WHERE userId = ? AND certificationId = ? AND status = ?
      // These indexes eliminate full table scans for users with many sessions.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_userId_status
          ON exam_sessions(userId, status);
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_userId_certId_status_created
          ON exam_sessions(userId, certificationId, status, createdAt);
      `);
    },
  },
];

export const runMigrations = (db: Database.Database = defaultDb) => {
  // Ensure the migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    );
  `);

  // Fetch already-applied versions
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );

  const insertVersion = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    const runMigration = db.transaction(() => {
      migration.up(db);
      insertVersion.run(migration.version);
    });

    runMigration();
    logger.info({ version: migration.version }, 'Migration applied');
  }
};
