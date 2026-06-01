import type { Question } from '../types';

/**
 * Determines whether a user's answer is correct for a given question.
 * Handles both single-answer and multiple-answer question types.
 */
export function isAnswerCorrect(question: Question, userAnswer: unknown): boolean {
  if (question.questionType === 'multiple') {
    const correct = question.correctAnswers as string[];
    const given = (userAnswer as string[]) ?? [];
    return correct.length === given.length && correct.every((val) => given.includes(val));
  }
  // correctAnswers from the API is always an array (e.g. ["Compute Engine"])
  const correct = question.correctAnswers;
  const expected = Array.isArray(correct) ? correct[0] : correct;
  return userAnswer === expected;
}
