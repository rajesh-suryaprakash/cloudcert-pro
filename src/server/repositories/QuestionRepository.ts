import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import type { QuestionRow } from '../db-types';
import { nowIso } from '../utils/time';

export interface CreateQuestionDto {
  topicId: string;
  subTopicId: string | null;
  unitId?: string | null;
  questionText: string;
  questionType?: string;
  options: string[];
  correctAnswers: string | string[];
  explanation?: string;
  difficulty?: string;
  tags?: string[];
  points?: number;
  isActive?: boolean;
}

export class QuestionRepository {
  constructor(private readonly db: Database) {}

  findByIds(ids: string[]): QuestionRow[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.db
      .prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`)
      .all(...ids) as QuestionRow[];
  }

  /**
   * Returns the subset of the given question IDs that belong to the specified
   * exam configuration (via its certification's topics). Used to validate that
   * a session creation request does not inject questions from other exams.
   */
  findIdsByExamConfig(examConfigId: string, ids: string[]): string[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT q.id FROM questions q
         JOIN topics t ON q.topicId = t.id
         JOIN exam_configurations ec ON ec.certificationId = t.certificationId
         WHERE ec.id = ? AND q.id IN (${placeholders})`,
      )
      .all(examConfigId, ...ids) as { id: string }[];
    return rows.map((r) => r.id);
  }

  findByCertification(certificationId: string): QuestionRow[] {
    return this.db
      .prepare(
        `SELECT q.* FROM questions q
         JOIN topics t ON q.topicId = t.id
         WHERE t.certificationId = ? AND q.isActive = 1`,
      )
      .all(certificationId) as QuestionRow[];
  }

  findByCertificationAndDifficulty(
    certificationId: string,
    difficulty: string | null,
  ): QuestionRow[] {
    if (difficulty === null) {
      return this.findByCertification(certificationId);
    }
    return this.db
      .prepare(
        `SELECT q.* FROM questions q
         JOIN topics t ON q.topicId = t.id
         WHERE t.certificationId = ? AND q.isActive = 1 AND q.difficulty = ?`,
      )
      .all(certificationId, difficulty) as QuestionRow[];
  }

  findByTopicId(topicId: string): QuestionRow[] {
    return this.db
      .prepare('SELECT * FROM questions WHERE topicId = ?')
      .all(topicId) as QuestionRow[];
  }

  findBySubTopicId(subTopicId: string): QuestionRow[] {
    return this.db
      .prepare('SELECT * FROM questions WHERE subTopicId = ?')
      .all(subTopicId) as QuestionRow[];
  }

  findByCertificationExcludingSeen(
    certificationId: string,
    excludeQuestionIds: string[],
    difficulty?: string | null,
  ): QuestionRow[] {
    if (excludeQuestionIds.length === 0) {
      return this.findByCertificationAndDifficulty(certificationId, difficulty ?? null);
    }

    // Performance optimization: Use temporary table for large exclusion lists
    // Requirements: 6.3, 6.4
    if (excludeQuestionIds.length > 1000) {
      return this._findByCertificationExcludingSeenWithTempTable(
        certificationId,
        excludeQuestionIds,
        difficulty ?? null,
      );
    }

    const placeholders = excludeQuestionIds.map(() => '?').join(',');
    const baseQuery = `
      SELECT q.* FROM questions q
      JOIN topics t ON q.topicId = t.id
      WHERE t.certificationId = ? AND q.isActive = 1 AND q.id NOT IN (${placeholders})
    `;

    if (difficulty) {
      return this.db
        .prepare(`${baseQuery} AND q.difficulty = ?`)
        .all(certificationId, ...excludeQuestionIds, difficulty) as QuestionRow[];
    }

    return this.db.prepare(baseQuery).all(certificationId, ...excludeQuestionIds) as QuestionRow[];
  }

  /**
   * Private helper method for large exclusion lists using temporary table.
   * More efficient than NOT IN clause for >1000 IDs.
   * Requirements: 6.3, 6.4
   */
  private _findByCertificationExcludingSeenWithTempTable(
    certificationId: string,
    excludeQuestionIds: string[],
    difficulty: string | null,
  ): QuestionRow[] {
    const transaction = this.db.transaction(() => {
      // Create temporary table
      this.db.exec('CREATE TEMP TABLE IF NOT EXISTS temp_excluded_questions (id TEXT PRIMARY KEY)');

      // Clear any existing data
      this.db.exec('DELETE FROM temp_excluded_questions');

      // Insert excluded IDs in batches
      const insertStmt = this.db.prepare('INSERT INTO temp_excluded_questions (id) VALUES (?)');
      for (const id of excludeQuestionIds) {
        insertStmt.run(id);
      }

      // Query using LEFT JOIN with temp table
      const baseQuery = `
        SELECT q.* FROM questions q
        JOIN topics t ON q.topicId = t.id
        LEFT JOIN temp_excluded_questions ex ON q.id = ex.id
        WHERE t.certificationId = ? 
          AND q.isActive = 1 
          AND ex.id IS NULL
      `;

      if (difficulty) {
        return this.db
          .prepare(`${baseQuery} AND q.difficulty = ?`)
          .all(certificationId, difficulty) as QuestionRow[];
      }

      return this.db.prepare(baseQuery).all(certificationId) as QuestionRow[];
    });

    return transaction();
  }

  findByTopicExcludingSeen(topicId: string, excludeQuestionIds: string[]): QuestionRow[] {
    if (excludeQuestionIds.length === 0) {
      return this.db
        .prepare('SELECT * FROM questions WHERE topicId = ? AND isActive = 1')
        .all(topicId) as QuestionRow[];
    }

    // Performance optimization: Use temporary table for large exclusion lists
    // Requirements: 6.3, 6.4
    if (excludeQuestionIds.length > 1000) {
      return this._findByTopicExcludingSeenWithTempTable(topicId, excludeQuestionIds);
    }

    const placeholders = excludeQuestionIds.map(() => '?').join(',');
    return this.db
      .prepare(
        `SELECT * FROM questions 
         WHERE topicId = ? AND isActive = 1 AND id NOT IN (${placeholders})`,
      )
      .all(topicId, ...excludeQuestionIds) as QuestionRow[];
  }

  /**
   * Private helper method for large exclusion lists using temporary table.
   * Requirements: 6.3, 6.4
   */
  private _findByTopicExcludingSeenWithTempTable(
    topicId: string,
    excludeQuestionIds: string[],
  ): QuestionRow[] {
    const transaction = this.db.transaction(() => {
      // Create temporary table
      this.db.exec('CREATE TEMP TABLE IF NOT EXISTS temp_excluded_questions (id TEXT PRIMARY KEY)');

      // Clear any existing data
      this.db.exec('DELETE FROM temp_excluded_questions');

      // Insert excluded IDs
      const insertStmt = this.db.prepare('INSERT INTO temp_excluded_questions (id) VALUES (?)');
      for (const id of excludeQuestionIds) {
        insertStmt.run(id);
      }

      // Query using LEFT JOIN with temp table
      return this.db
        .prepare(
          `
          SELECT q.* FROM questions q
          LEFT JOIN temp_excluded_questions ex ON q.id = ex.id
          WHERE q.topicId = ? 
            AND q.isActive = 1 
            AND ex.id IS NULL
        `,
        )
        .all(topicId) as QuestionRow[];
    });

    return transaction();
  }

  findBySubTopicExcludingSeen(subTopicId: string, excludeQuestionIds: string[]): QuestionRow[] {
    if (excludeQuestionIds.length === 0) {
      return this.db
        .prepare('SELECT * FROM questions WHERE subTopicId = ? AND isActive = 1')
        .all(subTopicId) as QuestionRow[];
    }

    // Performance optimization: Use temporary table for large exclusion lists
    // Requirements: 6.3, 6.4
    if (excludeQuestionIds.length > 1000) {
      return this._findBySubTopicExcludingSeenWithTempTable(subTopicId, excludeQuestionIds);
    }

    const placeholders = excludeQuestionIds.map(() => '?').join(',');
    return this.db
      .prepare(
        `SELECT * FROM questions 
         WHERE subTopicId = ? AND isActive = 1 AND id NOT IN (${placeholders})`,
      )
      .all(subTopicId, ...excludeQuestionIds) as QuestionRow[];
  }

  /**
   * Private helper method for large exclusion lists using temporary table.
   * Requirements: 6.3, 6.4
   */
  private _findBySubTopicExcludingSeenWithTempTable(
    subTopicId: string,
    excludeQuestionIds: string[],
  ): QuestionRow[] {
    const transaction = this.db.transaction(() => {
      // Create temporary table
      this.db.exec('CREATE TEMP TABLE IF NOT EXISTS temp_excluded_questions (id TEXT PRIMARY KEY)');

      // Clear any existing data
      this.db.exec('DELETE FROM temp_excluded_questions');

      // Insert excluded IDs
      const insertStmt = this.db.prepare('INSERT INTO temp_excluded_questions (id) VALUES (?)');
      for (const id of excludeQuestionIds) {
        insertStmt.run(id);
      }

      // Query using LEFT JOIN with temp table
      return this.db
        .prepare(
          `
          SELECT q.* FROM questions q
          LEFT JOIN temp_excluded_questions ex ON q.id = ex.id
          WHERE q.subTopicId = ? 
            AND q.isActive = 1 
            AND ex.id IS NULL
        `,
        )
        .all(subTopicId) as QuestionRow[];
    });

    return transaction();
  }

  findByUnitId(unitId: string): QuestionRow[] {
    return this.db
      .prepare('SELECT * FROM questions WHERE unitId = ? AND isActive = 1')
      .all(unitId) as QuestionRow[];
  }

  findByUnitExcludingSeen(unitId: string, excludeQuestionIds: string[]): QuestionRow[] {
    if (excludeQuestionIds.length === 0) {
      return this.db
        .prepare('SELECT * FROM questions WHERE unitId = ? AND isActive = 1')
        .all(unitId) as QuestionRow[];
    }

    // Performance optimization: Use temporary table for large exclusion lists
    // Requirements: 6.3, 6.4
    if (excludeQuestionIds.length > 1000) {
      return this._findByUnitExcludingSeenWithTempTable(unitId, excludeQuestionIds);
    }

    const placeholders = excludeQuestionIds.map(() => '?').join(',');
    return this.db
      .prepare(
        `SELECT * FROM questions 
         WHERE unitId = ? AND isActive = 1 AND id NOT IN (${placeholders})`,
      )
      .all(unitId, ...excludeQuestionIds) as QuestionRow[];
  }

  /**
   * Private helper method for large exclusion lists using temporary table.
   * Requirements: 6.3, 6.4
   */
  private _findByUnitExcludingSeenWithTempTable(
    unitId: string,
    excludeQuestionIds: string[],
  ): QuestionRow[] {
    const transaction = this.db.transaction(() => {
      // Create temporary table
      this.db.exec('CREATE TEMP TABLE IF NOT EXISTS temp_excluded_questions (id TEXT PRIMARY KEY)');

      // Clear any existing data
      this.db.exec('DELETE FROM temp_excluded_questions');

      // Insert excluded IDs
      const insertStmt = this.db.prepare('INSERT INTO temp_excluded_questions (id) VALUES (?)');
      for (const id of excludeQuestionIds) {
        insertStmt.run(id);
      }

      // Query using LEFT JOIN with temp table
      return this.db
        .prepare(
          `
          SELECT q.* FROM questions q
          LEFT JOIN temp_excluded_questions ex ON q.id = ex.id
          WHERE q.unitId = ? 
            AND q.isActive = 1 
            AND ex.id IS NULL
        `,
        )
        .all(unitId) as QuestionRow[];
    });

    return transaction();
  }

  countByCertification(certificationId: string): number {
    const result = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM questions q
         JOIN topics t ON q.topicId = t.id
         WHERE t.certificationId = ? AND q.isActive = 1`,
      )
      .get(certificationId) as { count: number };
    return result.count;
  }

  createQuestion(dto: CreateQuestionDto): string {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO questions
           (id, topicId, subTopicId, unitId, questionText, questionType, options, correctAnswers, explanation, difficulty, tags, points, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.topicId,
        dto.subTopicId,
        dto.unitId ?? null,
        dto.questionText,
        dto.questionType ?? 'single',
        JSON.stringify(dto.options),
        JSON.stringify(dto.correctAnswers),
        dto.explanation ?? null,
        dto.difficulty ?? 'Medium',
        JSON.stringify(dto.tags ?? []),
        dto.points ?? 1,
        dto.isActive !== false ? 1 : 0,
        now,
        now,
      );
    return id;
  }

  updateQuestion(id: string, dto: Omit<CreateQuestionDto, 'topicId' | 'subTopicId'>): void {
    const now = nowIso();

    if (dto.unitId !== undefined) {
      // unitId explicitly provided — update it along with other fields
      this.db
        .prepare(
          `UPDATE questions
           SET questionText = ?, questionType = ?, options = ?, correctAnswers = ?,
               explanation = ?, difficulty = ?, tags = ?, points = ?, isActive = ?,
               unitId = ?, updatedAt = ?
           WHERE id = ?`,
        )
        .run(
          dto.questionText,
          dto.questionType ?? 'single',
          JSON.stringify(dto.options),
          JSON.stringify(dto.correctAnswers),
          dto.explanation ?? null,
          dto.difficulty ?? 'Medium',
          JSON.stringify(dto.tags ?? []),
          dto.points ?? 1,
          dto.isActive !== false ? 1 : 0,
          dto.unitId ?? null,
          now,
          id,
        );
    } else {
      // unitId not provided — preserve existing value
      this.db
        .prepare(
          `UPDATE questions
           SET questionText = ?, questionType = ?, options = ?, correctAnswers = ?,
               explanation = ?, difficulty = ?, tags = ?, points = ?, isActive = ?, updatedAt = ?
           WHERE id = ?`,
        )
        .run(
          dto.questionText,
          dto.questionType ?? 'single',
          JSON.stringify(dto.options),
          JSON.stringify(dto.correctAnswers),
          dto.explanation ?? null,
          dto.difficulty ?? 'Medium',
          JSON.stringify(dto.tags ?? []),
          dto.points ?? 1,
          dto.isActive !== false ? 1 : 0,
          now,
          id,
        );
    }
  }

  deleteQuestion(id: string): void {
    this.db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  }
}
