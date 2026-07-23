import { describe, it, expect } from 'vitest';
import { ExamGradingService } from './ExamGradingService';
import type { ExamSessionRow, ExamAnswerRow, QuestionRow } from '../db-types';

describe('ExamGradingService', () => {
  const gradingService = new ExamGradingService();

  const mockQuestions: QuestionRow[] = [
    {
      id: 'q-1',
      topicId: 'topic-a',
      subTopicId: null,
      unitId: null,
      questionText: 'Single answer question',
      questionType: 'single',
      options: JSON.stringify(['A', 'B', 'C']),
      correctAnswers: JSON.stringify(['A']),
      explanation: 'A is correct',
      difficulty: 'Easy',
      tags: '[]',
      points: 1,
      isActive: 1,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'q-2',
      topicId: 'topic-a',
      subTopicId: null,
      unitId: null,
      questionText: 'Multiple answer question',
      questionType: 'multiple',
      options: JSON.stringify(['A', 'B', 'C', 'D']),
      correctAnswers: JSON.stringify(['B', 'C']),
      explanation: 'B and C are correct',
      difficulty: 'Medium',
      tags: '[]',
      points: 1,
      isActive: 1,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('grades an empty session correctly', () => {
    const session: ExamSessionRow = {
      id: 'session-empty',
      userId: 'user-1',
      examConfigurationId: 'config-1',
      topicId: null,
      questions: JSON.stringify([]), // empty questions list
      status: 'completed',
      score: null,
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      unansweredQuestions: 0,
      timeTaken: null,
      startTime: '',
      endTime: '',
      autoSubmitAt: '',
      isPracticeMode: 0,
      isTopicQuiz: 0,
      isCustomQuiz: 0,
      isSRSReview: 0,
      passingScoreOverride: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      pauseCount: 0,
    };

    const result = gradingService.grade(session, [], [], 70);

    expect(result.score).toBe(0);
    expect(result.correctAnswers).toBe(0);
    expect(result.incorrectAnswers).toBe(0);
    expect(result.unansweredQuestions).toBe(0);
    expect(result.xpAwarded).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.detailedResults).toHaveLength(0);
  });

  it('grades session with all unanswered questions correctly', () => {
    const session: ExamSessionRow = {
      id: 'session-unanswered',
      userId: 'user-1',
      examConfigurationId: 'config-1',
      topicId: null,
      questions: JSON.stringify(['q-1', 'q-2']),
      status: 'completed',
      score: null,
      totalQuestions: 2,
      correctAnswers: 0,
      incorrectAnswers: 0,
      unansweredQuestions: 2,
      timeTaken: null,
      startTime: '',
      endTime: '',
      autoSubmitAt: '',
      isPracticeMode: 0,
      isTopicQuiz: 0,
      isCustomQuiz: 0,
      isSRSReview: 0,
      passingScoreOverride: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      pauseCount: 0,
    };

    // No answers provided
    const result = gradingService.grade(session, [], mockQuestions, 70);

    expect(result.score).toBe(0);
    expect(result.correctAnswers).toBe(0);
    expect(result.incorrectAnswers).toBe(0);
    expect(result.unansweredQuestions).toBe(2);
    expect(result.xpAwarded).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.detailedResults[0].isCorrect).toBe(false);
    expect(result.detailedResults[1].isCorrect).toBe(false);
  });

  it('grades single and multiple choice answers correctly', () => {
    const session: ExamSessionRow = {
      id: 'session-mixed',
      userId: 'user-1',
      examConfigurationId: 'config-1',
      topicId: null,
      questions: JSON.stringify(['q-1', 'q-2']),
      status: 'completed',
      score: null,
      totalQuestions: 2,
      correctAnswers: 0,
      incorrectAnswers: 0,
      unansweredQuestions: 0,
      timeTaken: null,
      startTime: '',
      endTime: '',
      autoSubmitAt: '',
      isPracticeMode: 0,
      isTopicQuiz: 0,
      isCustomQuiz: 0,
      isSRSReview: 0,
      passingScoreOverride: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      pauseCount: 0,
    };

    const answers: ExamAnswerRow[] = [
      {
        id: 'ans-1',
        examSessionId: 'session-mixed',
        questionId: 'q-1',
        userAnswer: JSON.stringify('A'), // correct
        isCorrect: 0,
        markedForReview: 0,
        timeSpent: 10,
        confidenceLevel: 'high',
        answerOrder: 1,
      },
      {
        id: 'ans-2',
        examSessionId: 'session-mixed',
        questionId: 'q-2',
        userAnswer: JSON.stringify(['B', 'C']), // correct
        isCorrect: 0,
        markedForReview: 0,
        timeSpent: 15,
        confidenceLevel: 'medium',
        answerOrder: 2,
      },
    ];

    const result = gradingService.grade(session, answers, mockQuestions, 70);

    expect(result.score).toBe(100);
    expect(result.correctAnswers).toBe(2);
    expect(result.incorrectAnswers).toBe(0);
    expect(result.unansweredQuestions).toBe(0);
    expect(result.xpAwarded).toBe(20);
    expect(result.passed).toBe(true);
  });

  it('marks incorrect answer if single choice answer is wrong', () => {
    const session: ExamSessionRow = {
      id: 'session-wrong-single',
      userId: 'user-1',
      examConfigurationId: 'config-1',
      topicId: null,
      questions: JSON.stringify(['q-1']),
      status: 'completed',
      score: null,
      totalQuestions: 1,
      correctAnswers: 0,
      incorrectAnswers: 0,
      unansweredQuestions: 0,
      timeTaken: null,
      startTime: '',
      endTime: '',
      autoSubmitAt: '',
      isPracticeMode: 0,
      isTopicQuiz: 0,
      isCustomQuiz: 0,
      isSRSReview: 0,
      passingScoreOverride: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      pauseCount: 0,
    };

    const answers: ExamAnswerRow[] = [
      {
        id: 'ans-1',
        examSessionId: 'session-wrong-single',
        questionId: 'q-1',
        userAnswer: JSON.stringify('B'), // wrong
        isCorrect: 0,
        markedForReview: 0,
        timeSpent: 10,
        confidenceLevel: 'low',
        answerOrder: 1,
      },
    ];

    const result = gradingService.grade(session, answers, mockQuestions, 70);

    expect(result.score).toBe(0);
    expect(result.correctAnswers).toBe(0);
    expect(result.incorrectAnswers).toBe(1);
    expect(result.passed).toBe(false);
  });

  it('marks incorrect answer if multiple choice answer contains only partial choices or extras', () => {
    const session: ExamSessionRow = {
      id: 'session-wrong-multiple',
      userId: 'user-1',
      examConfigurationId: 'config-1',
      topicId: null,
      questions: JSON.stringify(['q-2']),
      status: 'completed',
      score: null,
      totalQuestions: 1,
      correctAnswers: 0,
      incorrectAnswers: 0,
      unansweredQuestions: 0,
      timeTaken: null,
      startTime: '',
      endTime: '',
      autoSubmitAt: '',
      isPracticeMode: 0,
      isTopicQuiz: 0,
      isCustomQuiz: 0,
      isSRSReview: 0,
      passingScoreOverride: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      pauseCount: 0,
    };

    const answers: ExamAnswerRow[] = [
      {
        id: 'ans-2',
        examSessionId: 'session-wrong-multiple',
        questionId: 'q-2',
        userAnswer: JSON.stringify(['B']), // partially wrong/incomplete
        isCorrect: 0,
        markedForReview: 0,
        timeSpent: 15,
        confidenceLevel: 'medium',
        answerOrder: 1,
      },
    ];

    const result = gradingService.grade(session, answers, mockQuestions, 70);

    expect(result.score).toBe(0);
    expect(result.correctAnswers).toBe(0);
    expect(result.incorrectAnswers).toBe(1);
  });
});
