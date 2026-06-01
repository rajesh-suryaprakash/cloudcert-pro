import type { Question } from '../types';
import type { DetailedResult } from '../server/services/ExamGradingService';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

/**
 * Validates the custom quiz form inputs.
 * Returns null when valid, or an error message string when invalid.
 */
export function validateCustomQuizForm(
  certificationId: string | null | undefined,
  count: unknown,
): string | null {
  if (!certificationId) {
    return 'Please select a certification.';
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 100) {
    return 'Question count must be a whole number between 1 and 100.';
  }
  return null;
}

/**
 * Selects questions for a custom quiz from a pool.
 * - Filters to active questions only.
 * - Shuffles the pool.
 * - Slices to `count` (or all available if pool < count).
 */
export function buildCustomQuizQuestions(pool: Question[], count: number): Question[] {
  const active = pool.filter((q) => q.isActive);
  const shuffled = [...active].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Filters a list of detailed exam results to only those that belong to the
 * specified topic and were answered incorrectly.
 *
 * Requirements: 1.2
 */
export function filterWrongAnswersByTopic(
  answers: DetailedResult[],
  topicId: string,
): DetailedResult[] {
  return answers.filter((a) => a.topicId === topicId && a.isCorrect === false);
}
