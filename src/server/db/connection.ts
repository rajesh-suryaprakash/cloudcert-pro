import Database from 'better-sqlite3';

// Single shared database connection instance
export const db = new Database('cloudcert.db');

// Enable WAL mode for better write concurrency
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints (disabled by default in SQLite)
db.pragma('foreign_keys = ON');
