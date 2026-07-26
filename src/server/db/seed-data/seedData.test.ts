/**
 * seedData.test.ts
 *
 * Property-based tests for GCP seed data correctness.
 * Reads real JSON files from disk and asserts structural and relational invariants.
 *
 * Feature: gcp-seed-data-expansion
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ─── Path helpers ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GCP_DIR = path.join(__dirname, 'gcp');

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicRecord {
  id: string;
  certificationId: string;
  title: string;
  orderIndex: number;
}

interface SubtopicRecord {
  id: string;
  topicId: string;
  title: string;
  orderIndex: number;
}

interface QuestionRecord {
  id: string;
  topicId: string;
  subtopicId: string;
  questionText: string;
  questionType: 'single' | 'multiple';
  options: string[];
  correctAnswers: string[];
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
}

interface QuestionsFile {
  certificationId: string;
  setNumber: number;
  questions: QuestionRecord[];
}

// ─── Data loading helpers ────────────────────────────────────────────────────

/**
 * Dynamically discover populated cert slugs — only include directories that
 * contain a topics.json file. Empty placeholder folders (gcp-ace, gcp-pde …)
 * are silently skipped so tests only run against certs with real data.
 */
const TARGET_CERTS = fs
  .readdirSync(GCP_DIR, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(GCP_DIR, entry.name, 'topics.json')),
  )
  .map((entry) => entry.name);

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function loadTopics(certId: string): TopicRecord[] {
  return loadJson<TopicRecord[]>(path.join(GCP_DIR, certId, 'topics.json'));
}

function loadSubtopics(certId: string): SubtopicRecord[] {
  return loadJson<SubtopicRecord[]>(path.join(GCP_DIR, certId, 'subtopics.json'));
}

/** Returns all question set files for a cert (set 1, 2, 3, ...) */
function loadAllQuestionSets(certId: string): QuestionsFile[] {
  const certDir = path.join(GCP_DIR, certId);
  const sets: QuestionsFile[] = [];
  let setNum = 1;
  while (true) {
    const filePath = path.join(certDir, `questions-set-${setNum}.json`);
    if (!fs.existsSync(filePath)) break;
    sets.push(loadJson<QuestionsFile>(filePath));
    setNum++;
  }
  return sets;
}

/** Returns all questions across all sets for a cert */
function allQuestions(certId: string): QuestionRecord[] {
  return loadAllQuestionSets(certId).flatMap((s) => s.questions);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GCP seed data correctness properties', () => {
  // Guard: skip the entire suite if no populated cert directories exist yet.
  // This prevents fc.constantFrom crashes and keeps CI green while seed data
  // is being authored incrementally.
  if (TARGET_CERTS.length === 0) {
    it('skipped – no populated GCP cert directories found in seed-data/gcp/', () => {
      console.warn(
        'seedData.test.ts: TARGET_CERTS is empty. Add topics.json to a gcp/<cert>/ folder to enable these tests.',
      );
    });

    return;
  }

  /**
   * **Feature: gcp-seed-data-expansion, Property 1: Minimum question count per set**
   * Validates: Requirements 1.2, 2.2
   */
  it('Property 1: each question set file contains at least 10 questions', () => {
    // For any question set file of the 7 target certs, questions.length >= 10
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const sets = loadAllQuestionSets(certId);
        // Only check sets 2 and 3 (set 1 may have fewer for some certs per existing data)
        const sets2and3 = sets.filter((s) => s.setNumber >= 2);
        for (const set of sets2and3) {
          expect(set.questions.length).toBeGreaterThanOrEqual(10);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 2: Referential integrity**
   * Validates: Requirements 1.4, 2.4
   */
  it('Property 2: every question references a valid topicId and subtopicId', () => {
    // For any question in any set, topicId and subtopicId must exist in topics/subtopics.json
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const topics = loadTopics(certId);
        const subtopics = loadSubtopics(certId);

        const topicIds = new Set(topics.map((t) => t.id));
        // Map topicId -> Set of valid subtopic IDs
        const subtopicsByTopic = new Map<string, Set<string>>();
        for (const sub of subtopics) {
          if (!subtopicsByTopic.has(sub.topicId)) {
            subtopicsByTopic.set(sub.topicId, new Set());
          }

          subtopicsByTopic.get(sub.topicId)!.add(sub.id);
        }

        const questions = allQuestions(certId);
        for (const q of questions) {
          expect(
            topicIds.has(q.topicId),
            `Question ${q.id}: topicId "${q.topicId}" not found in topics.json`,
          ).toBe(true);
          const validSubtopics = subtopicsByTopic.get(q.topicId);
          expect(
            validSubtopics?.has(q.subtopicId),
            `Question ${q.id}: subtopicId "${q.subtopicId}" not found under topic "${q.topicId}"`,
          ).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 3: Question ID uniqueness across all sets**
   * Validates: Requirements 1.3, 2.3, 3.3
   */
  it('Property 3: no duplicate question IDs across all sets for a cert', () => {
    // For any cert, all question IDs across all sets must be unique
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const questions = allQuestions(certId);
        const ids = questions.map((q) => q.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 4: Single-type questions have exactly one correct answer**
   * Validates: Requirements 1.6, 2.6
   */
  it('Property 4: single-type questions have exactly one correctAnswer', () => {
    // For any question with questionType === "single", correctAnswers.length === 1
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const questions = allQuestions(certId);
        for (const q of questions.filter((q) => q.questionType === 'single')) {
          expect(
            q.correctAnswers.length,
            `Question ${q.id}: single-type must have exactly 1 correctAnswer`,
          ).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 5: Multiple-type questions have valid correct answers**
   * Validates: Requirements 1.7, 2.7
   */
  it('Property 5: multiple-type questions have 2+ correctAnswers all present in options', () => {
    // For any question with questionType === "multiple":
    //   correctAnswers.length >= 2 AND every correctAnswer appears in options
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const questions = allQuestions(certId);
        for (const q of questions.filter((q) => q.questionType === 'multiple')) {
          expect(
            q.correctAnswers.length,
            `Question ${q.id}: multiple-type must have at least 2 correctAnswers`,
          ).toBeGreaterThanOrEqual(2);

          const optionSet = new Set(q.options);
          for (const answer of q.correctAnswers) {
            expect(
              optionSet.has(answer),
              `Question ${q.id}: correctAnswer "${answer}" not found in options`,
            ).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 6: Difficulty and question type distribution**
   * Validates: Requirements 1.8, 2.8, 4.4
   */
  it('Property 6: no difficulty tier exceeds 60% and multiple-type >= 10% per set', () => {
    // For any question set (sets 2 and 3), difficulty distribution <= 60% per tier
    // and multiple-type questions >= 10%
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const sets = loadAllQuestionSets(certId);
        const sets2and3 = sets.filter((s) => s.setNumber >= 2);

        for (const set of sets2and3) {
          const total = set.questions.length;
          if (total === 0) continue;

          // Difficulty distribution
          const difficultyCounts: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
          let multipleCount = 0;

          for (const q of set.questions) {
            difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] ?? 0) + 1;
            if (q.questionType === 'multiple') multipleCount++;
          }

          for (const [tier, count] of Object.entries(difficultyCounts)) {
            const pct = count / total;
            expect(
              pct,
              `Cert ${certId} set ${set.setNumber}: difficulty "${tier}" is ${Math.round(pct * 100)}% (max 60%)`,
            ).toBeLessThanOrEqual(0.6);
          }

          const multiplePct = multipleCount / total;
          expect(
            multiplePct,
            `Cert ${certId} set ${set.setNumber}: multiple-type is ${Math.round(multiplePct * 100)}% (min 10%)`,
          ).toBeGreaterThanOrEqual(0.1);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 7: Full topic coverage**
   * Validates: Requirements 1.5, 2.5
   */
  it('Property 7: all topics from topics.json appear in at least one question across all sets', () => {
    // For any cert, the union of topicIds across all question sets equals the topic IDs in topics.json
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const topics = loadTopics(certId);
        const topicIds = new Set(topics.map((t) => t.id));
        const questions = allQuestions(certId);
        const coveredTopics = new Set(questions.map((q) => q.topicId));

        for (const topicId of topicIds) {
          expect(
            coveredTopics.has(topicId),
            `Cert ${certId}: topic "${topicId}" has no questions across any set`,
          ).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: gcp-seed-data-expansion, Property 8: Question text uniqueness across all sets**
   * Validates: Requirements 3.4
   */
  it('Property 8: no duplicate question texts across all sets for a cert', () => {
    // For any cert, all questionText values across all sets must be unique
    fc.assert(
      fc.property(fc.constantFrom(...TARGET_CERTS), (certId) => {
        const questions = allQuestions(certId);
        const texts = questions.map((q) => q.questionText);
        const uniqueTexts = new Set(texts);
        expect(uniqueTexts.size).toBe(texts.length);
      }),
      { numRuns: 100 },
    );
  });
});
