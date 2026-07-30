import { describe, it, expect } from 'vitest';
import { questionRowsToQuestions, safeParseQuestionField } from './questionTransforms';
import type { QuestionRow } from '../db-types';

describe('questionTransforms', () => {
  describe('safeParseQuestionField', () => {
    it('returns fallback if value is null, undefined, or empty string', () => {
      expect(safeParseQuestionField(null, ['fallback'])).toEqual(['fallback']);
      expect(safeParseQuestionField(undefined, { a: 1 })).toEqual({ a: 1 });
      expect(safeParseQuestionField('', 42)).toEqual(42);
    });

    it('parses valid JSON successfully', () => {
      expect(safeParseQuestionField('["val1", "val2"]', [])).toEqual(['val1', 'val2']);
      expect(safeParseQuestionField('{"key": "value"}', {})).toEqual({ key: 'value' });
    });

    it('returns fallback if JSON parsing throws an error', () => {
      expect(safeParseQuestionField('invalid-json', ['fallback'])).toEqual(['fallback']);
    });
  });

  describe('questionRowsToQuestions', () => {
    const mockRow = (overrides: Partial<QuestionRow> = {}): QuestionRow => ({
      id: 'q-1',
      topicId: 'topic-1',
      subTopicId: 'subtopic-1',
      unitId: 'unit-1',
      questionText: 'Which GCP service is a NoSQL database?',
      questionType: 'single',
      options: JSON.stringify(['Bigtable', 'Cloud SQL', 'Spanner', 'Firestore']),
      correctAnswers: JSON.stringify('Bigtable'),
      explanation: 'Bigtable is the wide-column NoSQL service.',
      difficulty: 'Easy',
      tags: JSON.stringify(['nosql', 'storage']),
      points: 1,
      isActive: 1,
      createdAt: '2026-07-26T12:00:00Z',
      updatedAt: '2026-07-26T12:00:00Z',
      ...overrides,
    });

    it('transforms a database row with single correct answer correctly', () => {
      const rows = [mockRow()];
      const results = questionRowsToQuestions(rows);

      expect(results.length).toBe(1);
      const q = results[0];
      expect(q.id).toBe('q-1');
      expect(q.options).toEqual(['Bigtable', 'Cloud SQL', 'Spanner', 'Firestore']);
      expect(q.correctAnswers).toBe('Bigtable');
      expect(q.tags).toEqual(['nosql', 'storage']);
      expect(q.questionType).toBe('single');
      expect(q.difficulty).toBe('Easy');
      expect(q.isActive).toBe(true);
    });

    it('transforms a database row with multiple correct answers correctly', () => {
      const rows = [
        mockRow({
          id: 'q-2',
          questionType: 'multiple',
          correctAnswers: JSON.stringify(['Bigtable', 'Firestore']),
        }),
      ];
      const results = questionRowsToQuestions(rows);

      expect(results.length).toBe(1);
      const q = results[0];
      expect(q.id).toBe('q-2');
      expect(q.questionType).toBe('multiple');
      expect(q.correctAnswers).toEqual(['Bigtable', 'Firestore']);
    });

    it('handles falsy or default values for tags and isActive status', () => {
      const rows = [
        mockRow({
          tags: null as any,
          isActive: 0,
        }),
      ];
      const results = questionRowsToQuestions(rows);

      expect(results[0].tags).toEqual([]);
      expect(results[0].isActive).toBe(false);
    });

    it('handles undefined/missing isActive field gracefully by defaulting to true', () => {
      const row = mockRow();
      delete (row as any).isActive;
      const results = questionRowsToQuestions([row]);

      expect(results[0].isActive).toBe(true);
    });
  });
});
