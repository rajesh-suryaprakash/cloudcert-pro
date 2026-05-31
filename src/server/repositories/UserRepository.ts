import type { Database } from 'better-sqlite3';
import type { UserRow } from '../db-types';

export interface CreateUserDto {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  createdAt: number;
  updatedAt: number;
}

export class UserRepository {
  constructor(private readonly db: Database) {}

  findByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  }

  findById(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  create(dto: CreateUserDto): void {
    this.db
      .prepare(
        'INSERT INTO users (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(dto.id, dto.email, dto.password, dto.name, dto.role, dto.createdAt, dto.updatedAt);
  }

  updatePassword(id: string, hashedPassword: string): void {
    this.db
      .prepare(
        'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpire = NULL WHERE id = ?',
      )
      .run(hashedPassword, id);
  }

  updateXp(id: string, xpToAdd: number): void {
    this.db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(xpToAdd, id);
  }

  setResetToken(id: string, token: string, expireMs: number): void {
    this.db
      .prepare('UPDATE users SET resetPasswordToken = ?, resetPasswordExpire = ? WHERE id = ?')
      .run(token, expireMs, id);
  }

  findByResetToken(
    email: string,
    now: number,
  ): Pick<UserRow, 'id' | 'resetPasswordToken'> | undefined {
    return this.db
      .prepare(
        'SELECT id, resetPasswordToken FROM users WHERE email = ? AND resetPasswordExpire > ?',
      )
      .get(email, now) as Pick<UserRow, 'id' | 'resetPasswordToken'> | undefined;
  }

  clearResetToken(userId: string): void {
    this.db
      .prepare(
        'UPDATE users SET resetPasswordToken = NULL, resetPasswordExpire = NULL WHERE id = ?',
      )
      .run(userId);
  }
}
