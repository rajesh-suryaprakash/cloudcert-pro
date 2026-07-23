import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { UnitService } from './UnitService';
import { UnitRepository } from '../repositories/UnitRepository';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { NotFoundError } from '../errors';

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
      id TEXT PRIMARY KEY,
      subTopicId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT,
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

describe('UnitService', () => {
  let db: Database.Database;
  let unitRepo: UnitRepository;
  let certRepo: CertificationRepository;
  let service: UnitService;

  // IDs for seeded test data
  const certId = 'cert-1';
  const topicId = 'topic-1';
  const subTopicId = 'subtopic-1';

  beforeEach(() => {
    db = createTestDb();
    unitRepo = new UnitRepository(db);
    certRepo = new CertificationRepository(db);
    service = new UnitService(unitRepo, certRepo);

    // Seed a certification, topic, and subtopic for use in tests
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
  });

  // ── createUnit ──────────────────────────────────────────────────────────────

  describe('createUnit', () => {
    it('throws NotFoundError when subTopicId does not exist', () => {
      // Requirement 5.4: IF a createUnit call references a subTopicId that does not exist,
      // THEN the Unit_Service SHALL throw a NotFoundError.
      expect(() => {
        service.createUnit('non-existent-subtopic-id', { title: 'My Unit' });
      }).toThrow(NotFoundError);
    });

    it('throws NotFoundError with descriptive message when subTopicId does not exist', () => {
      expect(() => {
        service.createUnit('non-existent-subtopic-id', { title: 'My Unit' });
      }).toThrow('Subtopic not found');
    });

    it('successfully creates a unit and returns its id when subtopic exists', () => {
      // Requirement 5.1: createUnit delegates to the Unit_Repository after validating the parent Subtopic exists.
      const id = service.createUnit(subTopicId, { title: 'New Unit' });

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('delegates to unitRepo.createUnit and the unit is retrievable', () => {
      const id = service.createUnit(subTopicId, { title: 'Delegated Unit', orderIndex: 2 });

      const found = unitRepo.findUnitById(id);
      expect(found).toBeDefined();
      if (!found) return;
      expect(found.title).toBe('Delegated Unit');
      expect(found.subTopicId).toBe(subTopicId);
      expect(found.orderIndex).toBe(2);
    });

    it('passes optional fields through to the repository', () => {
      const id = service.createUnit(subTopicId, {
        title: 'Unit With Description',
        description: 'A detailed description',
        orderIndex: 5,
        isActive: false,
      });

      const found = unitRepo.findUnitById(id);
      expect(found).toBeDefined();
      if (!found) return;
      expect(found.description).toBe('A detailed description');
      expect(found.orderIndex).toBe(5);
      expect(found.isActive).toBe(0);
    });
  });

  // ── updateUnit ──────────────────────────────────────────────────────────────

  describe('updateUnit', () => {
    it('throws NotFoundError when unit id does not exist', () => {
      // Requirement 5.5: IF an updateUnit call references a unit id that does not exist,
      // THEN the Unit_Service SHALL throw a NotFoundError.
      expect(() => {
        service.updateUnit('non-existent-unit-id', { title: 'Updated Title' });
      }).toThrow(NotFoundError);
    });

    it('throws NotFoundError with descriptive message when unit id does not exist', () => {
      expect(() => {
        service.updateUnit('non-existent-unit-id', { title: 'Updated Title' });
      }).toThrow('Unit not found');
    });

    it('successfully updates a unit when it exists', () => {
      // Requirement 5.2: updateUnit fetches the current record and delegates to the Unit_Repository.
      const id = unitRepo.createUnit({ subTopicId, title: 'Original Title', orderIndex: 0 });

      service.updateUnit(id, { title: 'Updated Title' });

      const found = unitRepo.findUnitById(id);
      expect(found).toBeDefined();
      if (!found) return;
      expect(found.title).toBe('Updated Title');
    });

    it('delegates to unitRepo.updateUnit and persists partial changes', () => {
      const id = unitRepo.createUnit({
        subTopicId,
        title: 'Original',
        description: 'Original desc',
        orderIndex: 1,
      });

      service.updateUnit(id, { orderIndex: 10 });

      const found = unitRepo.findUnitById(id);
      expect(found).toBeDefined();
      if (!found) return;
      // Updated field
      expect(found.orderIndex).toBe(10);
      // Unchanged fields preserved
      expect(found.title).toBe('Original');
      expect(found.description).toBe('Original desc');
    });
  });

  // ── deleteUnit ──────────────────────────────────────────────────────────────

  describe('deleteUnit', () => {
    it('successfully delegates to unitRepo.deleteUnit', () => {
      // Requirement 5.3: deleteUnit delegates to the Unit_Repository.
      const id = unitRepo.createUnit({ subTopicId, title: 'Unit To Delete' });

      // Verify it exists before deletion
      expect(unitRepo.findUnitById(id)).toBeDefined();

      service.deleteUnit(id);

      // Verify it no longer exists after deletion
      expect(unitRepo.findUnitById(id)).toBeUndefined();
    });

    it('does not throw when deleting a non-existent unit id', () => {
      // deleteUnit has no guard — it simply delegates to the repo which runs a DELETE with no rows affected
      expect(() => {
        service.deleteUnit('non-existent-unit-id');
      }).not.toThrow();
    });
  });
});
