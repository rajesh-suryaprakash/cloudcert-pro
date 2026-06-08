import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('Migration v3 - Insight Dashboard Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
    runMigrations(db);
  });

  it('creates answer_change_history table with correct schema', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(answer_change_history)`).all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('examSessionId');
    expect(columnNames).toContain('questionId');
    expect(columnNames).toContain('previousAnswer');
    expect(columnNames).toContain('newAnswer');
    expect(columnNames).toContain('changeTimestamp');
    expect(columnNames).toContain('createdAt');
  });

  it('creates benchmark_users table with correct schema', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(benchmark_users)`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('userId');
    expect(columnNames).toContain('certificationId');
    expect(columnNames).toContain('passed');
    expect(columnNames).toContain('examDate');
    expect(columnNames).toContain('reportedAt');
  });

  it('creates domain_weights table with correct schema', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(domain_weights)`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('certificationId');
    expect(columnNames).toContain('domainName');
    expect(columnNames).toContain('weightPercentage');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('creates community_benchmark_cache table with correct schema', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(community_benchmark_cache)`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('certificationId');
    expect(columnNames).toContain('topicId');
    expect(columnNames).toContain('domainName');
    expect(columnNames).toContain('averageProficiency');
    expect(columnNames).toContain('sampleSize');
    expect(columnNames).toContain('lastUpdated');
  });

  it('creates dashboard_metrics_cache table with correct schema', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(dashboard_metrics_cache)`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('userId');
    expect(columnNames).toContain('certificationId');
    expect(columnNames).toContain('metricType');
    expect(columnNames).toContain('metricData');
    expect(columnNames).toContain('computedAt');
    expect(columnNames).toContain('expiresAt');
  });

  it('adds domainId column to questions table', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(questions)`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = tableInfo.map((col) => col.name);
    expect(columnNames).toContain('domainId');
  });

  it('creates indexes for answer_change_history', () => {
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='answer_change_history'`,
      )
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_answer_changes_session');
    expect(indexNames).toContain('idx_answer_changes_question');
  });

  it('creates indexes for benchmark_users', () => {
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='benchmark_users'`)
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_benchmark_users_cert');
  });

  it('creates indexes for domain_weights', () => {
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='domain_weights'`)
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_domain_weights_cert');
  });

  it('creates indexes for community_benchmark_cache', () => {
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='community_benchmark_cache'`,
      )
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_benchmark_cache_cert');
    expect(indexNames).toContain('idx_benchmark_cache_topic');
  });

  it('creates indexes for dashboard_metrics_cache', () => {
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='dashboard_metrics_cache'`,
      )
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_metrics_cache_lookup');
  });

  it('creates index for questions.domainId', () => {
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='questions'`)
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_questions_domainId');
  });
});
