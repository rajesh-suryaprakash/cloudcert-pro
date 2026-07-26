import type { QuestionRow } from '../db-types';

type SelectionStrategy = 'random' | 'difficulty_balanced' | 'topic_based';

export interface SelectionConfig {
  strategy: SelectionStrategy;
  totalQuestions: number;
  topicWeights?: Record<string, number>;
  seenQuestionIds?: Set<string>;
}

/** Fisher-Yates shuffle (in-place, returns array) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 
 * Selects questions prioritizing unseen ones if seenIds is provided.
 * Fills any remaining quota with seen questions.
 */
function selectWithPriority(
  pool: QuestionRow[],
  total: number,
  seenIds?: Set<string>,
): QuestionRow[] {
  if (pool.length === 0 || total <= 0) return [];
  if (seenIds && seenIds.size > 0) {
    const unseen = pool.filter((q) => !seenIds.has(q.id));
    const seen = pool.filter((q) => seenIds.has(q.id));

    const selectedUnseen = shuffle([...unseen]).slice(0, total);
    if (selectedUnseen.length < total) {
      const remainingSlots = total - selectedUnseen.length;
      const selectedSeen = shuffle([...seen]).slice(0, remainingSlots);
      // Combine and shuffle again so seen questions aren't always at the end
      return shuffle([...selectedUnseen, ...selectedSeen]);
    }
    return selectedUnseen;
  }
  return shuffle([...pool]).slice(0, Math.min(total, pool.length));
}

/**
 * Largest-remainder proportional allocation.
 * Given groups with a weight and available count, distributes `total` slots
 * proportionally, capping each group at its available count and redistributing
 * freed slots until the target is met or no more slots can be filled.
 */
function largestRemainder(
  groups: { weight: number; available: number }[],
  total: number,
): number[] {
  if (total <= 0 || groups.length === 0) return groups.map(() => 0);

  const totalWeight = groups.reduce((s, g) => s + g.weight, 0);
  if (totalWeight === 0) return groups.map(() => 0);

  // Initial floor quotas
  const exact = groups.map((g) => (g.weight / totalWeight) * total);
  const floors = exact.map((q) => Math.floor(q));
  const remainders = exact.map((q, i) => q - floors[i]);

  // Distribute remaining slots by largest remainder
  const remaining = total - floors.reduce((s, f) => s + f, 0);
  const order = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.i);

  for (let k = 0; k < remaining; k++) {
    floors[order[k]]++;
  }

  // Cap at available and redistribute freed slots
  const allocations = floors.slice();
  let changed = true;
  while (changed) {
    changed = false;
    let freed = 0;
    for (let i = 0; i < allocations.length; i++) {
      if (allocations[i] > groups[i].available) {
        freed += allocations[i] - groups[i].available;
        allocations[i] = groups[i].available;
        changed = true;
      }
    }
    if (freed === 0) break;

    // Redistribute freed slots to uncapped groups by largest remainder
    const uncapped = allocations
      .map((a, i) => ({ i, gap: groups[i].available - a, r: remainders[i] }))
      .filter((x) => x.gap > 0)
      .sort((a, b) => b.r - a.r);

    for (const { i, gap } of uncapped) {
      const give = Math.min(freed, gap);
      allocations[i] += give;
      freed -= give;
      if (freed === 0) break;
    }
  }

  return allocations;
}

function selectRandom(
  pool: QuestionRow[],
  total: number,
  seenIds?: Set<string>,
): QuestionRow[] {
  return selectWithPriority(pool, total, seenIds);
}

function selectDifficultyBalanced(
  pool: QuestionRow[],
  total: number,
  seenIds?: Set<string>,
): QuestionRow[] {
  if (pool.length === 0 || total <= 0) return [];

  const tiers = ['Easy', 'Medium', 'Hard'];
  const grouped = tiers.map((d) => pool.filter((q) => q.difficulty === d));
  const groups = grouped.map((g) => ({ weight: g.length, available: g.length }));

  const allocations = largestRemainder(groups, Math.min(total, pool.length));

  return tiers.flatMap((_, i) => selectWithPriority([...grouped[i]], allocations[i], seenIds));
}

function selectTopicBased(
  pool: QuestionRow[],
  total: number,
  topicWeights: Record<string, number>,
  seenIds?: Set<string>,
): QuestionRow[] {
  if (pool.length === 0 || total <= 0) return [];

  const topicIds = Object.keys(topicWeights).filter((id) => (topicWeights[id] ?? 0) > 0);
  if (topicIds.length === 0) return selectRandom(pool, total, seenIds);

  // Only consider topics that actually have questions in the pool
  const grouped = topicIds.map((id) => ({
    id,
    questions: pool.filter((q) => q.topicId === id),
    weight: topicWeights[id],
  }));
  const active = grouped.filter((g) => g.questions.length > 0);
  if (active.length === 0) return [];

  const groups = active.map((g) => ({ weight: g.weight, available: g.questions.length }));
  const allocations = largestRemainder(groups, Math.min(total, pool.length));

  return active.flatMap((g, i) => selectWithPriority([...g.questions], allocations[i], seenIds));
}

export function selectQuestions(pool: QuestionRow[], config: SelectionConfig): QuestionRow[] {
  const { strategy, totalQuestions, topicWeights, seenQuestionIds } = config;

  if (strategy === 'difficulty_balanced') {
    return selectDifficultyBalanced(pool, totalQuestions, seenQuestionIds);
  }

  if (strategy === 'topic_based') {
    let weights: Record<string, number> = {};
    if (topicWeights && Object.keys(topicWeights).length > 0) {
      weights = topicWeights;
    }
    return selectTopicBased(pool, totalQuestions, weights, seenQuestionIds);
  }

  // default: random
  return selectRandom(pool, totalQuestions, seenQuestionIds);
}
