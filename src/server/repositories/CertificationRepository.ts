import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import type { ExamConfigRow } from '../db-types';
import { nowMs, nowIso } from '../utils/time';

export interface CertificationRow {
  id: string;
  title: string;
  vendor: string;
  description: string;
  level: string;
  examCode: string | null;
  url: string | null;
  iconUrl: string | null;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

export interface TopicRow {
  id: string;
  certificationId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: number;
  docUrl: string | null;
  createdAt: string;
  updatedAt: string;
  // New fields for unified domain weight management
  weightPercentage: number | null;
}

export interface SubTopicRow {
  id: string;
  topicId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCertificationDto {
  title: string;
  vendor: string;
  description: string;
  level: string;
  examCode?: string;
  url?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export interface CreateTopicDto {
  certificationId: string;
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
  docUrl?: string | null;
  // New fields for unified domain weight management
  weightPercentage?: number;
}

export interface CreateSubTopicDto {
  topicId: string;
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export class CertificationRepository {
  constructor(private readonly db: Database) {}

  // ── Certifications ──────────────────────────────────────────────────────────

  findAll(): CertificationRow[] {
    return this.db.prepare('SELECT * FROM certifications').all() as CertificationRow[];
  }

  findByTitleAndLevel(
    title: string,
    level: string,
    excludeId?: string,
  ): CertificationRow | undefined {
    if (excludeId) {
      return this.db
        .prepare('SELECT * FROM certifications WHERE title = ? AND level = ? AND id != ?')
        .get(title, level, excludeId) as CertificationRow | undefined;
    }
    return this.db
      .prepare('SELECT * FROM certifications WHERE title = ? AND level = ?')
      .get(title, level) as CertificationRow | undefined;
  }

  create(dto: CreateCertificationDto): string {
    const id = crypto.randomUUID();
    const now = nowMs();
    this.db
      .prepare(
        `INSERT INTO certifications (id, title, vendor, description, level, examCode, url, iconUrl, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.title,
        dto.vendor,
        dto.description,
        dto.level,
        dto.examCode ?? null,
        dto.url ?? null,
        dto.iconUrl ?? null,
        dto.isActive !== false ? 1 : 0,
        now,
        now,
      );
    return id;
  }

  update(id: string, dto: Partial<CreateCertificationDto>): void {
    const now = nowMs();
    this.db
      .prepare(
        `UPDATE certifications
         SET title = ?, vendor = ?, description = ?, level = ?, examCode = ?, url = ?, iconUrl = ?, isActive = ?, updatedAt = ?
         WHERE id = ?`,
      )
      .run(
        dto.title,
        dto.vendor,
        dto.description,
        dto.level,
        dto.examCode ?? null,
        dto.url ?? null,
        dto.iconUrl ?? null,
        dto.isActive !== false ? 1 : 0,
        now,
        id,
      );
  }

  deactivateTopics(certificationId: string): void {
    this.db
      .prepare('UPDATE topics SET isActive = 0 WHERE certificationId = ?')
      .run(certificationId);
  }

  countActiveSessions(certificationId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM exam_sessions
         WHERE examConfigurationId IN (SELECT id FROM exam_configurations WHERE certificationId = ?)`,
      )
      .get(certificationId) as { count: number };
    return row.count;
  }

  // ── Child-count helpers for safe-delete guards ────────────────────────────

  countExamsByCertification(certificationId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM exam_configurations WHERE certificationId = ?')
      .get(certificationId) as { count: number };
    return row.count;
  }

  countTopicsByCertification(certificationId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM topics WHERE certificationId = ?')
      .get(certificationId) as { count: number };
    return row.count;
  }

  countSubTopicsByTopic(topicId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM subtopics WHERE topicId = ?')
      .get(topicId) as { count: number };
    return row.count;
  }

  countQuestionsByTopic(topicId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM questions WHERE topicId = ?')
      .get(topicId) as { count: number };
    return row.count;
  }

  countQuestionsBySubTopic(subTopicId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM questions WHERE subTopicId = ?')
      .get(subTopicId) as { count: number };
    return row.count;
  }

  countSessionsByExamConfig(examConfigId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM exam_sessions WHERE examConfigurationId = ?`)
      .get(examConfigId) as { count: number };
    return row.count;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM certifications WHERE id = ?').run(id);
  }

  // ── Topics ──────────────────────────────────────────────────────────────────

  findTopicsByCertification(certificationId: string): TopicRow[] {
    return this.db
      .prepare('SELECT * FROM topics WHERE certificationId = ? ORDER BY orderIndex ASC')
      .all(certificationId) as TopicRow[];
  }

  findTopicById(id: string): TopicRow | undefined {
    return this.db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as TopicRow | undefined;
  }

  createTopic(dto: CreateTopicDto): string {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO topics (id, certificationId, title, description, orderIndex, isActive, docUrl, weightPercentage, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.certificationId,
        dto.title,
        dto.description ?? null,
        dto.orderIndex ?? 0,
        dto.isActive !== false ? 1 : 0,
        dto.docUrl ?? null,
        dto.weightPercentage ?? null,
        now,
        now,
      );
    return id;
  }

  updateTopic(id: string, dto: Partial<CreateTopicDto>, current: TopicRow): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE topics SET title = ?, description = ?, orderIndex = ?, isActive = ?, docUrl = ?, weightPercentage = ?, updatedAt = ? WHERE id = ?`,
      )
      .run(
        dto.title ?? current.title,
        dto.description !== undefined ? dto.description : current.description,
        dto.orderIndex !== undefined ? dto.orderIndex : current.orderIndex,
        dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : current.isActive,
        dto.docUrl !== undefined ? dto.docUrl : current.docUrl,
        dto.weightPercentage !== undefined ? dto.weightPercentage : current.weightPercentage,
        now,
        id,
      );
  }

  deleteTopic(id: string): void {
    this.db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  }

  // ── SubTopics ────────────────────────────────────────────────────────────────

  findSubTopicsByTopic(topicId: string): SubTopicRow[] {
    return this.db
      .prepare('SELECT * FROM subtopics WHERE topicId = ? ORDER BY orderIndex ASC')
      .all(topicId) as SubTopicRow[];
  }

  findSubTopicById(id: string): SubTopicRow | undefined {
    return this.db.prepare('SELECT * FROM subtopics WHERE id = ?').get(id) as
      | SubTopicRow
      | undefined;
  }

  createSubTopic(dto: CreateSubTopicDto): string {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO subtopics (id, topicId, title, description, orderIndex, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.topicId,
        dto.title,
        dto.description ?? null,
        dto.orderIndex ?? 0,
        dto.isActive !== false ? 1 : 0,
        now,
        now,
      );
    return id;
  }

  updateSubTopic(id: string, dto: Partial<CreateSubTopicDto>, current: SubTopicRow): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE subtopics SET title = ?, description = ?, orderIndex = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      )
      .run(
        dto.title ?? current.title,
        dto.description !== undefined ? dto.description : current.description,
        dto.orderIndex !== undefined ? dto.orderIndex : current.orderIndex,
        dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : current.isActive,
        now,
        id,
      );
  }

  deleteSubTopic(id: string): void {
    this.db.prepare('DELETE FROM subtopics WHERE id = ?').run(id);
  }

  // ── Exam Configurations ──────────────────────────────────────────────────────

  findExamById(id: string): ExamConfigRow | undefined {
    return this.db.prepare('SELECT * FROM exam_configurations WHERE id = ?').get(id) as
      | ExamConfigRow
      | undefined;
  }

  deleteExamConfig(id: string): void {
    this.db.prepare('DELETE FROM exam_configurations WHERE id = ?').run(id);
  }

  findExamsByCertification(certificationId: string): ExamConfigRow[] {
    return this.db
      .prepare('SELECT * FROM exam_configurations WHERE certificationId = ?')
      .all(certificationId) as ExamConfigRow[];
  }

  findActiveExamsByCertification(certificationId: string): ExamConfigRow[] {
    return this.db
      .prepare('SELECT * FROM exam_configurations WHERE certificationId = ? AND isActive = 1')
      .all(certificationId) as ExamConfigRow[];
  }

  updateExamConfig(
    id: string,
    dto: {
      name: string;
      description?: string;
      duration: number;
      totalQuestions: number;
      passingScore: number;
      questionSelectionStrategy?: string;
      topicWeights?: Record<string, number>;
      isActive?: boolean;
    },
  ): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE exam_configurations
         SET name = ?, description = ?, duration = ?, totalQuestions = ?, passingScore = ?,
             questionSelectionStrategy = ?, topicWeights = ?, isActive = ?, updatedAt = ?
         WHERE id = ?`,
      )
      .run(
        dto.name,
        dto.description ?? null,
        dto.duration,
        dto.totalQuestions,
        dto.passingScore,
        dto.questionSelectionStrategy ?? 'random',
        JSON.stringify(dto.topicWeights ?? {}),
        dto.isActive !== false ? 1 : 0,
        now,
        id,
      );
  }

  createExamConfig(
    certificationId: string,
    dto: {
      name: string;
      description?: string;
      duration: number;
      totalQuestions: number;
      passingScore: number;
      questionSelectionStrategy?: string;
      topicWeights?: Record<string, number>;
      isActive?: boolean;
    },
  ): string {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO exam_configurations
           (id, certificationId, name, description, duration, totalQuestions, passingScore, questionSelectionStrategy, topicWeights, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        certificationId,
        dto.name,
        dto.description ?? null,
        dto.duration,
        dto.totalQuestions,
        dto.passingScore,
        dto.questionSelectionStrategy ?? 'random',
        JSON.stringify(dto.topicWeights ?? {}),
        dto.isActive !== false ? 1 : 0,
        now,
        now,
      );
    return id;
  }
}
