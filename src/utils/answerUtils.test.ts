import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isAnswerCorrect } from './answerUtils';
import type { Question } from '../types';

// Minimal question factory — only the fields isAnswerCorrect cares about
function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    topicId: 't1',
    questionText: 'Sample question',
    questionType: 'single',
    options: ['A', 'B', 'C', 'D'],
    correctAnswers: 'A',
    difficulty: 'Easy',
    tags: [],
    points: 1,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/**
 * Feature: codebase-refactoring, Property 3: isAnswerCorrect returns a boolean for all inputs
 * Validates: Requirements 4.3
 */
describe('isAnswerCorrect', () => {
  it('Property 3: returns a boolean for all single-answer inputs', () => {
    // Arbitrary single-answer question: correctAnswers is one of the options
    const optionArb = fc.constantFrom('A', 'B', 'C', 'D');
    const userAnswerArb = fc.oneof(
      fc.constantFrom('A', 'B', 'C', 'D'),
      fc.string(),
      fc.constant(null),
      fc.constant(undefined),
    );

    fc.assert(
      fc.property(optionArb, userAnswerArb, (correct, userAnswer) => {
        const question = makeQuestion({ questionType: 'single', correctAnswers: correct });
        const result = isAnswerCorrect(question, userAnswer);

        // Must return a boolean
        expect(typeof result).toBe('boolean');

        // Must be true iff userAnswer exactly equals the correct answer
        expect(result).toBe(userAnswer === correct);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 3: returns a boolean for all multiple-answer inputs', () => {
    const allOptions = ['A', 'B', 'C', 'D'];

    // Generate a non-empty subset of options as the correct answers
    const correctArb = fc.subarray(allOptions, { minLength: 1 }).map((arr) => [...arr].sort());

    // Generate any subset (including empty) as the user's answer
    const userArb = fc.subarray(allOptions).map((arr) => [...arr].sort());

    fc.assert(
      fc.property(correctArb, userArb, (correct, userAnswer) => {
        const question = makeQuestion({ questionType: 'multiple', correctAnswers: correct });
        const result = isAnswerCorrect(question, userAnswer);

        // Must return a boolean
        expect(typeof result).toBe('boolean');

        // Must be true iff the sets are identical
        const expected =
          correct.length === userAnswer.length && correct.every((v) => userAnswer.includes(v));
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});
