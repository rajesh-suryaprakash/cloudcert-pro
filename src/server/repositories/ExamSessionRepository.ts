import type { Database } from 'better-sqlite3';
import type { ExamConfigRow, ExamSessionRow } from '../db-types';

export interface CreateSessionDto {
  id: string;
  userId: string;
  examConfigurationId: string | null;
  certificationId?: string | null;
  sessionName?: string | null;
  questions: string;
  totalQuestions: number;
  isPracticeMode: number;
  isCustomQuiz?: number;
  autoSubmitAt: string;
  startTime: string;
  /** Wizard-supplied passing score override. NULL means use the exam config default. */
  passingScoreOverride?: number | null;
}

export interface SessionResult {
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  endTime: string;
  timeTaken: number;
}

export class ExamSessionRepository {
  constructor(private readonly db: Database) {}

  findById(id: string, userId: string): ExamSessionRow | undefined {
    return this.db
      .prepare('SELECT * FROM exam_sessions WHERE id = ? AND userId = ?')
      .get(id, userId) as ExamSessionRow | undefined;
  }

  findByUser(userId: string): (ExamSessionRow & {
    passingScore: number;
    examName: string | null;
    resolvedCertId: string | null;
  })[] {
    return this.db
      .prepare(
        `SELECT s.*,
                -- Effective passing score: wizard override takes priority over exam config
                COALESCE(s.passingScoreOverride, ec.passingScore, 0) AS passingScore,
                COALESCE(s.certificationId, ec.certificationId) AS resolvedCertId,
                CASE
                  WHEN s.sessionName IS NOT NULL THEN s.sessionName
                  WHEN s.isCustomQuiz = 1 THEN 'Custom Quiz'
                  WHEN s.topicId IS NOT NULL THEN COALESCE(t.title || ' — Topic Practice', 'Topic Practice')
                  WHEN s.certificationId IS NOT NULL AND s.examConfigurationId IS NULL AND s.isPracticeMode = 1 THEN 'Topic Practice'
                  WHEN ec.name IS NOT NULL AND s.isPracticeMode = 1 THEN ec.name || ' (Practice)'
                  WHEN ec.name IS NOT NULL THEN ec.name
                  ELSE 'Exam Attempt'
                END AS examName
         FROM exam_sessions s
         LEFT JOIN exam_configurations ec ON ec.id = s.examConfigurationId
         LEFT JOIN topics t ON t.id = s.topicId
         WHERE s.userId = ? AND (s.status = 'completed' OR s.score IS NOT NULL)
         ORDER BY s.createdAt DESC`,
      )
      .all(userId) as (ExamSessionRow & {
      passingScore: number;
      examName: string | null;
      resolvedCertId: string | null;
    })[];
  }

  create(dto: CreateSessionDto): void {
    this.db
      .prepare(
        `INSERT INTO exam_sessions (id, userId, examConfigurationId, certificationId, sessionName, questions, status, totalQuestions, isPracticeMode, isCustomQuiz, autoSubmitAt, startTime, passingScoreOverride, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        dto.id,
        dto.userId,
        dto.examConfigurationId,
        dto.certificationId ?? null,
        dto.sessionName ?? null,
        dto.questions,
        dto.totalQuestions,
        dto.isPracticeMode,
        dto.isCustomQuiz ?? 0,
        dto.autoSubmitAt,
        dto.startTime,
        dto.passingScoreOverride ?? null,
        dto.startTime,
        dto.startTime,
      );
  }

  findConfigDuration(configId: string): number | null {
    const row = this.db
      .prepare('SELECT duration FROM exam_configurations WHERE id = ?')
      .get(configId) as Pick<ExamConfigRow, 'duration'> | undefined;
    return row?.duration ?? null;
  }

  findConfigPassingScore(configId: string): number | null {
    const row = this.db
      .prepare('SELECT passingScore FROM exam_configurations WHERE id = ?')
      .get(configId) as Pick<ExamConfigRow, 'passingScore'> | undefined;
    return row?.passingScore ?? null;
  }

  findConfig(configId: string): ExamConfigRow | undefined {
    return this.db.prepare('SELECT * FROM exam_configurations WHERE id = ?').get(configId) as
      | ExamConfigRow
      | undefined;
  }

  findCompletedScoresByConfig(configId: string, excludeSessionId: string): number[] {
    const rows = this.db
      .prepare(
        `SELECT score FROM exam_sessions
         WHERE examConfigurationId = ? AND status = 'completed' AND id != ?`,
      )
      .all(configId, excludeSessionId) as Pick<ExamSessionRow, 'score'>[];
    return rows.map((r) => r.score as number);
  }

  abandon(id: string): void {
    this.db
      .prepare(`UPDATE exam_sessions SET status = 'abandoned', updatedAt = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }

  complete(id: string, result: SessionResult): void {
    this.db
      .prepare(
        `
      UPDATE exam_sessions SET
        status = 'completed',
        score = ?,
        correctAnswers = ?,
        incorrectAnswers = ?,
        unansweredQuestions = ?,
        endTime = ?,
        timeTaken = ?,
        updatedAt = ?
      WHERE id = ?
    `,
      )
      .run(
        result.score,
        result.correctAnswers,
        result.incorrectAnswers,
        result.unansweredQuestions,
        result.endTime,
        result.timeTaken,
        result.endTime,
        id,
      );
  }
}
