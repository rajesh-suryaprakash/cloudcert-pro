import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExamSession } from './useExamSession';
import * as examsApi from '../api/exams';
import * as api from '../api';
import type { Question, ExamConfiguration, CloudProvider } from '../types';

/**
 * Integration tests for question selection with history tracking
 *
 * Feature: question-history-tracking
 * Task: 9.5 Write integration tests for question selection with history
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3
 *
 * Tests cover:
 * - Mock test with seen questions excluded
 * - Practice test with seen questions excluded
 * - Custom quiz with seen questions excluded
 * - Topic quiz with seen questions excluded
 * - Subtopic quiz with seen questions excluded
 * - Insufficient unseen questions warning
 * - Exhausted question pool error
 */

describe('Feature: question-history-tracking - Question Selection Integration Tests', () => {
  const mockCertification = {
    id: 'cert-123',
    title: 'AWS Solutions Architect',
    vendor: 'AWS' as CloudProvider,
  };

  const mockTopic = {
    id: 'topic-123',
    title: 'EC2 Fundamentals',
    certificationId: 'cert-123',
  };

  const mockExamConfig: ExamConfiguration = {
    id: 'exam-123',
    certificationId: 'cert-123',
    name: 'Practice Exam',
    duration: 120,
    totalQuestions: 10,
    passingScore: 70,
    questionSelectionStrategy: 'random',
    topicWeights: {},
    isActive: true,
  };

  const createMockQuestions = (count: number): Question[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `question-${i + 1}`,
      topicId: 'topic-123',
      subTopicId: null,
      questionText: `Question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswers: ['A'],
      explanation: 'Explanation',
      difficulty: 'easy',
      tags: [],
      isActive: true,
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test: Mock test with seen questions excluded
   * Requirement: 2.1
   */
  it('should exclude seen questions when starting a mock test', async () => {
    const mockQuestions = createMockQuestions(15);
    const unseenCount = 12;
    const totalCount = 15;

    // Mock API responses
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce({ unseenCount, totalCount }) // unseen questions check
      .mockResolvedValueOnce({ id: 'session-123' }); // session creation

    vi.spyOn(examsApi, 'fetchExamQuestions').mockResolvedValue(mockQuestions);
    vi.spyOn(examsApi, 'createExamSession').mockResolvedValue({
      id: 'session-123',
      examConfigurationId: mockExamConfig.id,
      questions: mockQuestions.slice(0, 10).map((q) => q.id),
      status: 'in_progress',
      autoSubmitAt: null,
    });

    const { result } = renderHook(() => useExamSession());

    // Start mock test
    await result.current.startQuiz(mockCertification, mockExamConfig, false);

    await waitFor(() => {
      // Verify session was created
      expect(result.current.activeSessionId).toBe('session-123');
      expect(result.current.quizQuestions).toHaveLength(10);
    });

    // Verify unseen questions endpoint was called
    expect(api.fetchApi).toHaveBeenCalledWith(
      `/certifications/${mockCertification.id}/questions/unseen`,
    );
  });

  /**
   * Test: Practice test with seen questions excluded
   * Requirement: 2.2
   */
  it('should exclude seen questions when starting a practice test', async () => {
    const mockQuestions = createMockQuestions(20);
    const unseenCount = 18;
    const totalCount = 20;

    // Mock API responses
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce({ unseenCount, totalCount }) // unseen questions check
      .mockResolvedValueOnce({ id: 'session-456' }); // session creation

    vi.spyOn(examsApi, 'fetchExamQuestions').mockResolvedValue(mockQuestions);
    vi.spyOn(examsApi, 'createExamSession').mockResolvedValue({
      id: 'session-456',
      examConfigurationId: mockExamConfig.id,
      questions: mockQuestions.slice(0, 10).map((q) => q.id),
      status: 'in_progress',
      autoSubmitAt: null,
    });

    const { result } = renderHook(() => useExamSession());

    // Start practice test
    await result.current.startQuiz(
      mockCertification,
      { ...mockExamConfig, isPracticeMode: true },
      true,
    );

    await waitFor(() => {
      // Verify session was created
      expect(result.current.activeSessionId).toBe('session-456');
      expect(result.current.quizQuestions).toHaveLength(10);
    });

    // Verify unseen questions endpoint was called
    expect(api.fetchApi).toHaveBeenCalledWith(
      `/certifications/${mockCertification.id}/questions/unseen`,
    );
  });

  /**
   * Test: Custom quiz with seen questions excluded
   * Requirement: 2.3
   */
  it('should exclude seen questions when starting a custom quiz', async () => {
    const mockQuestions = createMockQuestions(25);
    const unseenCount = 20;
    const totalCount = 25;
    const requestedCount = 15;
    const difficulty = 'easy';

    // Mock API responses
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce({ unseenCount, totalCount }) // unseen questions check
      .mockResolvedValueOnce(mockQuestions); // questions fetch

    vi.spyOn(examsApi, 'createExamSession').mockResolvedValue({
      id: 'session-789',
      certificationId: mockCertification.id,
      questions: mockQuestions.slice(0, requestedCount).map((q) => q.id),
      status: 'in_progress',
      autoSubmitAt: null,
    });

    const { result } = renderHook(() => useExamSession());

    // Start custom quiz
    await result.current.startCustomQuiz(mockCertification, difficulty, requestedCount);

    await waitFor(() => {
      // Verify session was created
      expect(result.current.activeSessionId).toBe('session-789');
      expect(result.current.quizQuestions).toHaveLength(requestedCount);
    });

    // Verify unseen questions endpoint was called with difficulty filter
    expect(api.fetchApi).toHaveBeenCalledWith(
      `/certifications/${mockCertification.id}/questions/unseen?difficulty=${encodeURIComponent(difficulty)}`,
    );
  });

  /**
   * Test: Topic quiz with seen questions excluded
   * Requirement: 2.4
   */
  it('should exclude seen questions when starting a topic quiz', async () => {
    const mockQuestions = createMockQuestions(30);
    const unseenCount = 25;
    const totalCount = 30;

    // Mock API responses
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce({ unseenCount, totalCount }) // unseen questions check
      .mockResolvedValueOnce(mockQuestions); // questions fetch

    vi.spyOn(examsApi, 'createExamSession').mockResolvedValue({
      id: 'session-topic-123',
      certificationId: mockCertification.id,
      questions: mockQuestions.slice(0, 20).map((q) => q.id),
      status: 'in_progress',
      autoSubmitAt: null,
    });

    const { result } = renderHook(() => useExamSession());

    // Start topic quiz
    await result.current.startTopicQuiz(mockCertification, mockTopic, { numQuestions: 20 });

    await waitFor(() => {
      // Verify session was created
      expect(result.current.activeSessionId).toBe('session-topic-123');
      expect(result.current.quizQuestions).toHaveLength(20);
    });

    // Verify unseen questions endpoint was called with topicId filter
    expect(api.fetchApi).toHaveBeenCalledWith(
      `/certifications/${mockCertification.id}/questions/unseen?topicId=${mockTopic.id}`,
    );
  });

  /**
   * Test: Subtopic quiz with seen questions excluded
   * Requirement: 2.5
   */
  it('should exclude seen questions when starting a subtopic quiz', async () => {
    const mockQuestions = createMockQuestions(40);
    const subtopicIds = ['subtopic-1', 'subtopic-2'];
    const unseenCountPerSubtopic = 15;

    // Mock API responses for unseen questions check (one per subtopic)
    const fetchApiSpy = vi.spyOn(api, 'fetchApi');

    // First two calls are for unseen questions check
    fetchApiSpy.mockResolvedValueOnce({ unseenCount: unseenCountPerSubtopic, totalCount: 20 });
    fetchApiSpy.mockResolvedValueOnce({ unseenCount: unseenCountPerSubtopic, totalCount: 20 });

    // Next two calls are for fetching questions per subtopic
    fetchApiSpy.mockResolvedValueOnce(mockQuestions.slice(0, 20));
    fetchApiSpy.mockResolvedValueOnce(mockQuestions.slice(20, 40));

    vi.spyOn(examsApi, 'createExamSession').mockResolvedValue({
      id: 'session-subtopic-123',
      certificationId: mockCertification.id,
      questions: mockQuestions.map((q) => q.id),
      status: 'in_progress',
      autoSubmitAt: null,
    });

    const { result } = renderHook(() => useExamSession());

    // Start subtopic quiz
    await result.current.startSubtopicQuiz(mockCertification, mockTopic, subtopicIds);

    await waitFor(() => {
      // Verify session was created
      expect(result.current.activeSessionId).toBe('session-subtopic-123');
      expect(result.current.quizQuestions).toHaveLength(40);
    });

    // Verify unseen questions endpoint was called for each subtopic
    expect(api.fetchApi).toHaveBeenCalledWith(
      `/certifications/${mockCertification.id}/questions/unseen?subtopicId=${subtopicIds[0]}`,
    );
    expect(api.fetchApi).toHaveBeenCalledWith(
      `/certifications/${mockCertification.id}/questions/unseen?subtopicId=${subtopicIds[1]}`,
    );
  });

  /**
   * Test: Insufficient unseen questions warning
   * Requirements: 3.1, 3.2
   */
  it('should warn when insufficient unseen questions are available', async () => {
    const mockQuestions = createMockQuestions(10);
    const unseenCount = 5; // Less than required 10
    const totalCount = 10;

    // Spy on console.warn to verify warning is logged
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock API responses
    vi.spyOn(api, 'fetchApi')
      .mockResolvedValueOnce({ unseenCount, totalCount }) // unseen questions check
      .mockResolvedValueOnce({ id: 'session-warn-123' }); // session creation

    vi.spyOn(examsApi, 'fetchExamQuestions').mockResolvedValue(mockQuestions);
    vi.spyOn(examsApi, 'createExamSession').mockResolvedValue({
      id: 'session-warn-123',
      examConfigurationId: mockExamConfig.id,
      questions: mockQuestions.slice(0, 5).map((q) => q.id),
      status: 'in_progress',
      autoSubmitAt: null,
    });

    const { result } = renderHook(() => useExamSession());

    // Start quiz with insufficient questions
    await result.current.startQuiz(mockCertification, mockExamConfig, false);

    await waitFor(() => {
      // Verify session was still created
      expect(result.current.activeSessionId).toBe('session-warn-123');
    });

    // Verify warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Only ${unseenCount} of ${mockExamConfig.totalQuestions} requested questions are unseen`,
      ),
    );

    consoleWarnSpy.mockRestore();
  });

  /**
   * Test: Exhausted question pool error
   * Requirement: 3.3
   */
  it('should throw error when no unseen questions are available', async () => {
    const unseenCount = 0;
    const totalCount = 10;

    // Mock API responses
    vi.spyOn(api, 'fetchApi').mockResolvedValueOnce({ unseenCount, totalCount }); // unseen questions check

    const { result } = renderHook(() => useExamSession());

    // Attempt to start quiz with no unseen questions
    await expect(async () => {
      await result.current.startQuiz(mockCertification, mockExamConfig, false);
    }).rejects.toThrow(
      'No unseen questions available for this exam. Consider resetting your question history to review questions again.',
    );

    // Verify session was not created
    expect(result.current.activeSessionId).toBeNull();
    expect(result.current.quizQuestions).toBeNull();
  });

  /**
   * Test: Exhausted question pool error for custom quiz
   * Requirement: 3.3
   */
  it('should throw error when no unseen questions are available for custom quiz', async () => {
    const unseenCount = 0;
    const totalCount = 15;
    const difficulty = 'hard';

    // Mock API responses
    vi.spyOn(api, 'fetchApi').mockResolvedValueOnce({ unseenCount, totalCount }); // unseen questions check

    const { result } = renderHook(() => useExamSession());

    // Attempt to start custom quiz with no unseen questions
    await expect(async () => {
      await result.current.startCustomQuiz(mockCertification, difficulty, 10);
    }).rejects.toThrow(
      'No unseen questions available for this difficulty. Consider resetting your question history to review questions again.',
    );

    // Verify session was not created
    expect(result.current.activeSessionId).toBeNull();
    expect(result.current.quizQuestions).toBeNull();
  });

  /**
   * Test: Exhausted question pool error for topic quiz
   * Requirement: 3.3
   */
  it('should throw error when no unseen questions are available for topic quiz', async () => {
    const unseenCount = 0;
    const totalCount = 20;

    // Mock API responses
    vi.spyOn(api, 'fetchApi').mockResolvedValueOnce({ unseenCount, totalCount }); // unseen questions check

    const { result } = renderHook(() => useExamSession());

    // Attempt to start topic quiz with no unseen questions
    await expect(async () => {
      await result.current.startTopicQuiz(mockCertification, mockTopic);
    }).rejects.toThrow(
      'No unseen questions available for this topic. Consider resetting your question history to review questions again.',
    );

    // Verify session was not created
    expect(result.current.activeSessionId).toBeNull();
    expect(result.current.quizQuestions).toBeNull();
  });

  /**
   * Test: Exhausted question pool error for subtopic quiz
   * Requirement: 3.3
   */
  it('should throw error when no unseen questions are available for subtopic quiz', async () => {
    const subtopicIds = ['subtopic-1', 'subtopic-2'];

    // Mock API responses - both subtopics have 0 unseen questions
    const fetchApiSpy = vi.spyOn(api, 'fetchApi');
    fetchApiSpy.mockResolvedValueOnce({ unseenCount: 0, totalCount: 10 });
    fetchApiSpy.mockResolvedValueOnce({ unseenCount: 0, totalCount: 10 });

    const { result } = renderHook(() => useExamSession());

    // Attempt to start subtopic quiz with no unseen questions
    await expect(async () => {
      await result.current.startSubtopicQuiz(mockCertification, mockTopic, subtopicIds);
    }).rejects.toThrow(
      'No unseen questions available for the selected subtopics. Consider resetting your question history to review questions again.',
    );

    // Verify session was not created
    expect(result.current.activeSessionId).toBeNull();
    expect(result.current.quizQuestions).toBeNull();
  });
});
