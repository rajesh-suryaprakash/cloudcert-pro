import type { Database } from 'better-sqlite3';
import type { ExamConfigRow, ExamSessionRow } from '../db-types';
import { config } from '../config';

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

  findByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): (ExamSessionRow & {
    passingScore: number;
    examName: string | null;
    resolvedCertId: string | null;
  })[] {
    let query = `SELECT s.*,
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
         WHERE s.userId = ? AND (s.status = 'completed' OR s.status = 'in_progress' OR s.status = 'paused' OR s.score IS NOT NULL)
         ORDER BY s.createdAt DESC`;

    const args: (string | number)[] = [userId];
    const safeLimit = Math.min(limit ?? 50, 100);
    query += ' LIMIT ?';
    args.push(safeLimit);
    if (offset !== undefined && offset !== null) {
      query += ' OFFSET ?';
      args.push(offset);
    }

    return this.db.prepare(query).all(...args) as (ExamSessionRow & {
      passingScore: number;
      examName: string | null;
      resolvedCertId: string | null;
    })[];
  }

  countByUser(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM exam_sessions
         WHERE userId = ? AND (status = 'completed' OR status = 'in_progress' OR status = 'paused' OR score IS NOT NULL)`,
      )
      .get(userId) as { count: number };
    return row.count;
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

  /**
   * Pause an active session.
   *
   * Records `pausedAt` to the current timestamp and sets status to 'paused'.
   * A session can only be paused when it is currently `in_progress`.
   *
   * Enforced limits (exam integrity):
   *   - MAX_PAUSE_COUNT: 3 pauses per session lifetime.
   *   - MAX_TOTAL_PAUSE_MS: 30 minutes cumulative pause time per session.
   *
   * Returns `{ ok: true }` on success or `{ ok: false, reason }` when a limit
   * is exceeded, so the route layer can respond with HTTP 403 and a user-facing
   * message without throwing.
   */
  pause(id: string): { ok: true } | { ok: false; reason: string } {
    // Fetch current pause state before updating
    const row = this.db
      .prepare(
        `SELECT pauseCount, accumulatedPausedMs, status
         FROM exam_sessions WHERE id = ?`,
      )
      .get(id) as
      | { pauseCount: number | null; accumulatedPausedMs: number | null; status: string }
      | undefined;

    if (!row || row.status !== 'in_progress') {
      return { ok: false, reason: 'Session is not in progress' };
    }

    const MAX_PAUSE_COUNT = config.maxPauseCount;
    const MAX_TOTAL_PAUSE_MS = config.maxTotalPauseMs;

    const currentCount = row.pauseCount ?? 0;
    const currentAccumulated = row.accumulatedPausedMs ?? 0;

    if (currentCount >= MAX_PAUSE_COUNT) {
      return {
        ok: false,
        reason: `Maximum pause limit reached (${MAX_PAUSE_COUNT} pauses allowed per session)`,
      };
    }

    if (currentAccumulated >= MAX_TOTAL_PAUSE_MS) {
      return {
        ok: false,
        reason: `Maximum cumulative pause time reached (${MAX_TOTAL_PAUSE_MS / 60000} minutes allowed per session)`,
      };
    }

    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `UPDATE exam_sessions
         SET status = 'paused',
             pausedAt = ?,
             pauseCount = COALESCE(pauseCount, 0) + 1,
             updatedAt = ?
         WHERE id = ? AND status = 'in_progress'`,
      )
      .run(now, now, id);

    if (result.changes === 0) {
      return { ok: false, reason: 'Session is not in progress' };
    }

    return { ok: true };
  }

  /**
   * Resume a paused session.
   *
   * Computes how long this pause lasted, adds it to `accumulatedPausedMs`, clears
   * `pausedAt`, shifts `autoSubmitAt` forward by the pause duration so the exam
   * deadline reflects only active (non-paused) time, and resets status to 'in_progress'.
   *
   * Returns the new `autoSubmitAt` and the computed `timeLeftSeconds` so the client
   * can sync its countdown timer without a separate round-trip.
   *
   * NOTE: Currently, there is no enforcement of maximum pause duration or pause count.
   * A user could potentially pause an exam indefinitely and resume it much later.
   * Future implementation could add limits here or auto-abandon sessions after a threshold.
   */
  resume(id: string): { autoSubmitAt: string; timeLeftSeconds: number } | null {
    const now = Date.now();
    const row = this.db
      .prepare(
        `SELECT pausedAt, autoSubmitAt, accumulatedPausedMs FROM exam_sessions
         WHERE id = ? AND status = 'paused'`,
      )
      .get(id) as
      | Pick<
          ExamSessionRow,
          'pausedAt' | 'autoSubmitAt' | 'accumulatedPausedMs'
        >
      | undefined;

    if (!row || !row.pausedAt) return null;

    const pausedAtMs = new Date(row.pausedAt).getTime();
    const thisPauseDurationMs = now - pausedAtMs;
    const newAccumulated = (row.accumulatedPausedMs ?? 0) + thisPauseDurationMs;

    // Shift the deadline forward by exactly how long this pause lasted
    const currentDeadlineMs = new Date(row.autoSubmitAt).getTime();
    const newDeadlineMs = currentDeadlineMs + thisPauseDurationMs;
    const newAutoSubmitAt = new Date(newDeadlineMs).toISOString();
    const nowIsoStr = new Date(now).toISOString();

    this.db
      .prepare(
        `UPDATE exam_sessions
         SET status = 'in_progress',
             pausedAt = NULL,
             accumulatedPausedMs = ?,
             autoSubmitAt = ?,
             updatedAt = ?
         WHERE id = ?`,
      )
      .run(newAccumulated, newAutoSubmitAt, nowIsoStr, id);

    const timeLeftSeconds = Math.max(0, Math.floor((newDeadlineMs - now) / 1000));
    return { autoSubmitAt: newAutoSubmitAt, timeLeftSeconds };
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
