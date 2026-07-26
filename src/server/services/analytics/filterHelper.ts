import type { FilterOptions } from '../../types/insights';

/**
 * Helper method to build SQL WHERE clause for filter options
 */
export function buildFilterClause(
  filterOptions: FilterOptions = {},
  tableAlias: string = 'es',
): { clause: string; params: unknown[]; questionFilter: string; questionParams: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const questionConditions: string[] = [];
  const questionParams: unknown[] = [];

  // Filter by exam type (mock vs practice)
  if (filterOptions.examType) {
    if (filterOptions.examType === 'mock') {
      conditions.push(`${tableAlias}.isPracticeMode = 0`);
    } else if (filterOptions.examType === 'practice') {
      conditions.push(`${tableAlias}.isPracticeMode = 1`);
    }
  }

  // Filter by difficulty - this should be applied to questions table
  if (
    filterOptions.difficulty &&
    filterOptions.difficulty !== 'Mixed' &&
    filterOptions.difficulty !== 'all'
  ) {
    questionConditions.push(`q.difficulty = ?`);
    questionParams.push(filterOptions.difficulty);
  }

  return {
    clause: conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '',
    params,
    questionFilter: questionConditions.length > 0 ? ' AND ' + questionConditions.join(' AND ') : '',
    questionParams,
  };
}
