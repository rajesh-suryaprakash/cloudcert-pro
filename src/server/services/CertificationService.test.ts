import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as fc from 'fast-check';
import { CertificationRepository } from '../repositories/CertificationRepository';
import { QuestionRepository } from '../repositories/QuestionRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { CertificationService } from './CertificationService';
import { ValidationError, NotFoundError } from '../errors';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT,
      vendor TEXT,
      description TEXT,
      level TEXT,
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
      certificationId TEXT,
      title TEXT,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT,
      UNIQUE(certificationId, title)
    );
    CREATE TABLE subtopics (
      id TEXT PRIMARY KEY,
      topicId TEXT,
      title TEXT,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT,
      subTopicId TEXT,
      unitId TEXT,
      questionText TEXT,
      questionType TEXT DEFAULT 'single',
      options TEXT DEFAULT '[]',
      correctAnswers TEXT DEFAULT '[]',
      explanation TEXT,
      difficulty TEXT DEFAULT 'Medium',
      tags TEXT DEFAULT '[]',
      points INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
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
    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      examConfigurationId TEXT
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
  `);
  return db;
}

describe('CertificationService', () => {
  let service: CertificationService;

  beforeEach(() => {
    const db = createTestDb();
    service = new CertificationService(
      new CertificationRepository(db),
      new QuestionRepository(db),
      new UnitRepository(db),
    );
  });

  /**
   * Feature: codebase-refactoring, Property 1: CertificationService throws typed errors for invalid inputs
   * Validates: Requirements 1.3
   */
  it('Property 1: throws ValidationError for titles shorter than 5 or longer than 255 characters', () => {
    // Titles that are too short (< 5 chars) or too long (> 255 chars)
    const invalidTitleArb = fc.oneof(fc.string({ maxLength: 4 }), fc.string({ minLength: 256 }));

    fc.assert(
      fc.property(invalidTitleArb, (title) => {
        let threw = false;
        try {
          service.createCertification({ title, vendor: 'v', description: 'd' });
        } catch (err) {
          threw = err instanceof ValidationError;
        }
        return threw;
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1: throws ValidationError for invalid cert level values', () => {
    // Any level string that is not one of the four allowed values
    const validLevels = new Set(['Foundational', 'Associate', 'Professional', 'Expert']);
    const invalidLevelArb = fc.string({ minLength: 1 }).filter((s) => !validLevels.has(s));

    fc.assert(
      fc.property(invalidLevelArb, (level) => {
        let threw = false;
        try {
          service.createCertification({
            title: 'Valid Title',
            vendor: 'v',
            description: 'd',
            level,
          });
        } catch (err) {
          threw = err instanceof ValidationError;
        }
        return threw;
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1: throws ValidationError for malformed URL values', () => {
    // Strings that are not valid URLs (no scheme, no host, etc.)
    const invalidUrlArb = fc.string({ minLength: 1 }).filter((s) => {
      try {
        new URL(s);
        return false;
      } catch {
        return true;
      }
    });

    fc.assert(
      fc.property(invalidUrlArb, (url) => {
        let threw = false;
        try {
          service.createCertification({ title: 'Valid Title', vendor: 'v', description: 'd', url });
        } catch (err) {
          threw = err instanceof ValidationError;
        }
        return threw;
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1: throws ValidationError for exam config values outside allowed ranges', () => {
    const outOfRangeArb = fc.oneof(
      // name too short or too long
      fc.record({
        name: fc.oneof(fc.string({ maxLength: 4 }), fc.string({ minLength: 256 })),
        duration: fc.integer({ min: 15, max: 480 }),
        totalQuestions: fc.integer({ min: 5, max: 500 }),
        passingScore: fc.integer({ min: 0, max: 100 }),
      }),
      // duration out of range
      fc.record({
        name: fc.string({ minLength: 5, maxLength: 50 }),
        duration: fc.oneof(fc.integer({ max: 14 }), fc.integer({ min: 481 })),
        totalQuestions: fc.integer({ min: 5, max: 500 }),
        passingScore: fc.integer({ min: 0, max: 100 }),
      }),
      // totalQuestions out of range
      fc.record({
        name: fc.string({ minLength: 5, maxLength: 50 }),
        duration: fc.integer({ min: 15, max: 480 }),
        totalQuestions: fc.oneof(fc.integer({ max: 4 }), fc.integer({ min: 501 })),
        passingScore: fc.integer({ min: 0, max: 100 }),
      }),
      // passingScore out of range
      fc.record({
        name: fc.string({ minLength: 5, maxLength: 50 }),
        duration: fc.integer({ min: 15, max: 480 }),
        totalQuestions: fc.integer({ min: 5, max: 500 }),
        passingScore: fc.oneof(fc.integer({ max: -1 }), fc.integer({ min: 101 })),
      }),
    );

    fc.assert(
      fc.property(outOfRangeArb, ({ name, duration, totalQuestions, passingScore }) => {
        let threw = false;
        try {
          service.createExamConfig('cert-id', { name, duration, totalQuestions, passingScore });
        } catch (err) {
          threw = err instanceof ValidationError;
        }
        return threw;
      }),
      { numRuns: 100 },
    );
  });
});

// ── Unit method tests ────────────────────────────────────────────────────────
// Feature: units-config
// Requirements: 9.1, 9.2, 9.3, 9.4, 9.5

/**
 * Extended test DB that includes the docUrl / weightPercentage columns on
 * topics (required by CertificationRepository.createTopic) and the units table.
 */
function createFullTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE certifications (
      id TEXT PRIMARY KEY,
      title TEXT,
      vendor TEXT,
      description TEXT,
      level TEXT,
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
      certificationId TEXT,
      title TEXT,
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
      topicId TEXT,
      title TEXT,
      description TEXT,
      orderIndex INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topicId TEXT,
      subTopicId TEXT,
      unitId TEXT,
      questionText TEXT,
      questionType TEXT DEFAULT 'single',
      options TEXT DEFAULT '[]',
      correctAnswers TEXT DEFAULT '[]',
      explanation TEXT,
      difficulty TEXT DEFAULT 'Medium',
      tags TEXT DEFAULT '[]',
      points INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
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
    CREATE TABLE exam_sessions (
      id TEXT PRIMARY KEY,
      examConfigurationId TEXT
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
  `);
  return db;
}

describe('CertificationService — unit methods', () => {
  let db: ReturnType<typeof createFullTestDb>;
  let certRepo: CertificationRepository;
  let questionRepo: QuestionRepository;
  let unitRepo: UnitRepository;
  let service: CertificationService;

  // Seed IDs reused across tests
  let certId: string;
  let topicId: string;
  let subtopicId: string;

  beforeEach(() => {
    db = createFullTestDb();
    certRepo = new CertificationRepository(db);
    questionRepo = new QuestionRepository(db);
    unitRepo = new UnitRepository(db);
    service = new CertificationService(certRepo, questionRepo, unitRepo);

    // Seed a minimal hierarchy: certification → topic → subtopic
    certId = certRepo.create({
      title: 'Test Certification',
      vendor: 'TestVendor',
      description: 'desc',
      level: 'Associate',
    });

    topicId = certRepo.createTopic({
      certificationId: certId,
      title: 'Test Topic',
    });

    subtopicId = certRepo.createSubTopic({
      topicId,
      title: 'Test Subtopic',
    });
  });

  // ── createUnit ─────────────────────────────────────────────────────────────

  it('createUnit delegates to UnitRepository and returns a new unit ID', () => {
    // Requirements: 9.1
    const unitId = service.createUnit(subtopicId, { title: 'Unit Alpha' });

    expect(typeof unitId).toBe('string');
    expect(unitId.length).toBeGreaterThan(0);

    const stored = unitRepo.findUnitById(unitId);
    expect(stored).toBeDefined();
    expect(stored!.title).toBe('Unit Alpha');
    expect(stored!.subTopicId).toBe(subtopicId);
  });

  it('createUnit throws NotFoundError when subtopicId does not exist', () => {
    // Requirements: 9.1 (validation path)
    expect(() => service.createUnit('non-existent-subtopic', { title: 'Unit Beta' })).toThrow(
      NotFoundError,
    );
  });

  it('createUnit persists all provided DTO fields via the repository', () => {
    // Requirements: 9.1
    const unitId = service.createUnit(subtopicId, {
      title: 'Detailed Unit',
      description: 'A detailed description',
      orderIndex: 5,
      isActive: false,
    });

    const stored = unitRepo.findUnitById(unitId);
    expect(stored!.description).toBe('A detailed description');
    expect(stored!.orderIndex).toBe(5);
    expect(stored!.isActive).toBe(0); // SQLite stores booleans as integers
  });

  // ── updateUnit ─────────────────────────────────────────────────────────────

  it('updateUnit delegates to UnitRepository and persists changes', () => {
    // Requirements: 9.2
    const unitId = unitRepo.createUnit({ subTopicId: subtopicId, title: 'Original Title' });

    service.updateUnit(unitId, { title: 'Updated Title' });

    const stored = unitRepo.findUnitById(unitId);
    expect(stored!.title).toBe('Updated Title');
  });

  it('updateUnit throws NotFoundError when unit ID does not exist', () => {
    // Requirements: 9.2 (validation path)
    expect(() => service.updateUnit('non-existent-unit', { title: 'New Title' })).toThrow(
      NotFoundError,
    );
  });

  it('updateUnit only modifies the provided fields, leaving others unchanged', () => {
    // Requirements: 9.2
    const unitId = unitRepo.createUnit({
      subTopicId: subtopicId,
      title: 'Stable Title',
      description: 'Stable Description',
      orderIndex: 3,
    });

    service.updateUnit(unitId, { orderIndex: 10 });

    const stored = unitRepo.findUnitById(unitId);
    expect(stored!.title).toBe('Stable Title');
    expect(stored!.description).toBe('Stable Description');
    expect(stored!.orderIndex).toBe(10);
  });

  // ── deleteUnit ─────────────────────────────────────────────────────────────

  it('deleteUnit delegates to UnitRepository and removes the record', () => {
    // Requirements: 9.3
    const unitId = unitRepo.createUnit({ subTopicId: subtopicId, title: 'To Be Deleted' });

    service.deleteUnit(unitId);

    expect(unitRepo.findUnitById(unitId)).toBeUndefined();
  });

  it('deleteUnit does not throw when the unit ID does not exist', () => {
    // Requirements: 9.3 — repository-level delete is a no-op for missing IDs
    expect(() => service.deleteUnit('non-existent-unit')).not.toThrow();
  });

  // ── createUnitQuestion ─────────────────────────────────────────────────────

  it('createUnitQuestion sets topicId via unit → subtopic → topic traversal', () => {
    // Requirements: 9.4, 9.5
    const unitId = unitRepo.createUnit({ subTopicId: subtopicId, title: 'Traversal Unit' });

    const questionId = service.createUnitQuestion(unitId, {
      questionText: 'What is 2 + 2?',
      options: ['3', '4', '5'],
      correctAnswers: ['4'],
    });

    const row = db
      .prepare('SELECT topicId, subTopicId, unitId FROM questions WHERE id = ?')
      .get(questionId) as { topicId: string; subTopicId: string; unitId: string };

    expect(row.topicId).toBe(topicId);
    expect(row.subTopicId).toBe(subtopicId);
    expect(row.unitId).toBe(unitId);
  });

  it('createUnitQuestion throws NotFoundError when unitId does not exist', () => {
    // Requirements: 9.4
    expect(() =>
      service.createUnitQuestion('non-existent-unit', {
        questionText: 'Q?',
        options: ['A'],
        correctAnswers: ['A'],
      }),
    ).toThrow(NotFoundError);
  });

  it('createUnitQuestion returns a valid question ID string', () => {
    // Requirements: 9.4
    const unitId = unitRepo.createUnit({ subTopicId: subtopicId, title: 'ID Check Unit' });

    const questionId = service.createUnitQuestion(unitId, {
      questionText: 'Sample question?',
      options: ['Yes', 'No'],
      correctAnswers: ['Yes'],
    });

    expect(typeof questionId).toBe('string');
    expect(questionId.length).toBeGreaterThan(0);
  });

  it('createUnitQuestion persists all provided question fields', () => {
    // Requirements: 9.4
    const unitId = unitRepo.createUnit({ subTopicId: subtopicId, title: 'Fields Unit' });

    const questionId = service.createUnitQuestion(unitId, {
      questionText: 'Which cloud provider?',
      questionType: 'single',
      options: ['AWS', 'GCP', 'Azure'],
      correctAnswers: ['GCP'],
      explanation: 'GCP is Google Cloud Platform.',
      difficulty: 'Easy',
      tags: ['cloud', 'gcp'],
      points: 2,
    });

    const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as Record<
      string,
      unknown
    >;

    expect(row.questionText).toBe('Which cloud provider?');
    expect(row.explanation).toBe('GCP is Google Cloud Platform.');
    expect(row.difficulty).toBe('Easy');
    expect(row.points).toBe(2);
  });

  // ── missing UnitRepository guard ───────────────────────────────────────────

  it('throws when UnitRepository is not provided and unit methods are called', () => {
    // Instantiate service without unitRepo (optional parameter)
    const serviceWithoutUnitRepo = new CertificationService(certRepo, questionRepo);

    expect(() => serviceWithoutUnitRepo.createUnit(subtopicId, { title: 'X' })).toThrow(
      'UnitRepository not available',
    );
    expect(() => serviceWithoutUnitRepo.updateUnit('any-id', { title: 'X' })).toThrow(
      'UnitRepository not available',
    );
    expect(() => serviceWithoutUnitRepo.deleteUnit('any-id')).toThrow(
      'UnitRepository not available',
    );
    expect(() =>
      serviceWithoutUnitRepo.createUnitQuestion('any-id', {
        questionText: 'Q?',
        options: ['A'],
        correctAnswers: ['A'],
      }),
    ).toThrow('UnitRepository not available');
  });
});
