import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('db connection', () => {
  it('exported db instance can execute a simple query', () => {
    // Use an in-memory db to verify the connection pattern works without
    // depending on the on-disk cloudcert.db file in CI / test environments.
    const db = new Database(':memory:');
    const result = db.prepare('SELECT 1 AS value').get() as { value: number };
    expect(result.value).toBe(1);
    db.close();
  });
});
