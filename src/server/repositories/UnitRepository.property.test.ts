// Feature: units-config, Property 4: Unit CRUD round-trip
// Feature: units-config, Property 5: Unit update partial-field invariant
// Feature: units-config, Property 6: Unit delete removes record
// Feature: units-config, Property 7: findUnitsBySubTopic returns units in ascending orderIndex order
// Feature: units-config, Property 13: Subtopic cascade-deletes its Units

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { UnitRepository } from './UnitRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh in-memory SQLite database with the schema needed to test
 * UnitRepository — mirrors the relevant parts of migration V11 without
 * pulling in the full migration runner.
 */
function createTestDb(): Database.Database {
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

// ---------------------------------------------------------------------------
// Property 4 — Unit CRUD round-trip
// Validates: Requirements 4.2, 4.3, 19.1
// ---------------------------------------------------------------------------

describe('UnitRepository property tests', () => {
  /**
   * **Validates: Requirements 4.2, 4.3, 19.1**
   *
   * For any valid `CreateUnitDto`, creating a unit and then reading it by the
   * returned ID SHALL return a record with matching `subTopicId`, `title`,
   * `description`, `orderIndex`, and `isActive` values.
   */
  it('Property 4: Unit CRUD round-trip — create then read returns matching fields', () => {
    // Feature: units-config, Property 4: Unit CRUD round-trip
    fc.assert(
      fc.property(
        fc.record({
          // title must be non-empty (NOT NULL constraint)
          title: fc.string({ minLength: 1, maxLength: 100 }),
          // description is optional — null means omit from DTO
          description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          // orderIndex defaults to 0 when omitted
          orderIndex: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
          // isActive defaults to true when omitted
          isActive: fc.option(fc.boolean(), { nil: undefined }),
        }),
        (dto) => {
          const db = createTestDb();

          // Seed a subtopic so the FK constraint is satisfied
          const subTopicId = crypto.randomUUID();
          db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
            subTopicId,
            crypto.randomUUID(),
            'Test SubTopic',
          );

          const repo = new UnitRepository(db);

          // Create the unit and read it back
          const id = repo.createUnit({ subTopicId, ...dto });
          const found = repo.findUnitById(id);

          db.close();

          if (!found) return false;

          // subTopicId must match exactly
          if (found.subTopicId !== subTopicId) return false;

          // title must match exactly
          if (found.title !== dto.title) return false;

          // description: undefined in DTO → stored as null
          const expectedDescription = dto.description !== undefined ? dto.description : null;
          if (found.description !== expectedDescription) return false;

          // orderIndex: undefined in DTO → defaults to 0
          const expectedOrderIndex = dto.orderIndex !== undefined ? dto.orderIndex : 0;
          if (found.orderIndex !== expectedOrderIndex) return false;

          // isActive: undefined/true in DTO → stored as 1; false → stored as 0
          const expectedIsActive = dto.isActive === false ? 0 : 1;
          if (found.isActive !== expectedIsActive) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property 5 — Unit update partial-field invariant
  // Validates: Requirements 4.4, 19.2
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 4.4, 19.2**
   *
   * For any existing unit and any partial update DTO, after calling
   * `updateUnit`, only the fields present in the DTO SHALL change; all other
   * fields SHALL retain their previous values.
   *
   * The test generates:
   *   - An initial unit with fully-specified fields (title, description,
   *     orderIndex, isActive).
   *   - A partial DTO that may update any non-empty subset of those fields.
   *
   * After the update, each field is checked independently:
   *   - If the field was included in the DTO → the stored value must equal the
   *     new value from the DTO.
   *   - If the field was absent from the DTO → the stored value must equal the
   *     original value.
   *
   * `subTopicId` is intentionally excluded from the partial DTO because
   * `updateUnit` does not support re-parenting a unit to a different subtopic.
   */
  it('Property 5: Unit update partial-field invariant — only provided fields change', () => {
    // Feature: units-config, Property 5: Unit update partial-field invariant

    // Arbitrary for the initial unit's fields (all required so we have a
    // well-defined baseline to compare against after the partial update).
    const initialUnitArb = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
      orderIndex: fc.nat({ max: 1000 }),
      isActive: fc.boolean(),
    });

    // Arbitrary for the partial update DTO.  Each field is independently
    // present or absent so we exercise every combination of updated / unchanged
    // fields across the 100 runs.
    const partialDtoArb = fc.record(
      {
        title: fc.string({ minLength: 1, maxLength: 100 }),
        description: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
        orderIndex: fc.nat({ max: 1000 }),
        isActive: fc.boolean(),
      },
      { requiredKeys: [] }, // all keys are optional
    );

    fc.assert(
      fc.property(initialUnitArb, partialDtoArb, (initial, partialDto) => {
        const db = createTestDb();

        // Seed a subtopic so the FK constraint is satisfied
        const subTopicId = crypto.randomUUID();
        db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
          subTopicId,
          crypto.randomUUID(),
          'Test SubTopic',
        );

        const repo = new UnitRepository(db);

        // Create the unit with fully-specified initial values
        const id = repo.createUnit({
          subTopicId,
          title: initial.title,
          description: initial.description ?? undefined,
          orderIndex: initial.orderIndex,
          isActive: initial.isActive,
        });

        // Read back the stored baseline (use the DB-stored values as the
        // authoritative "before" state, including any defaults applied by the
        // repository, e.g. isActive stored as 0/1 integer).
        const before = repo.findUnitById(id);
        if (!before) return false;

        // Apply the partial update
        repo.updateUnit(id, partialDto as any, before);

        // Read the record after the update
        const after = repo.findUnitById(id);
        // Note: null check follows below

        db.close();

        if (!after) return false;

        // ── title ──────────────────────────────────────────────────────────
        if ('title' in partialDto) {
          // Field was updated — must reflect the new value
          if (after.title !== partialDto.title) return false;
        } else {
          // Field was absent — must be unchanged
          if (after.title !== before.title) return false;
        }

        // ── description ────────────────────────────────────────────────────
        if ('description' in partialDto) {
          // description: null in DTO → stored as null; string → stored as string
          const expectedDesc = partialDto.description ?? null;
          if (after.description !== expectedDesc) return false;
        } else {
          if (after.description !== before.description) return false;
        }

        // ── orderIndex ─────────────────────────────────────────────────────
        if ('orderIndex' in partialDto) {
          if (after.orderIndex !== partialDto.orderIndex) return false;
        } else {
          if (after.orderIndex !== before.orderIndex) return false;
        }

        // ── isActive ───────────────────────────────────────────────────────
        if ('isActive' in partialDto) {
          const expectedIsActive = partialDto.isActive ? 1 : 0;
          if (after.isActive !== expectedIsActive) return false;
        } else {
          if (after.isActive !== before.isActive) return false;
        }

        // ── subTopicId must never change ───────────────────────────────────
        if (after.subTopicId !== before.subTopicId) return false;

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property 6 — Unit delete removes record
  // Validates: Requirements 4.5, 19.3
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 4.5, 19.3**
   *
   * For any existing unit, after calling `deleteUnit`, `findUnitById` SHALL
   * return `undefined` for that unit's ID.
   */
  it('Property 6: Unit delete removes record — findUnitById returns undefined after deleteUnit', () => {
    // Feature: units-config, Property 6: Unit delete removes record
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          orderIndex: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
        }),
        (dto) => {
          const db = createTestDb();

          // Seed a subtopic so the FK constraint is satisfied
          const subTopicId = crypto.randomUUID();
          db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
            subTopicId,
            crypto.randomUUID(),
            'Test SubTopic',
          );

          const repo = new UnitRepository(db);

          // Create the unit, verify it exists, then delete it
          const id = repo.createUnit({ subTopicId, ...dto });

          // Confirm the unit exists before deletion
          const before = repo.findUnitById(id);
          if (!before) {
            db.close();
            return false;
          }

          // Delete the unit
          repo.deleteUnit(id);

          // After deletion, findUnitById must return undefined
          const after = repo.findUnitById(id);

          db.close();

          return after === undefined;
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property 7 — findUnitsBySubTopic returns units in ascending orderIndex order
  // Validates: Requirements 4.1
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 4.1**
   *
   * For any set of units belonging to a subtopic with varying `orderIndex`
   * values, `findUnitsBySubTopic` SHALL return them sorted by `orderIndex ASC`.
   *
   * The test generates an array of at least 2 integer orderIndex values,
   * inserts units with those orderIndexes into a fresh subtopic, then asserts
   * that the returned array is non-decreasing (i.e. each element's orderIndex
   * is >= the previous element's orderIndex).
   *
   * Note: duplicate orderIndex values are allowed by the schema (only the
   * composite (subTopicId, title) pair must be unique), so the sort is
   * non-strict (<=).
   */
  it('Property 7: findUnitsBySubTopic ordering — returned units are sorted by orderIndex ASC', () => {
    // Feature: units-config, Property 7: findUnitsBySubTopic returns units in ascending orderIndex order
    fc.assert(
      fc.property(
        // Generate an array of orderIndex values (integers, possibly negative,
        // possibly duplicated) with at least 2 entries so the ordering
        // assertion is meaningful.
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 2, maxLength: 20 }),
        (orderIndexes) => {
          const db = createTestDb();

          // Seed a subtopic so the FK constraint is satisfied
          const subTopicId = crypto.randomUUID();
          db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
            subTopicId,
            crypto.randomUUID(),
            'Test SubTopic',
          );

          const repo = new UnitRepository(db);

          // Insert one unit per orderIndex value.  Titles must be unique within
          // the subtopic (UNIQUE(subTopicId, title) constraint), so we use the
          // loop index to guarantee uniqueness even when orderIndex values repeat.
          orderIndexes.forEach((orderIndex, i) => {
            repo.createUnit({
              subTopicId,
              title: `Unit ${i}`,
              orderIndex,
            });
          });

          // Fetch all units for the subtopic
          const units = repo.findUnitsBySubTopic(subTopicId);

          db.close();

          // The returned array must contain the same number of units we inserted
          if (units.length !== orderIndexes.length) return false;

          // Every consecutive pair must be non-decreasing
          return units.every((u, i) => i === 0 || units[i - 1].orderIndex <= u.orderIndex);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property 13 — Subtopic cascade-deletes its Units
  // Validates: Requirements 19.4
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 19.4**
   *
   * For any subtopic with N associated units (N >= 1), deleting that subtopic
   * via `DELETE FROM subtopics WHERE id = ?` SHALL result in zero units
   * remaining with that `subTopicId`.
   *
   * This property verifies that the `ON DELETE CASCADE` FK constraint on
   * `units.subTopicId → subtopics(id)` is correctly enforced by the schema.
   * The cascade is a database-level guarantee, not application code.
   *
   * The test:
   *   1. Creates a fresh in-memory DB with foreign keys enabled.
   *   2. Seeds a subtopic and N units (N >= 1) under it.
   *   3. Deletes the subtopic directly via SQL.
   *   4. Asserts that no units with that `subTopicId` remain.
   *
   * A second subtopic with its own units is also seeded to confirm that only
   * the deleted subtopic's units are removed (no collateral damage).
   */
  it('Property 13: Subtopic cascade-deletes its Units — zero units remain after subtopic deletion', () => {
    // Feature: units-config, Property 13: Subtopic cascade-deletes its Units
    fc.assert(
      fc.property(
        // Generate N unit titles for the subtopic being deleted (N >= 1)
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), { minLength: 1, maxLength: 20 }),
        // Generate M unit titles for a sibling subtopic (M >= 1) to verify no collateral damage
        fc.array(fc.string({ minLength: 1, maxLength: 80 }), { minLength: 1, maxLength: 10 }),
        (unitTitles, siblingUnitTitles) => {
          // Enable foreign keys so ON DELETE CASCADE is enforced
          const db = createTestDb();
          db.pragma('foreign_keys = ON');

          const repo = new UnitRepository(db);

          // Seed the subtopic to be deleted
          const targetSubTopicId = crypto.randomUUID();
          db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
            targetSubTopicId,
            crypto.randomUUID(),
            'Target SubTopic',
          );

          // Seed a sibling subtopic that should NOT be affected by the delete
          const siblingSubTopicId = crypto.randomUUID();
          db.prepare('INSERT INTO subtopics (id, topicId, title) VALUES (?, ?, ?)').run(
            siblingSubTopicId,
            crypto.randomUUID(),
            'Sibling SubTopic',
          );

          // Deduplicate unit titles within each subtopic to satisfy UNIQUE(subTopicId, title)
          const uniqueUnitTitles = Array.from(new Set(unitTitles));
          const uniqueSiblingTitles = Array.from(new Set(siblingUnitTitles));

          // Insert N units under the target subtopic
          for (let i = 0; i < uniqueUnitTitles.length; i++) {
            repo.createUnit({ subTopicId: targetSubTopicId, title: uniqueUnitTitles[i] });
          }

          // Insert M units under the sibling subtopic
          for (let i = 0; i < uniqueSiblingTitles.length; i++) {
            repo.createUnit({ subTopicId: siblingSubTopicId, title: uniqueSiblingTitles[i] });
          }

          // Confirm units exist before deletion
          const unitsBefore = repo.findUnitsBySubTopic(targetSubTopicId);
          if (unitsBefore.length !== uniqueUnitTitles.length) {
            db.close();
            return false;
          }

          // Delete the target subtopic — ON DELETE CASCADE should remove its units
          db.prepare('DELETE FROM subtopics WHERE id = ?').run(targetSubTopicId);

          // Assert: zero units remain for the deleted subtopic
          const unitsAfter = repo.findUnitsBySubTopic(targetSubTopicId);
          if (unitsAfter.length !== 0) {
            db.close();
            return false;
          }

          // Assert: sibling subtopic's units are unaffected
          const siblingUnitsAfter = repo.findUnitsBySubTopic(siblingSubTopicId);
          if (siblingUnitsAfter.length !== uniqueSiblingTitles.length) {
            db.close();
            return false;
          }

          db.close();
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
