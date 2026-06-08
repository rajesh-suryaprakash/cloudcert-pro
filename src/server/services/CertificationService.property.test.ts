// Feature: units-config, Property 14: createUnitQuestion sets topicId by traversal

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { CertificationService } from './CertificationService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh in-memory SQLite database with the full schema needed to
 * test CertificationService.createUnitQuestion — mirrors the relevant parts
 * of migration V11 without pulling in the full migration runner.
 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      vendor      TEXT,
      description TEXT,
      level       TEXT DEFAULT 'Associate',
      examCode    TEXT,
      url         TEXT,
      iconUrl     TEXT,
      isActive    INTEGER DEFAULT 1,
      createdAt   INTEGER,
      updatedAt   INTEGER,
      UNIQUE(title, level)
    );

    CREATE TABLE topics (
      id               TEXT PRIMARY KEY,
      certificationId  TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT,
      orderIndex       INTEGER DEFAULT 0,
      isActive         INTEGER DEFAULT 1,
      docUrl           TEXT,
      weightPercentage REAL,
      createdAt        TEXT,
      updatedAt        TEXT,
      UNIQUE(certificationId, title)
    );

    CREATE TABLE subtopics (
      id          TEXT PRIMARY KEY,
      topicId     TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      orderIndex  INTEGER DEFAULT 0,
      isActive    INTEGER DEFAULT 1,
      createdAt   TEXT,
      updatedAt   TEXT
    );

    CREATE TABLE units (
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

    CREATE TABLE questions (
      id             TEXT PRIMARY KEY,
      topicId        TEXT,
      subTopicId     TEXT,
      unitId         TEXT REFERENCES units(id) ON DELETE CASCADE,
      questionText   TEXT NOT NULL,
      questionType   TEXT DEFAULT 'single',
      options        TEXT DEFAULT '[]',
      correctAnswers TEXT DEFAULT '[]',
      explanation    TEXT,
      difficulty     TEXT DEFAULT 'Medium',
      tags           TEXT DEFAULT '[]',
      points         INTEGER DEFAULT 1,
      isActive       INTEGER DEFAULT 1,
      createdAt      TEXT,
      updatedAt      TEXT
    );

    CREATE TABLE exam_configurations (
      id                       TEXT PRIMARY KEY,
      certificationId          TEXT,
      name                     TEXT,
      description              TEXT,
      duration                 INTEGER,
      totalQuestions           INTEGER,
      passingScore             INTEGER,
      questionSelectionStrategy TEXT DEFAULT 'random',
      topicWeights             TEXT DEFAULT '{}',
      isActive                 INTEGER DEFAULT 1,
      createdAt                TEXT,
      updatedAt                TEXT
    );

    CREATE TABLE exam_sessions (
      id                  TEXT PRIMARY KEY,
      examConfigurationId TEXT
    );
  `);
  return db;
}

interface SeededHierarchy {
  certId: string;
  topicId: string;
  subtopicId: string;
}

/**
 * Seed a minimal certification → topic → subtopic chain using the
 * CertificationRepository so that the service layer can traverse it.
 * Returns the IDs of the seeded records.
 */
function seedHierarchy(
  certRepo: CertificationRepository,
  certTitle: string,
  topicTitle: string,
  subtopicTitle: string,
): SeededHierarchy {
  const certId = certRepo.create({
    title: certTitle,
    vendor: 'TestVendor',
    description: 'A test certification',
    level: 'Associate',
  });

  const topicId = certRepo.createTopic({
    certificationId: certId,
    title: topicTitle,
  });

  const subtopicId = certRepo.createSubTopic({
    topicId,
    title: subtopicTitle,
  });

  return { certId, topicId, subtopicId };
}

// ---------------------------------------------------------------------------
// Property 14 — createUnitQuestion sets topicId by traversal
// Validates: Requirements 9.5, 20.3
// ---------------------------------------------------------------------------

describe('CertificationService property tests', () => {
  /**
   * **Validates: Requirements 9.5, 20.3**
   *
   * For any unit, calling `CertificationService.createUnitQuestion` SHALL set
   * `questions.topicId` to the topic that owns the unit's parent subtopic
   * (i.e., unit → subtopic → topic chain traversal).
   *
   * The test:
   *   1. Creates a fresh in-memory DB for each run.
   *   2. Seeds a certification → topic → subtopic chain with generated titles.
   *   3. Creates a unit under the seeded subtopic with a generated title.
   *   4. Calls `createUnitQuestion` with generated question data.
   *   5. Reads the persisted question row directly from the DB.
   *   6. Asserts that `questions.topicId` equals the seeded topic's ID.
   *   7. Also asserts `questions.subTopicId` and `questions.unitId` are set
   *      correctly to confirm the full traversal chain is persisted.
   */
  it('Property 14: createUnitQuestion sets topicId by traversal', () => {
    // Feature: units-config, Property 14: createUnitQuestion sets topicId by traversal
    fc.assert(
      fc.property(
        // Generate unique-enough titles for the hierarchy to avoid UNIQUE constraint
        // violations across runs. We use UUIDs via fc.uuid() for cert/topic/subtopic
        // titles and a separate string for the unit title.
        fc.uuid(), // certTitle suffix — ensures uniqueness per run
        fc.uuid(), // topicTitle suffix
        fc.uuid(), // subtopicTitle suffix
        fc.string({ minLength: 1, maxLength: 80 }), // unit title
        fc.string({ minLength: 1, maxLength: 200 }), // question text
        (certSuffix, topicSuffix, subtopicSuffix, unitTitle, questionText) => {
          const db = createTestDb();
          const certRepo = new CertificationRepository(db);
          const questionRepo = new QuestionRepository(db);
          const unitRepo = new UnitRepository(db);
          const service = new CertificationService(certRepo, questionRepo, unitRepo);

          // Seed the hierarchy with generated titles
          const { topicId, subtopicId } = seedHierarchy(
            certRepo,
            `Cert ${certSuffix}`,
            `Topic ${topicSuffix}`,
            `Subtopic ${subtopicSuffix}`,
          );

          // Create a unit under the seeded subtopic
          const unitId = unitRepo.createUnit({
            subTopicId: subtopicId,
            title: unitTitle,
          });

          // Call createUnitQuestion — this should traverse unit → subtopic → topic
          const questionId = service.createUnitQuestion(unitId, {
            questionText,
            options: ['Option A', 'Option B'],
            correctAnswers: ['Option A'],
          });

          // Read the persisted question row directly from the DB
          const row = db
            .prepare('SELECT topicId, subTopicId, unitId FROM questions WHERE id = ?')
            .get(questionId) as { topicId: string; subTopicId: string; unitId: string } | undefined;

          db.close();

          if (!row) return false;

          // The topicId on the question must equal the topic that owns the subtopic
          // that owns the unit — this is the core traversal assertion.
          const topicIdCorrect = row.topicId === topicId;

          // Also verify the full chain is persisted correctly
          const subTopicIdCorrect = row.subTopicId === subtopicId;
          const unitIdCorrect = row.unitId === unitId;

          return topicIdCorrect && subTopicIdCorrect && unitIdCorrect;
        },
      ),
      { numRuns: 100 },
    );
  });
});
