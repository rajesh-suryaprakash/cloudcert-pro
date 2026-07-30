import { describe, it, expect } from 'vitest';
import { shuffleQuestion, shuffleQuestions, analyzeShuffleDistribution } from './questionShuffle';
import type { Question } from '../../types';

describe('questionShuffle', () => {
  const createMockQuestion = (overrides: Partial<Question> = {}): Question => ({
    id: 'q-shuffle-1',
    certificationId: 'cert-1',
    topicId: 'topic-1',
    subtopicId: 'subtopic-1',
    unitId: 'unit-1',
    questionText: 'Which GCP compute service is serverless?',
    questionType: 'single',
    options: ['Compute Engine', 'Cloud Run', 'GKE', 'Bare Metal'],
    correctAnswers: JSON.stringify('Cloud Run'),
    explanation: 'Cloud Run is serverless container execution.',
    difficulty: 'Easy',
    tags: ['serverless', 'compute'],
    points: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  describe('shuffleQuestion', () => {
    it('returns a shuffled version of a single-answer question and remaps correctAnswers', () => {
      const q = createMockQuestion();
      const result = shuffleQuestion(q);

      expect(result.wasShuffled).toBe(true);
      expect(result.question.id).toBe(q.id);
      expect(result.question.options.length).toBe(q.options.length);
      // The options should contain the same set of items
      expect(result.question.options.sort()).toEqual([...q.options].sort());
      // The remapped correct answer must align with the new option position
      const newCorrectIndex = result.question.options.indexOf(result.question.correctAnswers as string);
      expect(newCorrectIndex).toBeGreaterThanOrEqual(0);
    });

    it('returns a shuffled version of a multiple-answer question and remaps correctAnswers array', () => {
      const q = createMockQuestion({
        questionType: 'multiple',
        options: ['Compute Engine', 'Cloud Run', 'GKE', 'App Engine'],
        correctAnswers: ['Cloud Run', 'App Engine'],
      });
      const result = shuffleQuestion(q);

      expect(result.wasShuffled).toBe(true);
      expect(result.question.options.sort()).toEqual([...q.options].sort());
      
      const newAnswers = result.question.correctAnswers as string[];
      expect(newAnswers.length).toBe(2);
      newAnswers.forEach((ans) => {
        expect(result.question.options.indexOf(ans)).toBeGreaterThanOrEqual(0);
      });
    });

    it('keeps "All of the above" and other fixed position options at the end', () => {
      const q = createMockQuestion({
        options: ['Compute Engine', 'Cloud Run', 'GKE', 'All of the above'],
        correctAnswers: JSON.stringify('All of the above'),
      });
      const result = shuffleQuestion(q);

      // The last option should still be "All of the above"
      expect(result.question.options[result.question.options.length - 1]).toBe('All of the above');
    });

    it('does not mutate the input question object', () => {
      const q = createMockQuestion();
      const originalOptions = [...q.options];
      const result = shuffleQuestion(q);

      expect(q.options).toEqual(originalOptions);
      expect(result.question).not.toBe(q);
    });

    it('allows bypassing shuffle if config.enabled is false', () => {
      const q = createMockQuestion();
      const result = shuffleQuestion(q, { enabled: false });

      expect(result.wasShuffled).toBe(false);
      expect(result.question.options).toEqual(q.options);
      expect(result.question.correctAnswers).toEqual(q.correctAnswers);
    });
  });

  describe('shuffleQuestions', () => {
    it('shuffles a list of questions in bulk', () => {
      const questions = [
        createMockQuestion({ id: 'q-1' }),
        createMockQuestion({ id: 'q-2' }),
      ];
      const shuffled = shuffleQuestions(questions);
      expect(shuffled.length).toBe(2);
      expect(shuffled[0].id).toBe('q-1');
      expect(shuffled[1].id).toBe('q-2');
    });
  });

  describe('analyzeShuffleDistribution', () => {
    it('runs statistical analysis on an array of questions', () => {
      const q = createMockQuestion();
      const stats = analyzeShuffleDistribution([q]);
      expect(stats.totalQuestions).toBe(1);
      expect(stats.wasShufflingEnabled).toBe(true);
      expect(stats.indexDistribution).toBeDefined();
    });
  });
});
