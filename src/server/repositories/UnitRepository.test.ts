import { describe, it, beforeEach, expect } from 'vitest';
import Database from 'better-sqlite3';
import { UnitRepository } from './UnitRepository';
import type { UnitRow } from '../db-types';

// Creates a minimal in-memory SQLite database with the schema required by UnitRepository.
// Mirrors the relevant parts of migration V11 without pulling in the full migration runner.
function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      certificationId TEXT NOT NULL,
      title TEXT NOT NULL,
      weightPercentage REAL DEFAULT 0
    );

    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      title TEXT NOT NULL,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1
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

    CREATE INDEX IF NOT EXISTS idx_units_subTopicId ON units(subTopicId);
    CREATE INDEX IF NOT EXISTS idx_units_subTopicId_orderIndex ON units(subTopicId, orderIndex);

    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      subTopicId TEXT,
      unitId TEXT REFERENCES units(id) ON DELETE CASCADE,
      questionText TEXT NOT NULL,
      questionType TEXT DEFAULT 'single',
      options TEXT NOT NULL,
      correctAnswers TEXT NOT NULL,
      difficulty TEXT DEFAULT 'Medium',
      tags TEXT DEFAULT '[]',
      points INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_questions_unitId ON questions(unitId);
  `);
  return db;
}

// Seed helpers
function insertSubTopic(db: ReturnType<typeof Database>, id: string, topicId = 'topic-1') {
  db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
    id,
    topicId,
    `SubTopic ${id}`,
  );
}

function insertQuestion(
  db: ReturnType<typeof Database>,
  id: string,
  unitId: string,
  topicId = 'topic-1',
  isActive = 1,
) {
  db.prepare(
    `INSERT INTO questions (id, topicId, unitId, questionText, options, correctAnswers, isActive)
     VALUES (?, ?, ?, 'Q?', '[]', '[]', ?)`,
  ).run(id, topicId, unitId, isActive);
}

describe('UnitRepository', () => {
  let db: ReturnType<typeof createTestDb>;
  let repo: UnitRepository;
  let subTopicId: string;

  beforeEach(() => {
    db = createTestDb();
    repo = new UnitRepository(db);

    // Seed a subtopic that tests can use as a parent
    subTopicId = 'subtopic-1';
    insertSubTopic(db, subTopicId);
  });

  // ─── findUnitsBySubTopic ────────────────────────────────────────────────────

  describe('findUnitsBySubTopic', () => {
    // Requirement 4.1: returns units ordered by orderIndex ASC
    it('returns units ordered by orderIndex ASC', () => {
      repo.createUnit({ subTopicId, title: 'Unit C', orderIndex: 30 });
      repo.createUnit({ subTopicId, title: 'Unit A', orderIndex: 10 });
      repo.createUnit({ subTopicId, title: 'Unit B', orderIndex: 20 });

      const units = repo.findUnitsBySubTopic(subTopicId);

      expect(units).toHaveLength(3);
      expect(units[0].title).toBe('Unit A');
      expect(units[1].title).toBe('Unit B');
      expect(units[2].title).toBe('Unit C');
    });

    // Requirement 4.1: returns empty array for unknown subtopic
    it('returns empty array for an unknown subtopicId', () => {
      // Insert a unit under the known subtopic to ensure the DB is not empty
      repo.createUnit({ subTopicId, title: 'Some Unit' });

      const units = repo.findUnitsBySubTopic('non-existent-subtopic-id');

      expect(units).toHaveLength(0);
    });

    it('returns all units belonging to the given subtopic', () => {
      const otherSubTopicId = 'subtopic-2';
      insertSubTopic(db, otherSubTopicId);

      repo.createUnit({ subTopicId, title: 'Unit for ST1' });
      repo.createUnit({ subTopicId: otherSubTopicId, title: 'Unit for ST2' });

      const units = repo.findUnitsBySubTopic(subTopicId);

      expect(units).toHaveLength(1);
      expect(units[0].title).toBe('Unit for ST1');
    });
  });

  // ─── findUnitById ───────────────────────────────────────────────────────────

  describe('findUnitById', () => {
    // Requirement 4.2: returns unit by ID
    it('returns the unit when the ID exists', () => {
      const id = repo.createUnit({
        subTopicId,
        title: 'My Unit',
        description: 'Desc',
        orderIndex: 5,
      });

      const unit = repo.findUnitById(id);

      expect(unit).toBeDefined();
      if (!unit) return;
      expect(unit.id).toBe(id);
      expect(unit.subTopicId).toBe(subTopicId);
      expect(unit.title).toBe('My Unit');
      expect(unit.description).toBe('Desc');
      expect(unit.orderIndex).toBe(5);
      expect(unit.isActive).toBe(1);
    });

    // Requirement 4.2: returns undefined for unknown ID
    it('returns undefined for an unknown ID', () => {
      const unit = repo.findUnitById('non-existent-id');

      expect(unit).toBeUndefined();
    });
  });

  // ─── createUnit ────────────────────────────────────────────────────────────

  describe('createUnit', () => {
    // Requirement 4.3: creates a unit and returns its ID
    it('returns a non-empty string ID', () => {
      const id = repo.createUnit({ subTopicId, title: 'New Unit' });

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    // Requirement 4.3: the created unit can be read back with correct fields
    it('the created unit can be read back with all correct fields', () => {
      const id = repo.createUnit({
        subTopicId,
        title: 'Full Unit',
        description: 'A description',
        orderIndex: 7,
        isActive: true,
      });

      const unit = repo.findUnitById(id);

      expect(unit).toBeDefined();
      if (!unit) return;
      expect(unit.subTopicId).toBe(subTopicId);
      expect(unit.title).toBe('Full Unit');
      expect(unit.description).toBe('A description');
      expect(unit.orderIndex).toBe(7);
      expect(unit.isActive).toBe(1);
    });

    it('defaults orderIndex to 0 when not provided', () => {
      const id = repo.createUnit({ subTopicId, title: 'Default Order' });
      const unit = repo.findUnitById(id);

      expect(unit).toBeDefined();
      if (!unit) return;
      expect(unit.orderIndex).toBe(0);
    });

    it('defaults isActive to 1 (true) when not provided', () => {
      const id = repo.createUnit({ subTopicId, title: 'Default Active' });
      const unit = repo.findUnitById(id);

      expect(unit).toBeDefined();
      if (!unit) return;
      expect(unit.isActive).toBe(1);
    });

    it('stores isActive as 0 when isActive: false is provided', () => {
      const id = repo.createUnit({ subTopicId, title: 'Inactive Unit', isActive: false });
      const unit = repo.findUnitById(id);

      expect(unit).toBeDefined();
      if (!unit) return;
      expect(unit.isActive).toBe(0);
    });

    it('stores null description when description is not provided', () => {
      const id = repo.createUnit({ subTopicId, title: 'No Desc' });
      const unit = repo.findUnitById(id);

      expect(unit).toBeDefined();
      if (!unit) return;
      expect(unit.description).toBeNull();
    });

    // Requirement 1.2 / design: UNIQUE constraint on (subTopicId, title) — repository throws on duplicate
    it('throws an error when a duplicate (subTopicId, title) is inserted', () => {
      repo.createUnit({ subTopicId, title: 'Duplicate Title' });

      expect(() => {
        repo.createUnit({ subTopicId, title: 'Duplicate Title' });
      }).toThrow();
    });

    it('allows the same title under a different subtopic', () => {
      const otherSubTopicId = 'subtopic-other';
      insertSubTopic(db, otherSubTopicId);

      repo.createUnit({ subTopicId, title: 'Shared Title' });

      // Should not throw — different subtopic
      expect(() => {
        repo.createUnit({ subTopicId: otherSubTopicId, title: 'Shared Title' });
      }).not.toThrow();
    });
  });

  // ─── updateUnit ────────────────────────────────────────────────────────────

  describe('updateUnit', () => {
    let unitId: string;
    let original: UnitRow;

    beforeEach(() => {
      unitId = repo.createUnit({
        subTopicId,
        title: 'Original Title',
        description: 'Original Desc',
        orderIndex: 1,
        isActive: true,
      });
      original =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
    });

    // Requirement 4.4: updates only provided fields, leaves other fields unchanged
    it('updates only the title when only title is provided', () => {
      repo.updateUnit(unitId, { title: 'Updated Title' }, original);

      const updated =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Original Desc');
      expect(updated.orderIndex).toBe(1);
      expect(updated.isActive).toBe(1);
    });

    it('updates only the description when only description is provided', () => {
      repo.updateUnit(unitId, { description: 'New Desc' }, original);

      const updated =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
      expect(updated.description).toBe('New Desc');
      expect(updated.title).toBe('Original Title');
      expect(updated.orderIndex).toBe(1);
    });

    it('updates only the orderIndex when only orderIndex is provided', () => {
      repo.updateUnit(unitId, { orderIndex: 99 }, original);

      const updated =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
      expect(updated.orderIndex).toBe(99);
      expect(updated.title).toBe('Original Title');
      expect(updated.description).toBe('Original Desc');
    });

    it('updates only isActive when only isActive is provided', () => {
      repo.updateUnit(unitId, { isActive: false }, original);

      const updated =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
      expect(updated.isActive).toBe(0);
      expect(updated.title).toBe('Original Title');
    });

    it('updates multiple fields at once', () => {
      repo.updateUnit(unitId, { title: 'Multi Update', orderIndex: 42 }, original);

      const updated =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
      expect(updated.title).toBe('Multi Update');
      expect(updated.orderIndex).toBe(42);
      expect(updated.description).toBe('Original Desc');
    });

    it('can set description to null via explicit undefined (falls back to current)', () => {
      // When description is not in the DTO, it should remain unchanged
      repo.updateUnit(unitId, { title: 'No Desc Change' }, original);

      const updated =
        repo.findUnitById(unitId) ??
        (() => {
          throw new Error(`Unit not found`);
        })();
      expect(updated.description).toBe('Original Desc');
    });
  });

  // ─── deleteUnit ────────────────────────────────────────────────────────────

  describe('deleteUnit', () => {
    // Requirement 4.5: deletes the unit, findUnitById returns undefined after deletion
    it('removes the unit so that findUnitById returns undefined', () => {
      const id = repo.createUnit({ subTopicId, title: 'To Delete' });

      repo.deleteUnit(id);

      expect(repo.findUnitById(id)).toBeUndefined();
    });

    it('does not affect other units when one is deleted', () => {
      const keepId = repo.createUnit({ subTopicId, title: 'Keep Me' });
      const deleteId = repo.createUnit({ subTopicId, title: 'Delete Me' });

      repo.deleteUnit(deleteId);

      expect(repo.findUnitById(keepId)).toBeDefined();
      expect(repo.findUnitById(deleteId)).toBeUndefined();
    });

    it('is a no-op when the unit does not exist', () => {
      // Should not throw
      expect(() => repo.deleteUnit('non-existent-id')).not.toThrow();
    });
  });

  // ─── countUnitsBySubTopic ──────────────────────────────────────────────────

  describe('countUnitsBySubTopic', () => {
    it('returns 0 for a subtopic with no units', () => {
      const count = repo.countUnitsBySubTopic(subTopicId);
      expect(count).toBe(0);
    });

    it('returns the correct count after creating units', () => {
      repo.createUnit({ subTopicId, title: 'Unit 1' });
      repo.createUnit({ subTopicId, title: 'Unit 2' });
      repo.createUnit({ subTopicId, title: 'Unit 3' });

      const count = repo.countUnitsBySubTopic(subTopicId);
      expect(count).toBe(3);
    });

    it('returns 0 for an unknown subtopicId', () => {
      repo.createUnit({ subTopicId, title: 'Unit 1' });

      const count = repo.countUnitsBySubTopic('unknown-subtopic');
      expect(count).toBe(0);
    });

    it('counts only units belonging to the given subtopic', () => {
      const otherSubTopicId = 'subtopic-count-other';
      insertSubTopic(db, otherSubTopicId);

      repo.createUnit({ subTopicId, title: 'ST1 Unit 1' });
      repo.createUnit({ subTopicId, title: 'ST1 Unit 2' });
      repo.createUnit({ subTopicId: otherSubTopicId, title: 'ST2 Unit 1' });

      expect(repo.countUnitsBySubTopic(subTopicId)).toBe(2);
      expect(repo.countUnitsBySubTopic(otherSubTopicId)).toBe(1);
    });

    it('decrements after a unit is deleted', () => {
      const id = repo.createUnit({ subTopicId, title: 'Temp Unit' });
      expect(repo.countUnitsBySubTopic(subTopicId)).toBe(1);

      repo.deleteUnit(id);
      expect(repo.countUnitsBySubTopic(subTopicId)).toBe(0);
    });
  });

  // ─── countQuestionsByUnit ──────────────────────────────────────────────────

  describe('countQuestionsByUnit', () => {
    it('returns 0 for a unit with no questions', () => {
      const unitId = repo.createUnit({ subTopicId, title: 'Empty Unit' });

      const count = repo.countQuestionsByUnit(unitId);
      expect(count).toBe(0);
    });

    it('returns the correct count of questions assigned to the unit', () => {
      const unitId = repo.createUnit({ subTopicId, title: 'Unit With Questions' });

      insertQuestion(db, 'q-1', unitId);
      insertQuestion(db, 'q-2', unitId);
      insertQuestion(db, 'q-3', unitId);

      const count = repo.countQuestionsByUnit(unitId);
      expect(count).toBe(3);
    });

    it('returns 0 for an unknown unitId', () => {
      const unitId = repo.createUnit({ subTopicId, title: 'Known Unit' });
      insertQuestion(db, 'q-known', unitId);

      const count = repo.countQuestionsByUnit('unknown-unit-id');
      expect(count).toBe(0);
    });

    it('counts both active and inactive questions', () => {
      const unitId = repo.createUnit({ subTopicId, title: 'Mixed Unit' });

      insertQuestion(db, 'q-active', unitId, 'topic-1', 1);
      insertQuestion(db, 'q-inactive', unitId, 'topic-1', 0);

      // countQuestionsByUnit counts all questions regardless of isActive
      const count = repo.countQuestionsByUnit(unitId);
      expect(count).toBe(2);
    });

    it('counts only questions belonging to the given unit', () => {
      const unitId1 = repo.createUnit({ subTopicId, title: 'Unit 1' });
      const unitId2 = repo.createUnit({ subTopicId, title: 'Unit 2' });

      insertQuestion(db, 'q-u1-a', unitId1);
      insertQuestion(db, 'q-u1-b', unitId1);
      insertQuestion(db, 'q-u2-a', unitId2);

      expect(repo.countQuestionsByUnit(unitId1)).toBe(2);
      expect(repo.countQuestionsByUnit(unitId2)).toBe(1);
    });
  });
});
