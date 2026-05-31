export interface ConfidenceMatrix {
  trueKnowledge: number; // correct + confident
  luckyGuesses: number; // correct + guessed
  knownWeaknesses: number; // incorrect + guessed
  criticalGaps: number; // incorrect + confident
}

export interface AnswerForMatrix {
  isCorrect: boolean;
  confidenceLevel: string | null;
}

/**
 * Computes the confidence matrix from an array of answers.
 * Answers with null confidenceLevel are excluded.
 */
export function computeConfidenceMatrix(answers: AnswerForMatrix[]): ConfidenceMatrix {
  const matrix: ConfidenceMatrix = {
    trueKnowledge: 0,
    luckyGuesses: 0,
    knownWeaknesses: 0,
    criticalGaps: 0,
  };
  for (const a of answers) {
    if (a.confidenceLevel !== 'confident' && a.confidenceLevel !== 'guessed') continue;
    if (a.isCorrect && a.confidenceLevel === 'confident') matrix.trueKnowledge++;
    else if (a.isCorrect && a.confidenceLevel === 'guessed') matrix.luckyGuesses++;
    else if (!a.isCorrect && a.confidenceLevel === 'guessed') matrix.knownWeaknesses++;
    else if (!a.isCorrect && a.confidenceLevel === 'confident') matrix.criticalGaps++;
  }
  return matrix;
}
