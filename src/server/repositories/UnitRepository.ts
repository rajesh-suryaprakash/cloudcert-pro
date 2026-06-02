import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import type { UnitRow, CreateUnitDto } from '../db-types';
import { nowIso } from '../utils/time';

export class UnitRepository {
  constructor(private readonly db: Database) {}

  findUnitsBySubTopic(subTopicId: string): UnitRow[] {
    return this.db
      .prepare(
        `SELECT id, subTopicId, title, description, orderIndex, isActive, createdAt, updatedAt
         FROM units
         WHERE subTopicId = ?
         ORDER BY orderIndex ASC`,
      )
      .all(subTopicId) as UnitRow[];
  }

  findUnitById(id: string): UnitRow | undefined {
    return this.db
      .prepare(
        `SELECT id, subTopicId, title, description, orderIndex, isActive, createdAt, updatedAt
         FROM units
         WHERE id = ?`,
      )
      .get(id) as UnitRow | undefined;
  }

  createUnit(dto: CreateUnitDto): string {
    const id = crypto.randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO units (id, subTopicId, title, description, orderIndex, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dto.subTopicId,
        dto.title,
        dto.description ?? null,
        dto.orderIndex ?? 0,
        dto.isActive !== false ? 1 : 0,
        now,
        now,
      );
    return id;
  }

  updateUnit(id: string, dto: Partial<CreateUnitDto>, current: UnitRow): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE units
         SET title = ?, description = ?, orderIndex = ?, isActive = ?, updatedAt = ?
         WHERE id = ?`,
      )
      .run(
        dto.title ?? current.title,
        dto.description !== undefined ? (dto.description ?? null) : current.description,
        dto.orderIndex !== undefined ? dto.orderIndex : current.orderIndex,
        dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : current.isActive,
        now,
        id,
      );
  }

  deleteUnit(id: string): void {
    this.db.prepare('DELETE FROM units WHERE id = ?').run(id);
  }

  countUnitsBySubTopic(subTopicId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM units WHERE subTopicId = ?')
      .get(subTopicId) as { count: number };
    return row.count;
  }

  countQuestionsByUnit(unitId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM questions WHERE unitId = ?')
      .get(unitId) as { count: number };
    return row.count;
  }
}
