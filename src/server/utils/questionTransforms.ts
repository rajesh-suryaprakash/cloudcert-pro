/**
 * @fileoverview Question Data Transformation Utilities
 * 
 * Provides utilities for converting between database format (QuestionRow) 
 * and API/application format (Question). Eliminates code duplication across 
 * route handlers and ensures consistent transformation logic.
 * 
 * Key transformations:
 * - Parse JSON strings (options, correctAnswers, tags) to arrays/objects
 * - Type casting for questionType enum
 * - Boolean conversion for isActive flag
 */

import type { QuestionRow } from '../db-types';
import type { Question } from '../../types';

/**
 * Convert a QuestionRow (database format) to Question (API format)
 * 
 * Transforms:
 * - `options`: JSON string → string array
 * - `correctAnswers`: JSON string → string or string array (based on questionType)
 * - `tags`: JSON string → string array (defaults to empty array if null)
 * - `questionType`: string → 'single' | 'multiple' (type assertion)
 * - `isActive`: number (0/1) → boolean (optional, if present)
 * 
 * @param row - QuestionRow from database query
 * @returns Question object ready for API response
 * 
 * @example
 * ```ts
 * const questionRows = await db.query<QuestionRow>('SELECT * FROM questions');
 * const questions = questionRows.map(questionRowToQuestion);
 * ```
 */
export function questionRowToQuestion(row: QuestionRow): Question {
  // Parse JSON fields
  const options = JSON.parse(row.options) as string[];
  const correctAnswers = JSON.parse(row.correctAnswers) as string | string[];
  const tags = JSON.parse(row.tags || '[]') as string[];
  
  // Build question object - exclude isActive from spread since it needs type conversion
  const { isActive: isActiveNumber, ...rowWithoutIsActive } = row;
  
  const question: Question = {
    ...rowWithoutIsActive,
    options,
    correctAnswers,
    tags,
    questionType: row.questionType as 'single' | 'multiple',
    difficulty: row.difficulty as 'Easy' | 'Medium' | 'Hard',
    isActive: typeof isActiveNumber === 'number' ? isActiveNumber === 1 : true,
  };
  
  return question;
}

/**
 * Convert multiple QuestionRows to Questions
 * 
 * Convenience wrapper around questionRowToQuestion for array transformations.
 * 
 * @param rows - Array of QuestionRow objects
 * @returns Array of Question objects
 * 
 * @example
 * ```ts
 * const questionRows = await db.query<QuestionRow>('SELECT * FROM questions');
 * const questions = questionRowsToQuestions(questionRows);
 * ```
 */
export function questionRowsToQuestions(rows: QuestionRow[]): Question[] {
  return rows.map(questionRowToQuestion);
}

/**
 * Safe JSON parse with fallback for question fields
 * 
 * Handles cases where database might have malformed JSON or null values.
 * Used internally by questionRowToQuestion but exported for specialized use cases.
 * 
 * @param value - JSON string to parse
 * @param fallback - Default value if parsing fails
 * @returns Parsed value or fallback
 * 
 * @example
 * ```ts
 * const tags = safeParseQuestionField(row.tags, []);
 * ```
 */
export function safeParseQuestionField<T>(
  value: string | null | undefined,
  fallback: T
): T {
  if (!value) return fallback;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
