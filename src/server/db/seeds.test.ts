import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Inject an in-memory db before seeds.ts loads its module-level db.
const memDb = new Database(':memory:');

vi.mock('./connection', () => ({ db: memDb }));

// Create the users table so seedAdmin can insert into it
memDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT,
    xp INTEGER DEFAULT 0,
    resetPasswordToken TEXT,
    resetPasswordExpire INTEGER,
    createdAt INTEGER,
    updatedAt INTEGER
  )
`);

describe('seedAdmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    memDb.exec('DELETE FROM users');
    // Reset environment variables
    process.env = { ...originalEnv };
    process.env.SEED_ADMIN_EMAIL = 'test-admin@example.com';
    process.env.SEED_ADMIN_PASSWORD = 'TestPassword123!';
    // Clear module cache to ensure fresh import with new env vars
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('inserts the admin user row when no admin exists', async () => {
    const { seedAdmin } = await import('./seeds');
    seedAdmin();

    const row = memDb
      .prepare('SELECT * FROM users WHERE email = ?')
      .get('test-admin@example.com') as { email: string; name: string; role: string } | undefined;

    expect(row).toBeDefined();

    expect(row!.email).toBe('test-admin@example.com');

    expect(row!.name).toBe('Admin User');

    expect(row!.role).toBe('admin');
  });

  it('does not insert a duplicate row when admin already exists', async () => {
    const { seedAdmin } = await import('./seeds');
    seedAdmin();
    seedAdmin(); // second call should be a no-op

    const rows = memDb
      .prepare('SELECT * FROM users WHERE email = ?')
      .all('test-admin@example.com') as unknown[];

    expect(rows).toHaveLength(1);
  });

  it('throws error when SEED_ADMIN_EMAIL is not set', async () => {
    delete process.env.SEED_ADMIN_EMAIL;
    const { seedAdmin } = await import('./seeds');

    expect(() => seedAdmin()).toThrow(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required',
    );
  });

  it('throws error when SEED_ADMIN_PASSWORD is not set', async () => {
    delete process.env.SEED_ADMIN_PASSWORD;
    const { seedAdmin } = await import('./seeds');

    expect(() => seedAdmin()).toThrow(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required',
    );
  });
});
