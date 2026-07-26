/**
 * seedCertifications.ts
 *
 * Enterprise-grade seeding script for GCP certification data.
 *
 * ID Strategy — Deterministic UUID v5:
 *   JSON files use human-readable slug IDs (e.g. "gcp-ace", "topic-ace-setup").
 *   The seeder converts every slug to a deterministic UUID v5 via slugToUuid().
 *   The same slug always produces the same UUID, so the seeder remains fully
 *   idempotent across restarts and DB resets.
 *
 *   Namespace: CLOUDCERT_NS (a fixed UUID v4 that anchors all derived IDs)
 *   Algorithm: UUID v5 = SHA-1(namespace + slug), formatted per RFC 4122
 *
 * File Naming Convention (v1.0.4+):
 *   All JSON files follow the pattern: {provider}-{cert-slug}-{file-type}.json
 *   Example: gcp-pca-certification.json, gcp-pca-topics.json
 *
 * Data layout (all under src/server/db/seed-data/gcp/<cert-slug>/):
 *   {provider}-{cert-slug}-certification.json        — single cert record
 *   {provider}-{cert-slug}-exam-configurations.json  — array of exam configs
 *   {provider}-{cert-slug}-topics.json               — flat array of topics
 *   {provider}-{cert-slug}-subtopics.json            — flat array of subtopics
 *   {provider}-{cert-slug}-units.json                — flat array of units
 *
 *   Question sets — two supported layouts (both checked per cert):
 *   a) Legacy flat:  questions-set-N.json  (used by gcp-ace, gcp-pcne, etc.)
 *   b) Difficulty subdirs (used by gcp-pca and future certs with large question banks):
 *      mcq-questions/<difficulty>-difficulty-mcq-questions-and-answers/
 *        {provider}-{cert-slug}-mcq-questions-and-answer-{difficulty}-set{N}.json
 *
 * Seeding order (respects FK constraints):
 *   certifications → exam_configurations → topics → subtopics → units → questions
 *
 * Idempotent: INSERT OR IGNORE throughout — safe to run on every server start.
 * Atomic: each certification is wrapped in a single db.transaction().
 * Auto-discovery: cert folders are found by scanning the gcp/ directory.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from './connection';
import { nowMs } from '../utils/time';
import { logger } from '../logger';

// ─────────────────────────────────────────────────────────────────────────────
// Seed-data directory
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.join(__dirname, 'seed-data');

// Config data root — certification metadata, topics, subtopics, units, exam configs.
// Layout: seed-data/gcp/<cert-slug>/{provider}-{cert-slug}-{file-type}.json
const GCP_DIR = path.join(SEED_DIR, 'gcp');

// Question sets for a cert may live in one of two places (both are checked):
//   1. Flat in the cert dir:  seed-data/gcp/<cert-slug>/questions-set-N.json  (legacy)
//   2. Difficulty subdirs:    seed-data/gcp/<cert-slug>/mcq-questions/<difficulty>-difficulty-mcq-questions-and-answers/
//      e.g. mcq-questions/easy-difficulty-mcq-questions-and-answers/gcp-pca-mcq-questions-and-answer-easy-set1.json
// The subdirectory name is a constant so it is defined once here.
const MCQ_SUBDIR = 'mcq-questions';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic UUID v5 generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fixed namespace UUID for CloudCert Pro seed data.
 * This value must never change — it anchors all derived IDs.
 * Generated once as a random UUID v4 and hardcoded here.
 */
const CLOUDCERT_NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID v5 DNS namespace (RFC 4122)

/**
 * Converts a namespace UUID string to a 16-byte Buffer.
 */
function nsToBytes(ns: string): Buffer {
  const hex = ns.replace(/-/g, '');
  return Buffer.from(hex, 'hex');
}

const NS_BYTES = nsToBytes(CLOUDCERT_NS);

/**
 * Generates a deterministic UUID v5 from a slug string.
 * Identical to the RFC 4122 UUID v5 algorithm:
 *   hash = SHA-1(namespace_bytes + name_bytes)
 *   set version bits (4..7 of byte 6) to 0101 (5)
 *   set variant bits (6..7 of byte 8) to 10
 *
 * The same slug always produces the same UUID — enabling idempotent seeding.
 */
function slugToUuid(slug: string): string {
  const nameBytes = Buffer.from(slug, 'utf8');
  const hash = crypto.createHash('sha1').update(NS_BYTES).update(nameBytes).digest();

  // Apply version (5) and variant (RFC 4122) bits
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant 10xx

  const hex = hash.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON shape types (slugs as loaded from disk)
// ─────────────────────────────────────────────────────────────────────────────

interface CertificationRecord {
  id: string; // slug e.g. "gcp-ace"
  title: string;
  description: string;
  vendor: string;
  level: string;
  examCode: string;
  url: string;
  iconUrl: string;
}

interface ExamConfigRecord {
  id: string; // slug e.g. "exam-config-gcp-ace-s1"
  certificationId: string; // slug ref
  name: string;
  description: string;
  duration: number;
  totalQuestions: number;
  passingScore: number;
  questionSelectionStrategy: 'random' | 'difficulty_balanced' | 'topic_based';
}

interface TopicRecord {
  id: string; // slug e.g. "topic-ace-setup"
  certificationId: string; // slug ref
  title: string;
  description: string;
  orderIndex: number;
  weightPercentage?: number; // optional domain weight (0-100)
  docUrl?: string; // optional documentation URL
}

interface SubtopicRecord {
  id: string; // slug e.g. "sub-ace-iam"
  topicId: string; // slug ref
  title: string;
  description: string;
  orderIndex: number;
}

interface UnitRecord {
  id: string; // slug e.g. "unit-ace-iam-service-accounts"
  subTopicId: string; // slug ref → subtopics.id
  title: string;
  description?: string;
  orderIndex: number;
}

interface DomainRecord {
  id: string; // slug e.g. "domain-ace-setup"
  certificationId: string; // slug ref
  domainName: string;
  weightPercentage: number;
}

interface QuestionRecord {
  id: string; // slug e.g. "q-ace-s1-001"
  topicId: string; // slug ref
  unitId?: string; // slug ref → units.id (new leaf-level FK, preferred)
  subTopicId?: string; // slug ref → subtopics.id (kept for backward compatibility)
  domainId?: string; // slug ref (DEPRECATED - kept for backward compatibility)
  questionText: string;
  questionType: 'single' | 'multiple';
  options: string[];
  correctAnswers: string[];
  explanation: string | Record<string, unknown>;
  distractorExplanations?: Record<string, string>; // optional explanations for wrong answers
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
}

interface QuestionsFile {
  certificationId?: string; // slug ref (optional, can be in _schema)
  setNumber?: number; // optional, can be in _schema
  questions: QuestionRecord[];
  _schema?: {
    // Support for wrapped schema format
    certificationId: string;
    setNumber: number;
    questions: QuestionRecord[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_STRATEGIES = new Set(['random', 'difficulty_balanced', 'topic_based']);
const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);
const VALID_QUESTION_TYPES = new Set(['single', 'multiple']);

function validateCertification(c: CertificationRecord, file: string): boolean {
  if (!c.id || !c.title || !c.vendor || !c.level) {
    logger.error(
      { file, id: c.id },
      'Certification missing required fields (id, title, vendor, level)',
    );
    return false;
  }
  return true;
}

function validateExamConfig(e: ExamConfigRecord, file: string): boolean {
  if (!e.id || !e.certificationId || !e.name) {
    logger.error(
      { file, id: e.id },
      'ExamConfig missing required fields (id, certificationId, name)',
    );
    return false;
  }
  if (!VALID_STRATEGIES.has(e.questionSelectionStrategy)) {
    logger.error(
      { file, id: e.id, strategy: e.questionSelectionStrategy },
      'ExamConfig has invalid questionSelectionStrategy',
    );
    return false;
  }
  if (e.duration <= 0 || e.totalQuestions <= 0 || e.passingScore < 0 || e.passingScore > 100) {
    logger.error({ file, id: e.id }, 'ExamConfig has invalid numeric fields');
    return false;
  }
  return true;
}

function validateQuestion(q: QuestionRecord, file: string): boolean {
  if (!q.id || !q.topicId || !q.questionText) {
    logger.error(
      { file, id: q.id },
      'Question missing required fields (id, topicId, questionText)',
    );
    return false;
  }
  // Accept unitId (new) or subTopicId (legacy) — at least one must be present
  if (!q.unitId && !q.subTopicId) {
    logger.error(
      { file, id: q.id },
      'Question missing leaf-level FK: provide unitId (preferred) or subTopicId (legacy)',
    );
    return false;
  }
  if (!VALID_QUESTION_TYPES.has(q.questionType)) {
    logger.error({ file, id: q.id }, 'Question has invalid questionType');
    return false;
  }
  if (!VALID_DIFFICULTIES.has(q.difficulty)) {
    logger.error({ file, id: q.id }, 'Question has invalid difficulty');
    return false;
  }
  if (!Array.isArray(q.options) || q.options.length < 2) {
    logger.error({ file, id: q.id }, 'Question must have at least 2 options');
    return false;
  }
  if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
    logger.error({ file, id: q.id }, 'Question must have at least 1 correctAnswer');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON file loader
// ─────────────────────────────────────────────────────────────────────────────

function loadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    // Strip UTF-8 BOM (0xEF 0xBB 0xBF) if present — some editors and PowerShell
    // write files with a BOM that JSON.parse rejects.
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
    return JSON.parse(content) as T;
  } catch (err) {
    logger.error({ filePath, err }, 'Failed to parse JSON seed file');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prepared statements (lazy — initialized after migrations run)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stmts: any;

function initStmts() {
  stmts = {
    insertCert: db.prepare(`
      INSERT OR IGNORE INTO certifications
        (id, title, description, vendor, level, examCode, url, iconUrl, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `),
    insertExamConfig: db.prepare(`
      INSERT OR IGNORE INTO exam_configurations
        (id, certificationId, name, description, duration, totalQuestions, passingScore,
         questionSelectionStrategy, topicWeights, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', 1)
    `),
    insertTopic: db.prepare(`
      INSERT OR IGNORE INTO topics
        (id, certificationId, title, description, orderIndex, isActive)
      VALUES (?, ?, ?, ?, ?, 1)
    `),
    insertSubtopic: db.prepare(`
      INSERT OR IGNORE INTO subtopics
        (id, topicId, title, description, orderIndex, isActive)
      VALUES (?, ?, ?, ?, ?, 1)
    `),
    insertUnit: db.prepare(`
      INSERT OR IGNORE INTO units
        (id, subTopicId, title, description, orderIndex, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `),
    insertDomain: db.prepare(`
      INSERT OR IGNORE INTO domain_weights
        (id, certificationId, domainName, weightPercentage, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertQuestion: db.prepare(`
      INSERT OR IGNORE INTO questions
        (id, topicId, subTopicId, unitId, domainId, questionText, questionType, options, correctAnswers,
         explanation, distractorExplanations, difficulty, tags, points, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-certification transaction
// All slug IDs are converted to UUIDs here before any DB write.
// Granular seeding: each entity type is seeded independently using INSERT OR IGNORE.
// This ensures partial data can be completed without requiring full DB reset.
// ─────────────────────────────────────────────────────────────────────────────

function seedOneCertification(
  cert: CertificationRecord,
  topics: TopicRecord[],
  subtopics: SubtopicRecord[],
  units: UnitRecord[],
  domains: DomainRecord[],
  examConfigs: ExamConfigRecord[],
  questionSets: QuestionsFile[],
  examConfigFile: string,
): { questions: number; subtopics: number; topics: number; units: number; certNew: boolean } {
  return db.transaction(() => {
    const ts = nowMs();
    const certUuid = slugToUuid(cert.id);

    // 1. Certification — track if this is a new certification
    const certResult = stmts.insertCert.run(
      certUuid,
      cert.title,
      cert.description,
      cert.vendor,
      cert.level,
      cert.examCode ?? null,
      cert.url ?? null,
      cert.iconUrl ?? null,
      ts,
      ts,
    );
    const certNew = certResult.changes > 0;

    // 2. Topics — always attempt to seed (INSERT OR IGNORE handles duplicates)
    let topicsInserted = 0;
    for (const topic of topics) {
      const result = stmts.insertTopic.run(
        slugToUuid(topic.id),
        certUuid,
        topic.title,
        topic.description ?? null,
        topic.orderIndex,
      );
      if (result.changes > 0) topicsInserted++;
    }

    // 3. Subtopics — always attempt to seed
    let subtopicsInserted = 0;
    for (const sub of subtopics) {
      const result = stmts.insertSubtopic.run(
        slugToUuid(sub.id),
        slugToUuid(sub.topicId),
        sub.title,
        sub.description ?? null,
        sub.orderIndex,
      );
      if (result.changes > 0) subtopicsInserted++;
    }

    // 4. Units — always attempt to seed (INSERT OR IGNORE handles duplicates)
    let unitsInserted = 0;
    for (const unit of units) {
      const result = stmts.insertUnit.run(
        slugToUuid(unit.id),
        slugToUuid(unit.subTopicId),
        unit.title,
        unit.description ?? null,
        unit.orderIndex,
        ts,
        ts,
      );
      if (result.changes > 0) unitsInserted++;
    }

    // 5. Domain weights — always attempt to seed
    for (const domain of domains) {
      stmts.insertDomain.run(
        slugToUuid(domain.id),
        certUuid,
        domain.domainName,
        domain.weightPercentage,
        ts,
        ts,
      );
    }

    // 6. Exam configurations — always attempt to seed
    for (const cfg of examConfigs) {
      if (!validateExamConfig(cfg, examConfigFile)) continue;
      stmts.insertExamConfig.run(
        slugToUuid(cfg.id),
        certUuid,
        cfg.name,
        cfg.description ?? null,
        cfg.duration,
        cfg.totalQuestions,
        cfg.passingScore,
        cfg.questionSelectionStrategy,
      );
    }

    // 7. Questions — always attempt to seed
    // unitId is the preferred leaf-level FK; subtopicId is kept for backward compatibility
    let questionsInserted = 0;
    for (const qSet of questionSets) {
      for (const q of qSet.questions) {
        const unitUuid = q.unitId ? slugToUuid(q.unitId) : null;
        const subtopicUuid = q.subTopicId ? slugToUuid(q.subTopicId) : null;
        const params = [
          slugToUuid(q.id),
          slugToUuid(q.topicId),
          subtopicUuid,
          unitUuid,
          q.domainId ? slugToUuid(q.domainId) : null,
          q.questionText,
          q.questionType,
          JSON.stringify(q.options),
          JSON.stringify(q.correctAnswers),
          q.explanation !== null && q.explanation !== undefined
            ? typeof q.explanation === 'string'
              ? q.explanation
              : JSON.stringify(q.explanation)
            : null,
          q.distractorExplanations ? JSON.stringify(q.distractorExplanations) : null,
          q.difficulty,
          JSON.stringify(q.tags ?? []),
        ];
        if (params.length !== 13) {
          logger.error(
            { questionId: q.id, paramCount: params.length },
            'insertQuestion param count mismatch',
          );
          continue;
        }
        const result = stmts.insertQuestion.run(...params);
        if (result.changes > 0) questionsInserted++;
      }
    }

    return {
      certNew,
      topics: topicsInserted,
      subtopics: subtopicsInserted,
      units: unitsInserted,
      questions: questionsInserted,
    };
  })();
}

// ─────────────────────────────────────────────────────────────────────────────
// Discover question-set files for a certification directory
// Supports both legacy and new file naming patterns:
//   Legacy: questions-set-N.json
//   New: {provider}-{cert-slug}-mcq-questions-and-answer-{difficulty}-setN.json
// ─────────────────────────────────────────────────────────────────────────────

function loadQuestionSets(certDir: string, certId: string, certSlug: string): QuestionsFile[] {
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  const sets: QuestionsFile[] = [];

  // Extract provider from certId (e.g., "gcp-pca" → "gcp")
  const provider = certId.split('-')[0];

  const questionFilePattern = new RegExp(
    `^${provider}-${certSlug}-mcq-questions-and-answer-(easy|medium|hard)-set(\\d+)\\.json$`,
    'i',
  );

  // ── Collect candidate files from all search directories ──────────────────
  // 1. Flat cert dir (seed-data/gcp/<cert-slug>/) — new-pattern files placed directly here
  // 2. mcq-questions subdir (seed-data/gcp/<cert-slug>/mcq-questions/) — difficulty subdirs:
  //      easy-difficulty-mcq-questions-and-answers/
  //      medium-difficulty-mcq-questions-and-answers/
  //      hard-difficulty-mcq-questions-and-answers/
  // Both locations are checked; deduplication by question ID and text runs across both.
  const candidateFiles: Array<{ filePath: string; setNum: number; difficulty: string }> = [];

  // Location 1 — flat cert directory (new-pattern files placed directly alongside config)
  if (fs.existsSync(certDir)) {
    for (const file of fs.readdirSync(certDir)) {
      const match = file.match(questionFilePattern);
      if (match) {
        candidateFiles.push({
          filePath: path.join(certDir, file),
          setNum: parseInt(match[2], 10),
          difficulty: match[1].toLowerCase(),
        });
      }
    }
  }

  // Location 2 — mcq-questions/<difficulty>-difficulty-mcq-questions-and-answers/ subdirs
  const mcqDir = path.join(certDir, MCQ_SUBDIR);
  if (fs.existsSync(mcqDir)) {
    const difficultyDirPattern = /^(easy|medium|hard)-difficulty-mcq-questions-and-answers$/i;
    for (const entry of fs.readdirSync(mcqDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.match(difficultyDirPattern)) continue;
      const diffDir = path.join(mcqDir, entry.name);
      for (const file of fs.readdirSync(diffDir)) {
        const match = file.match(questionFilePattern);
        if (match) {
          candidateFiles.push({
            filePath: path.join(diffDir, file),
            setNum: parseInt(match[2], 10),
            difficulty: match[1].toLowerCase(),
          });
        }
      }
    }
  }

  // Sort by difficulty then set number for deterministic ordering
  candidateFiles.sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty.localeCompare(b.difficulty);
    return a.setNum - b.setNum;
  });

  // ── Load and deduplicate ──────────────────────────────────────────────────
  for (const { filePath, setNum, difficulty } of candidateFiles) {
    const data = loadJson<QuestionsFile>(filePath);
    if (!data) continue;

    const questions = data._schema?.questions ?? data.questions;
    if (!Array.isArray(questions) || questions.length === 0) continue;

    const valid: QuestionRecord[] = [];
    for (const q of questions) {
      if (!validateQuestion(q, filePath)) continue;

      if (seenIds.has(q.id)) {
        logger.warn(
          { certId, questionId: q.id, setNum, difficulty },
          'Duplicate question ID across sets — skipping',
        );
        continue;
      }
      if (seenTexts.has(q.questionText)) {
        logger.warn(
          { certId, questionId: q.id, setNum, difficulty },
          'Duplicate question text across sets - skipping',
        );
        continue;
      }

      seenIds.add(q.id);
      seenTexts.add(q.questionText);
      valid.push(q);
    }

    if (valid.length > 0) {
      sets.push({
        certificationId: data._schema?.certificationId ?? data.certificationId ?? certId,
        setNumber: data._schema?.setNumber ?? data.setNumber ?? setNum,
        questions: valid,
      });
    }
  }

  // ── Fallback to legacy pattern if no new-pattern files found ─────────────
  if (sets.length === 0) {
    let setNum = 1;
    while (true) {
      const filePath = path.join(certDir, `questions-set-${setNum}.json`);
      if (!fs.existsSync(filePath)) break;

      const data = loadJson<QuestionsFile>(filePath);
      if (data) {
        const questions = data._schema?.questions ?? data.questions;

        if (Array.isArray(questions) && questions.length > 0) {
          const valid: QuestionRecord[] = [];
          for (const q of questions) {
            if (!validateQuestion(q, filePath)) continue;

            if (seenIds.has(q.id)) {
              logger.warn(
                { certId, questionId: q.id, setNum },
                'Duplicate question ID across sets — skipping',
              );
              continue;
            }
            if (seenTexts.has(q.questionText)) {
              logger.warn(
                { certId, questionId: q.id, setNum },
                'Duplicate question text across sets - skipping',
              );
              continue;
            }

            seenIds.add(q.id);
            seenTexts.add(q.questionText);
            valid.push(q);
          }
          sets.push({
            certificationId: data._schema?.certificationId ?? data.certificationId ?? certId,
            setNumber: data._schema?.setNumber ?? data.setNumber ?? setNum,
            questions: valid,
          });
        }
      }
      setNum++;
    }
  }

  return sets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discover all cert folders under gcp/
// ─────────────────────────────────────────────────────────────────────────────

function discoverCertDirs(): string[] {
  if (!fs.existsSync(GCP_DIR)) return [];
  return fs
    .readdirSync(GCP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(GCP_DIR, e.name))
    .sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads all seed-data files and populates the database.
 * Safe to call on every server start — fully idempotent.
 * Slugs in JSON are converted to deterministic UUIDs before DB writes.
 *
 * Granular seeding strategy:
 * - Always attempts to seed all entities (certifications, topics, subtopics, questions)
 * - INSERT OR IGNORE handles duplicates at each level independently
 * - Partial data is automatically completed without requiring DB reset
 * - Logs show exactly what was inserted vs. skipped for transparency
 */
export const seedGcpCertifications = (): void => {
  initStmts();

  const certDirs = discoverCertDirs();
  if (certDirs.length === 0) {
    logger.warn({ GCP_DIR }, 'No certification directories found — skipping seed');
    return;
  }

  let certsNew = 0;
  let certsExisting = 0;
  let totalTopics = 0;
  let totalSubtopics = 0;
  let totalUnits = 0;
  let totalQuestions = 0;
  let skippedQuestions = 0;

  for (const certDir of certDirs) {
    const provider = 'gcp'; // Currently only GCP is supported

    // The cert directory is named with the full cert ID (e.g. "gcp-pca").
    // The short slug strips the provider prefix: "gcp-pca" → "pca".
    // Config files use the full cert ID as their prefix: gcp-pca-certification.json
    // so we pass the full dir name as certSlug to loadQuestionSets and build file paths.
    const certDirName = path.basename(certDir); // e.g. "gcp-pca"
    const certSlug = certDirName.startsWith(`${provider}-`)
      ? certDirName.slice(provider.length + 1) // "pca"
      : certDirName; // fallback: use as-is

    // Build file paths using the naming convention: {provider}-{cert-slug}-{file-type}.json
    const certFile = path.join(certDir, `${provider}-${certSlug}-certification.json`);
    const cert = loadJson<CertificationRecord>(certFile);
    if (!cert) {
      logger.warn({ certDir, certFile }, 'Certification file not found — skipping directory');
      continue;
    }
    if (!validateCertification(cert, certFile)) continue;

    const topicsFile = path.join(certDir, `${provider}-${certSlug}-topics.json`);
    const topics = loadJson<TopicRecord[]>(topicsFile);
    if (!topics || !Array.isArray(topics)) {
      logger.warn(
        { certId: cert.id, topicsFile },
        'Topics file not found or invalid — skipping certification',
      );
      continue;
    }

    const subtopicsFile = path.join(certDir, `${provider}-${certSlug}-subtopics.json`);
    const subtopics = loadJson<SubtopicRecord[]>(subtopicsFile) ?? [];

    const unitsFile = path.join(certDir, `${provider}-${certSlug}-units.json`);
    const unitsRaw = loadJson<UnitRecord[]>(unitsFile) ?? [];
    // Filter out schema documentation entries (entries with _schema or _comment keys only)
    const units = unitsRaw.filter((u) => u.id && u.subTopicId && u.title);

    const domainsFile = path.join(certDir, `${provider}-${certSlug}-domains.json`);
    const domains = loadJson<DomainRecord[]>(domainsFile) ?? [];

    const examConfigFile = path.join(certDir, `${provider}-${certSlug}-exam-configurations.json`);
    const examConfigs = loadJson<ExamConfigRecord[]>(examConfigFile) ?? [];

    const questionSets = loadQuestionSets(certDir, cert.id, certSlug);
    const totalInSets = questionSets.reduce((n, s) => n + s.questions.length, 0);

    try {
      const result = seedOneCertification(
        cert,
        topics,
        subtopics,
        units,
        domains,
        examConfigs,
        questionSets,
        examConfigFile,
      );

      const certUuid = slugToUuid(cert.id);

      if (result.certNew) {
        certsNew++;
        logger.info(
          {
            certSlug: cert.id,
            certUuid,
            title: cert.title,
            topics: result.topics,
            subtopics: result.subtopics,
            units: result.units,
            questions: result.questions,
          },
          'Certification seeded (new)',
        );
      } else {
        certsExisting++;
        // Only log if we actually inserted missing data
        if (result.topics > 0 || result.subtopics > 0 || result.units > 0 || result.questions > 0) {
          logger.info(
            {
              certSlug: cert.id,
              certUuid,
              title: cert.title,
              topics: result.topics,
              subtopics: result.subtopics,
              units: result.units,
              questions: result.questions,
            },
            'Certification updated (filled missing data)',
          );
        }
      }

      totalTopics += result.topics;
      totalSubtopics += result.subtopics;
      totalUnits += result.units;
      totalQuestions += result.questions;
      skippedQuestions += totalInSets - result.questions;
    } catch (err) {
      logger.error({ certId: cert.id, err }, 'Failed to seed certification');
    }
  }

  logger.info(
    {
      certsNew,
      certsExisting,
      totalTopics,
      totalSubtopics,
      totalUnits,
      totalQuestions,
      skippedQuestions,
    },
    'GCP certification seeding complete',
  );
};
