import type { QuizState, ConfidenceMatrix, HistoricalAttempt, ExamConfiguration } from '../types';
import { isAnswerCorrect } from './answerUtils';

/**
 * Format a structured JSON or plain text explanation to a markdown block.
 */
function formatExplanation(text: string, options: string[] = []): string {
  if (typeof text !== 'string' || !text) return '';

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      let md = '';
      const general = parsed['general explanation'] || '';
      if (general) {
        md += `${general}\n\n`;
      }

      const wrongOptions =
        parsed['why other options are wrong'] || parsed['Why other options are wrong'] || {};
      const wrongEntries = Object.entries(wrongOptions);
      if (wrongEntries.length > 0) {
        md += `**Why other options are wrong:**\n`;
        wrongEntries.forEach(([optionText, reason], i) => {
          const safeOptionText = optionText || '';
          const optIndex = options.findIndex(
            (o) => (o || '').trim().toLowerCase() === safeOptionText.trim().toLowerCase(),
          );
          const letter = optIndex >= 0 ? String.fromCharCode(65 + optIndex) + ')' : `${i + 1})`;
          md += `- **${letter}** *${safeOptionText}* — ${reason}\n`;
        });
      }
      return md.trim();
    }
  } catch {
    // Non-JSON plain text explanation
  }

  return text.trim();
}

interface DownloadAttemptReviewMarkdownOptions {
  quizState: QuizState;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  passed: boolean | null;
  confidenceMatrix: ConfidenceMatrix | null;
  examConfig?: ExamConfiguration & { isTopicQuiz?: boolean; isCustomQuiz?: boolean };
  historicalAttempt?: HistoricalAttempt | null;
  sessionId?: string;
}

/**
 * Compiles completed exam attempt review data into a Markdown document and triggers client-side download.
 */
export function downloadAttemptReviewMarkdown(options: DownloadAttemptReviewMarkdownOptions): void {
  // Defensive guard for non-browser/SSR environments
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return;
  }

  const {
    quizState,
    scorePercent,
    correctCount,
    totalCount,
    passed,
    confidenceMatrix,
    examConfig,
    historicalAttempt,
    sessionId,
  } = options;

  const examName = examConfig?.name || historicalAttempt?.sessionName || 'Exam Attempt';
  const dateStr = historicalAttempt?.createdAt
    ? new Date(historicalAttempt.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  let md = `# Attempt Review: ${examName}\n\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Score:** ${scorePercent}% (${correctCount} / ${totalCount})  \n`;
  if (passed !== null) {
    md += `**Status:** ${passed ? 'PASSED' : 'FAILED'}  \n`;
  }
  md += `\n---\n\n`;

  // Confidence Profile
  if (confidenceMatrix) {
    const hasStats =
      confidenceMatrix.trueKnowledge > 0 ||
      confidenceMatrix.luckyGuesses > 0 ||
      confidenceMatrix.knownWeaknesses > 0 ||
      confidenceMatrix.criticalGaps > 0;

    if (hasStats) {
      md += `## Confidence Profile\n\n`;
      md += `- **True Knowledge:** ${confidenceMatrix.trueKnowledge} (Correct + Confident)\n`;
      md += `- **Lucky Guesses:** ${confidenceMatrix.luckyGuesses} (Correct + Guessed)\n`;
      md += `- **Known Weaknesses:** ${confidenceMatrix.knownWeaknesses} (Incorrect + Guessed)\n`;
      md += `- **Critical Gaps:** ${confidenceMatrix.criticalGaps} (Incorrect + Confident)\n\n`;
      md += `---\n\n`;
    }
  }

  md += `## Questions Review\n\n`;

  quizState.questions.forEach((q, i) => {
    const userAnswer = quizState.userAnswers[i];
    const isCorrect = isAnswerCorrect(q, userAnswer);
    const label = isCorrect ? '✅ Correct' : '❌ Incorrect';

    md += `### Question ${i + 1}: ${q.questionText}\n`;
    md += `*Result:* **${label}**\n\n`;

    md += `**Options:**\n`;
    q.options.forEach((opt, idx) => {
      const optionLetter = String.fromCharCode(65 + idx);

      const cleanOpt = (opt || '').trim();

      const isCorrectOption = Array.isArray(q.correctAnswers)
        ? q.correctAnswers.some((c) => (c || '').trim() === cleanOpt)
        : (q.correctAnswers || '').trim() === cleanOpt;

      const isSelectedOption = Array.isArray(userAnswer)
        ? userAnswer.some((u) => (u || '').trim() === cleanOpt)
        : (userAnswer || '').trim() === cleanOpt;

      const checkbox = isSelectedOption ? '[x]' : '[ ]';
      let suffix = '';
      if (isCorrectOption) {
        suffix = ' *(Correct Answer)*';
      } else if (isSelectedOption && !isCorrectOption) {
        suffix = ' *(Your Selection - Incorrect)*';
      } else if (isSelectedOption) {
        suffix = ' *(Your Selection)*';
      }

      md += `- ${checkbox} **${optionLetter})** ${opt}${suffix}\n`;
    });

    md += `\n`;

    const explanationFormatted = formatExplanation(q.explanation, q.options);
    if (explanationFormatted) {
      md += `**Explanation:**\n\n`;
      md += `> ${explanationFormatted.replace(/\n/g, '\n> ')}\n\n`;
    }

    md += `---\n\n`;
  });

  // Trigger download in browser
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  // Create URL-safe lowercase filename matching session_<id>_<timestamp>.md convention
  const finalSessionId = historicalAttempt?.id || sessionId || 'session';
  const safeId = finalSessionId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const createdAt = historicalAttempt?.createdAt || new Date(quizState.startTime).toISOString();
  const safeTimestamp = new Date(createdAt)
    .toISOString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const filename = `session_${safeId}_${safeTimestamp}.md`;

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
