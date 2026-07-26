import Database from 'better-sqlite3';
import path from 'path';

// Allow the database path to be overridden via DB_PATH env var.
// Defaults to 'cloudcert.db' in the current working directory for local dev.
// In Docker, set DB_PATH=/app/data/cloudcert.db with a persistent volume.
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'cloudcert.db');

let instance: Database.Database | null = null;

function getDbInstance(): Database.Database {
  if (!instance) {
    instance = new Database(dbPath);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');
  }
  return instance;
}

// Proxied lazy database client to defer connection opening, avoid side-effects at load time,
// and enable dynamic connection swapping during integration/unit testing.
export const db = new Proxy(Object.create(Database.prototype) as Database.Database, {
  get(_target, prop, _receiver) {
    const dbInstance = getDbInstance();
    const value = Reflect.get(dbInstance, prop);
    if (typeof value === 'function') {
      return value.bind(dbInstance);
    }
    return value;
  },
  set(_target, prop, value, _receiver) {
    const dbInstance = getDbInstance();
    return Reflect.set(dbInstance, prop, value);
  },
});

/**
 * Closes the database connection cleanly if it was initialized.
 * Call this during graceful shutdown (SIGTERM / SIGINT) to flush WAL frames
 * and release the file lock before the process exits.
 */
export function closeDb(): void {
  if (instance && instance.open) {
    instance.close();
    instance = null;
  }
}

/**
 * Helper to dynamically override the database connection instance (e.g. for testing with an in-memory DB).
 */
export function overrideDb(newDb: Database.Database | null): void {
  instance = newDb;
}
