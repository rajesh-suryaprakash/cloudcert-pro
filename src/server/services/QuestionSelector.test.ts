import { describe, it, expect } from 'vitest';
import { selectQuestions } from './QuestionSelector';
import type { QuestionRow } from '../db-types';

describe('QuestionSelector', () => {
  const createMockQuestion = (overrides: Partial<QuestionRow> = {}): QuestionRow => ({
    id: 'q-1',
    topicId: 'topic-1',
    subTopicId: 'subtopic-1',
    unitId: 'unit-1',
    questionText: 'Mock question text',
    questionType: 'single',
    options: '["A", "B", "C"]',
    correctAnswers: '"A"',
    explanation: 'Explanation',
    difficulty: 'Medium',
    tags: '[]',
    points: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const pool: QuestionRow[] = [
    createMockQuestion({ id: 'q-easy-1', difficulty: 'Easy', topicId: 'topic-A' }),
    createMockQuestion({ id: 'q-easy-2', difficulty: 'Easy', topicId: 'topic-A' }),
    createMockQuestion({ id: 'q-medium-1', difficulty: 'Medium', topicId: 'topic-A' }),
    createMockQuestion({ id: 'q-medium-2', difficulty: 'Medium', topicId: 'topic-B' }),
    createMockQuestion({ id: 'q-hard-1', difficulty: 'Hard', topicId: 'topic-B' }),
    createMockQuestion({ id: 'q-hard-2', difficulty: 'Hard', topicId: 'topic-B' }),
  ];

  describe('selectQuestions - random strategy', () => {
    it('selects correct count of questions randomly', () => {
      const selected = selectQuestions(pool, { strategy: 'random', totalQuestions: 3 });
      expect(selected.length).toBe(3);
      selected.forEach((q) => {
        expect(pool.find((p) => p.id === q.id)).toBeDefined();
      });
    });

    it('caps selection at pool size', () => {
      const selected = selectQuestions(pool, { strategy: 'random', totalQuestions: 10 });
      expect(selected.length).toBe(6);
    });

    it('prioritizes unseen questions over seen ones', () => {
      const seenIds = new Set(['q-easy-1', 'q-easy-2', 'q-medium-1']);
      const selected = selectQuestions(pool, {
        strategy: 'random',
        totalQuestions: 3,
        seenQuestionIds: seenIds,
      });

      // Since there are exactly 3 unseen questions (q-medium-2, q-hard-1, q-hard-2),
      // they must all be selected, and no seen questions should be selected.
      expect(selected.length).toBe(3);
      selected.forEach((q) => {
        expect(seenIds.has(q.id)).toBe(false);
      });
    });

    it('backfills with seen questions if unseen count is insufficient', () => {
      const seenIds = new Set(['q-easy-1', 'q-easy-2', 'q-medium-1', 'q-medium-2', 'q-hard-1']);
      const selected = selectQuestions(pool, {
        strategy: 'random',
        totalQuestions: 3,
        seenQuestionIds: seenIds,
      });

      // Unseen is only 1 question ('q-hard-2'). We need 3 total.
      // So 1 unseen + 2 seen must be returned.
      expect(selected.length).toBe(3);
      const unseenSelected = selected.filter((q) => !seenIds.has(q.id));
      expect(unseenSelected.length).toBe(1);
      expect(unseenSelected[0].id).toBe('q-hard-2');
    });
  });

  describe('selectQuestions - difficulty_balanced strategy', () => {
    it('distributes selected questions proportionally across difficulty tiers', () => {
      // 2 Easy, 2 Medium, 2 Hard.
      // Requesting 3 questions should allocate exactly 1 from each tier.
      const selected = selectQuestions(pool, {
        strategy: 'difficulty_balanced',
        totalQuestions: 3,
      });
      expect(selected.length).toBe(3);

      const easy = selected.filter((q) => q.difficulty === 'Easy');
      const medium = selected.filter((q) => q.difficulty === 'Medium');
      const hard = selected.filter((q) => q.difficulty === 'Hard');

      expect(easy.length).toBe(1);
      expect(medium.length).toBe(1);
      expect(hard.length).toBe(1);
    });

    it('handles empty pool gracefully', () => {
      const selected = selectQuestions([], { strategy: 'difficulty_balanced', totalQuestions: 3 });
      expect(selected).toEqual([]);
    });
  });

  describe('selectQuestions - topic_based strategy', () => {
    it('allocates slots proportionally based on topic weights', () => {
      // pool: 3 topic-A, 3 topic-B.
      // weights: topic-A = 2, topic-B = 1.
      // Requesting 3 questions should allocate 2 from topic-A and 1 from topic-B.
      const weights = { 'topic-A': 2, 'topic-B': 1 };
      const selected = selectQuestions(pool, {
        strategy: 'topic_based',
        totalQuestions: 3,
        topicWeights: weights,
      });

      expect(selected.length).toBe(3);
      const topicA = selected.filter((q) => q.topicId === 'topic-A');
      const topicB = selected.filter((q) => q.topicId === 'topic-B');

      expect(topicA.length).toBe(2);
      expect(topicB.length).toBe(1);
    });

    it('caps allocation at available count and redistributes leftover slots', () => {
      // pool: 3 topic-A, 3 topic-B.
      // weights: topic-A = 5, topic-B = 1.
      // Total request: 5 questions.
      // Proportional allocation would ask for 4.16 topic-A and 0.83 topic-B,
      // floors to 4 topic-A and 0 topic-B.
      // But topic-A only has 3 available, so it caps at 3, and redistributes 2 slots to topic-B.
      const weights = { 'topic-A': 5, 'topic-B': 1 };
      const selected = selectQuestions(pool, {
        strategy: 'topic_based',
        totalQuestions: 5,
        topicWeights: weights,
      });

      expect(selected.length).toBe(5);
      const topicA = selected.filter((q) => q.topicId === 'topic-A');
      const topicB = selected.filter((q) => q.topicId === 'topic-B');

      expect(topicA.length).toBe(3);
      expect(topicB.length).toBe(2);
    });

    it('falls back to random selection if weights are empty or zero', () => {
      const selected = selectQuestions(pool, {
        strategy: 'topic_based',
        totalQuestions: 2,
        topicWeights: {},
      });
      expect(selected.length).toBe(2);
    });
  });
});
