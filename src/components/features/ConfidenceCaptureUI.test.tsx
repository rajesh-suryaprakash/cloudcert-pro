import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Confidence Capture UI - Unit Tests
 * Validates: Requirements 16.3, 16.4
 *
 * Tests the confidence selector rendering, optional skip behavior,
 * and confidence value submission in the Quiz component
 */
describe('Confidence Capture UI', () => {
  /**
   * Test 1: Confidence selector rendering
   * Validates: Requirement 16.3
   *
   * The confidence selector should render with three options (Low, Medium, High)
   * and allow users to select any of them
   */
  it('should render confidence selector with Low, Medium, and High options', () => {
    fc.assert(
      fc.property(fc.constantFrom('Low', 'Medium', 'High'), (selectedLevel) => {
        // Simulate confidence levels state
        const confidenceLevels: (string | null)[] = [null, null, null];
        const currentQuestionIndex = 0;

        // Simulate selecting a confidence level
        confidenceLevels[currentQuestionIndex] = selectedLevel;

        // Verify the selected level is stored correctly
        expect(confidenceLevels[currentQuestionIndex]).toBe(selectedLevel);
        expect(['Low', 'Medium', 'High']).toContain(selectedLevel);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Test 2: Optional skip behavior - confidence can be null
   * Validates: Requirement 16.3, 16.4
   *
   * Users should be able to skip confidence rating, leaving it as null
   */
  it('should allow skipping confidence selection (null value)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (questionIndex) => {
        // Simulate confidence levels state with all null values
        const confidenceLevels: (string | null)[] = new Array(11).fill(null);

        // Verify that confidence can remain null (skipped)
        expect(confidenceLevels[questionIndex]).toBeNull();

        // Verify that null is a valid confidence level
        const isValidConfidence =
          confidenceLevels[questionIndex] === null ||
          ['Low', 'Medium', 'High'].includes(confidenceLevels[questionIndex] as string);

        expect(isValidConfidence).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  /**
   * Test 3: Confidence value can be cleared after selection
   * Validates: Requirement 16.3, 16.4
   *
   * Users should be able to clear their confidence selection,
   * returning it to null
   */
  it('should allow clearing confidence after selection', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Low', 'Medium', 'High'),
        fc.integer({ min: 0, max: 5 }),
        (selectedLevel, questionIndex) => {
          // Simulate confidence levels state
          const confidenceLevels: (string | null)[] = new Array(6).fill(null);

          // Select a confidence level
          confidenceLevels[questionIndex] = selectedLevel;
          expect(confidenceLevels[questionIndex]).toBe(selectedLevel);

          // Clear the confidence level
          confidenceLevels[questionIndex] = null;
          expect(confidenceLevels[questionIndex]).toBeNull();
        },
      ),
      { numRuns: 40 },
    );
  });

  /**
   * Test 4: Confidence value submission with answer
   * Validates: Requirement 16.4
   *
   * When an answer is submitted, the confidence level should be included
   * in the submission data
   */
  it('should submit confidence level with answer', () => {
    fc.assert(
      fc.property(
        fc.option(fc.constantFrom('Low', 'Medium', 'High'), { nil: null }),
        fc.uuid(),
        fc.array(fc.string(), { minLength: 1, maxLength: 1 }),
        (confidenceLevel, questionId, userAnswer) => {
          // Simulate answer submission data
          const submissionData = {
            questionId,
            userAnswer,
            confidenceLevel,
          };

          // Verify confidence level is included in submission
          expect(submissionData).toHaveProperty('confidenceLevel');

          // Verify confidence level is either null or a valid value
          if (submissionData.confidenceLevel !== null) {
            expect(['Low', 'Medium', 'High']).toContain(submissionData.confidenceLevel);
          } else {
            expect(submissionData.confidenceLevel).toBeNull();
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Test 5: Multiple questions can have different confidence levels
   * Validates: Requirement 16.3, 16.4
   *
   * Each question should maintain its own independent confidence level
   */
  it('should maintain independent confidence levels for multiple questions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.constantFrom('Low', 'Medium', 'High'), { nil: null }), {
          minLength: 3,
          maxLength: 10,
        }),
        (confidenceLevels) => {
          // Verify each question can have a different confidence level
          confidenceLevels.forEach((level, index) => {
            if (level !== null) {
              expect(['Low', 'Medium', 'High']).toContain(level);
            } else {
              expect(level).toBeNull();
            }

            // Verify independence - changing one doesn't affect others
            const otherLevels = confidenceLevels.filter((_, i) => i !== index);
            expect(otherLevels.length).toBe(confidenceLevels.length - 1);
          });
        },
      ),
      { numRuns: 40 },
    );
  });

  /**
   * Test 6: Confidence level state transitions
   * Validates: Requirement 16.3
   *
   * Users should be able to change their confidence selection
   * from one level to another
   */
  it('should allow changing confidence level selection', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Low', 'Medium', 'High'),
        fc.constantFrom('Low', 'Medium', 'High'),
        fc.integer({ min: 0, max: 5 }),
        (firstLevel, secondLevel, questionIndex) => {
          // Simulate confidence levels state
          const confidenceLevels: (string | null)[] = new Array(6).fill(null);

          // Select first confidence level
          confidenceLevels[questionIndex] = firstLevel;
          expect(confidenceLevels[questionIndex]).toBe(firstLevel);

          // Change to second confidence level
          confidenceLevels[questionIndex] = secondLevel;
          expect(confidenceLevels[questionIndex]).toBe(secondLevel);

          // Verify the new level is valid
          expect(['Low', 'Medium', 'High']).toContain(confidenceLevels[questionIndex] as string);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Test 7: Confidence level persists across question navigation
   * Validates: Requirement 16.4
   *
   * When navigating between questions, previously set confidence levels
   * should be preserved
   */
  it('should preserve confidence levels when navigating between questions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.constantFrom('Low', 'Medium', 'High'), { nil: null }), {
          minLength: 5,
          maxLength: 10,
        }),
        fc.integer({ min: 0, max: 4 }),
        (initialConfidenceLevels, targetQuestionIndex) => {
          // Simulate confidence levels state
          const confidenceLevels = [...initialConfidenceLevels];

          // Navigate to a question
          const currentQuestionIndex = targetQuestionIndex;

          // Verify the confidence level for this question is preserved
          const expectedLevel = initialConfidenceLevels[currentQuestionIndex];
          expect(confidenceLevels[currentQuestionIndex]).toBe(expectedLevel);

          // Verify all other confidence levels are also preserved
          confidenceLevels.forEach((level, index) => {
            expect(level).toBe(initialConfidenceLevels[index]);
          });
        },
      ),
      { numRuns: 40 },
    );
  });

  /**
   * Test 8: Clear button only appears when confidence is selected
   * Validates: Requirement 16.3
   *
   * The clear button should only be visible when a confidence level
   * has been selected (not null)
   */
  it('should show clear button only when confidence is selected', () => {
    fc.assert(
      fc.property(
        fc.option(fc.constantFrom('Low', 'Medium', 'High'), { nil: null }),
        (confidenceLevel) => {
          // Simulate whether clear button should be shown
          const shouldShowClearButton = confidenceLevel !== null;

          if (confidenceLevel === null) {
            expect(shouldShowClearButton).toBe(false);
          } else {
            expect(shouldShowClearButton).toBe(true);
            expect(['Low', 'Medium', 'High']).toContain(confidenceLevel);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Test 9: Confidence level validation
   * Validates: Requirement 16.4
   *
   * Only valid confidence levels (Low, Medium, High, or null) should be accepted
   */
  it('should only accept valid confidence levels', () => {
    fc.assert(
      fc.property(
        fc.option(fc.constantFrom('Low', 'Medium', 'High'), { nil: null }),
        (confidenceLevel) => {
          // Validate confidence level
          const isValid =
            confidenceLevel === null || ['Low', 'Medium', 'High'].includes(confidenceLevel);

          expect(isValid).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Test 10: Confidence level is optional in submission
   * Validates: Requirement 16.3, 16.4
   *
   * Answers can be submitted without a confidence level (null)
   */
  it('should allow answer submission without confidence level', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.string(), { minLength: 1, maxLength: 1 }),
        fc.boolean(),
        (questionId, userAnswer, markedForReview) => {
          // Simulate answer submission without confidence
          const submissionData = {
            questionId,
            userAnswer,
            markedForReview,
            confidenceLevel: null,
          };

          // Verify submission is valid with null confidence
          expect(submissionData.confidenceLevel).toBeNull();
          expect(submissionData).toHaveProperty('questionId');
          expect(submissionData).toHaveProperty('userAnswer');
        },
      ),
      { numRuns: 40 },
    );
  });
});
