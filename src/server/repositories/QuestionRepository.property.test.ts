// Feature: units-config, Property 10: findByUnitId returns only active questions

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { QuestionRepository } from './QuestionRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh in-memory SQLite database with the schema needed to test
 * QuestionRepository.findByUnitId — includes the units table and the
 * unitId column on questions.
 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1
    );
    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      title TEXT NOT NULL,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1
    );
    CREATE TABLE units (
      id TEXT PRIMARY KEY,
      subTopicId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME,
      updatedAt DATETIME
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      subTopicId TEXT,
      unitId TEXT REFERENCES units(id) ON DELETE CASCADE,
      questionText TEXT NOT NULL,
      questionType TEXT DEFAULT 'single',
      options TEXT NOT NULL,
      correctAnswers TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT DEFAULT 'Medium',
      tags TEXT DEFAULT '[]',
      points INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 1
    )
  `);
  return db;
}

// ---------------------------------------------------------------------------
// Property 10: findByUnitId returns only active questions
// Validates: Requirements 8.3
// ---------------------------------------------------------------------------

describe('QuestionRepository property tests', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any unit containing a mix of active and inactive questions,
   * `findByUnitId` SHALL return only questions where `isActive = 1`.
   */
  it('Property 10: findByUnitId returns only active questions', () => {
    // Feature: units-config, Property 10: findByUnitId returns only active questions
    fc.assert(
      fc.property(
        // Generate a mix of active/inactive questions for a unit
        fc.array(
          fc.record({
            id: fc.uuid(),
            isActive: fc.boolean(),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (questions) => {
          const db = createTestDb();

          const topicId = crypto.randomUUID();
          const subTopicId = crypto.randomUUID();
          const unitId = crypto.randomUUID();

          // Seed parent records
          db.prepare('INSERT INTO topics (id, certificationId, title) VALUES (?, ?, ?)').run(
            topicId,
            crypto.randomUUID(),
            'Test Topic',
          );

          db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
            subTopicId,
            topicId,
            'Test Subtopic',
          );

          db.prepare(
            'INSERT INTO units (id, subTopicId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          ).run(
            unitId,
            subTopicId,
            'Test Unit',
            new Date().toISOString(),
            new Date().toISOString(),
          );

          // Deduplicate questions by id to avoid PK conflicts from fc.uuid() collisions
          const uniqueQuestions = Array.from(new Map(questions.map((q) => [q.id, q])).values());

          const insertQuestion = db.prepare(
            `INSERT INTO questions (id, topicId, subTopicId, unitId, questionText, questionType, options, correctAnswers, difficulty, tags, points, isActive)
             VALUES (?, ?, ?, ?, 'Q?', 'single', '[]', '[]', 'Medium', '[]', 1, ?)`,
          );

          for (const q of uniqueQuestions) {
            insertQuestion.run(q.id, topicId, subTopicId, unitId, q.isActive ? 1 : 0);
          }

          const repo = new QuestionRepository(db);
          const results = repo.findByUnitId(unitId);

          db.close();

          // Property: every returned row must have isActive = 1
          return results.every((r) => r.isActive === 1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
