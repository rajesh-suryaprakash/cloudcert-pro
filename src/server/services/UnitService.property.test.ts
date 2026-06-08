// Feature: units-config, Property 8: createUnit with invalid subTopicId throws NotFoundError

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { UnitService } from './UnitService';
import { UnitRepository } from '../repositories/UnitRepository';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { NotFoundError } from '../errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh in-memory SQLite database with the schema needed to test
 * UnitService — mirrors the relevant parts of migration V11 without pulling
 * in the full migration runner.
 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      vendor TEXT,
      description TEXT,
      level TEXT DEFAULT 'Associate',
      examCode TEXT,
      url TEXT,
      iconUrl TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(title, level)
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      docUrl TEXT,
      weightPercentage REAL,
      createdAt TEXT,
      updatedAt TEXT,
      UNIQUE(certificationId, title)
    );

    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
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

    CREATE TABLE exam_configurations (
      id TEXT PRIMARY KEY,
      certificationId TEXT,
      name TEXT,
      description TEXT,
      duration INTEGER,
      totalQuestions INTEGER,
      passingScore INTEGER,
      questionSelectionStrategy TEXT DEFAULT 'random',
      topicWeights TEXT DEFAULT '{}',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);
  return db;
}

/**
 * Seed a minimal certification → topic → subtopic chain so that a known
 * subtopic ID exists in the database.  Returns the seeded subtopic ID.
 */
function seedSubtopic(db: Database.Database): string {
  const certId = crypto.randomUUID();
  const topicId = crypto.randomUUID();
  const subTopicId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO certifications (id, title, vendor, description, level, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(certId, 'Test Cert', 'Google', 'A test cert', 'Associate', Date.now(), Date.now());

  db.prepare(
    `INSERT INTO topics (id, certificationId, title, orderIndex, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(topicId, certId, 'Test Topic', 0, 1, new Date().toISOString(), new Date().toISOString());

  db.prepare(
    `INSERT INTO subtopics (id, topicId, title, orderIndex, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    subTopicId,
    topicId,
    'Test Subtopic',
    0,
    1,
    new Date().toISOString(),
    new Date().toISOString(),
  );

  return subTopicId;
}

// ---------------------------------------------------------------------------
// Property 8 — createUnit with invalid subTopicId throws NotFoundError
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe('UnitService property tests', () => {
  /**
   * **Validates: Requirements 5.4**
   *
   * For any string that does not correspond to an existing subtopic ID,
   * calling `UnitService.createUnit` with that string as `subTopicId` SHALL
   * throw a `NotFoundError`.
   *
   * The test:
   *   1. Creates a fresh in-memory DB and seeds exactly one known subtopic.
   *   2. Generates an arbitrary string that is guaranteed NOT to equal the
   *      seeded subtopic ID (filtered via `fc.filter`).
   *   3. Asserts that `UnitService.createUnit` throws a `NotFoundError` for
   *      every such string.
   *
   * The unit title is also generated arbitrarily to confirm the error is
   * triggered by the invalid `subTopicId` alone, regardless of the DTO
   * content.
   */
  it('Property 8: createUnit with invalid subTopicId throws NotFoundError', () => {
    // Feature: units-config, Property 8: createUnit with invalid subTopicId throws NotFoundError
    fc.assert(
      fc.property(
        // Generate an arbitrary non-empty string for the invalid subTopicId.
        // We filter out the seeded subtopic ID inside the property body after
        // the DB is set up, so we use a broad string arbitrary here.
        fc.string({ minLength: 1, maxLength: 100 }),
        // Generate an arbitrary unit title (non-empty to satisfy NOT NULL).
        fc.string({ minLength: 1, maxLength: 100 }),
        (candidateSubTopicId, unitTitle) => {
          const db = createTestDb();
          const unitRepo = new UnitRepository(db);
          const certRepo = new CertificationRepository(db);
          const service = new UnitService(unitRepo, certRepo);

          // Seed one real subtopic so the DB is not empty
          const realSubTopicId = seedSubtopic(db);

          // If fast-check happens to generate the real subtopic ID, skip this
          // run — we cannot test the "not found" path with a valid ID.
          // fc.pre() causes fast-check to discard this sample and try another.
          fc.pre(candidateSubTopicId !== realSubTopicId);

          let threw = false;
          let threwCorrectType = false;

          try {
            service.createUnit(candidateSubTopicId, { title: unitTitle });
          } catch (err) {
            threw = true;
            threwCorrectType = err instanceof NotFoundError;
          } finally {
            db.close();
          }

          // The call must throw, and it must throw a NotFoundError specifically
          return threw && threwCorrectType;
        },
      ),
      { numRuns: 100 },
    );
  });
});
