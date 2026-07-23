import type { ExamSessionRow, ExamAnswerRow, QuestionRow } from '../db-types';
import {
  computeConfidenceMatrix,
  type ConfidenceMatrix,
  type AnswerForMatrix,
} from '../utils/examUtils';

export interface DetailedResult {
  questionId: string;
  topicId: string | null;
  userAnswer: string | string[] | null;
  isCorrect: boolean;
  correctAnswers: string | string[];
  explanation: string | null;
  confidenceLevel: string | null;
}

export interface GradingResult {
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  xpAwarded: number;
  passed: boolean;
  detailedResults: DetailedResult[];
  confidenceMatrix: ConfidenceMatrix;
}

export class ExamGradingService {
  /**
   * Pure grading function — no DB calls.
   * Accepts session data, answers, questions, and passingScore; returns a GradingResult.
   *
   * Feature: codebase-refactoring, Property 6: Grading result counts are exhaustive
   * Feature: codebase-refactoring, Property 7: XP award is proportional to correct answers
   */
  grade(
    session: ExamSessionRow,
    answers: ExamAnswerRow[],
    questions: QuestionRow[],
    passingScore: number,
  ): GradingResult {
    const questionIds: string[] = JSON.parse(session.questions);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    const detailedResults: DetailedResult[] = [];
    const answersForMatrix: AnswerForMatrix[] = [];

    for (const qId of questionIds) {
      const question = questionMap.get(qId);
      const answer = answers.find((a) => a.questionId === qId);

      let isCorrect = false;
      let userAnswer: string | string[] | null = null;

      if (!answer || !answer.userAnswer || JSON.parse(answer.userAnswer) === null) {
        unansweredCount++;
      } else {
        userAnswer = JSON.parse(answer.userAnswer);
        if (question) {
          const correctAnswers = JSON.parse(question.correctAnswers);

          if (question.questionType === 'multiple') {
            isCorrect =
              Array.isArray(userAnswer) &&
              userAnswer.length === correctAnswers.length &&
              (userAnswer as string[]).every((ans: string) => correctAnswers.includes(ans));
          } else {
            // correctAnswers is always a parsed array (e.g. ["Compute Engine"])
            const expected = Array.isArray(correctAnswers) ? correctAnswers[0] : correctAnswers;
            isCorrect = userAnswer === expected;
          }

          if (isCorrect) correctCount++;
          else incorrectCount++;
        }
      }

      answersForMatrix.push({
        isCorrect,
        confidenceLevel: answer?.confidenceLevel ?? null,
      });

      detailedResults.push({
        questionId: qId,
        topicId: question?.topicId ?? null,
        userAnswer,
        isCorrect,
        correctAnswers: question ? JSON.parse(question.correctAnswers) : [],
        explanation: question?.explanation ?? null,
        confidenceLevel: answer?.confidenceLevel ?? null,
      });
    }

    const score = questionIds.length > 0 ? (correctCount / questionIds.length) * 100 : 0;
    const passed = score >= passingScore;
    const xpAwarded = correctCount * 10;
    const confidenceMatrix = computeConfidenceMatrix(answersForMatrix);

    return {
      score,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      unansweredQuestions: unansweredCount,
      xpAwarded,
      passed,
      detailedResults,
      confidenceMatrix,
    };
  }
}
