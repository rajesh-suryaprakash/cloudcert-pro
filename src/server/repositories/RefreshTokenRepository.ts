import type { Database } from 'better-sqlite3';
import crypto from 'crypto';

export interface RefreshTokenRow {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export class RefreshTokenRepository {
  constructor(private readonly db: Database) {}

  create(userId: string, token: string, expiresAt: number): void {
    const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    const createdAt = Date.now();
    this.db
      .prepare(
        'INSERT INTO refresh_tokens (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, userId, token, expiresAt, createdAt);
  }

  findByToken(token: string): RefreshTokenRow | undefined {
    return this.db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token) as
      | RefreshTokenRow
      | undefined;
  }

  deleteByToken(token: string): void {
    this.db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
  }

  deleteAllForUser(userId: string): void {
    this.db.prepare('DELETE FROM refresh_tokens WHERE userId = ?').run(userId);
  }
}
