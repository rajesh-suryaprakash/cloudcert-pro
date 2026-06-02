/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import type { Question, ExamConfiguration, CloudProvider } from '../types';
import { fetchExamQuestions, createExamSession, fetchExamSession } from '../api/exams';
import { fetchApi } from '../api';
// fetchCertifications is available for callers that need it; not used internally
// import { fetchCertifications } from '../api/certifications';
import { DEFAULT_QUESTION_COUNT } from '../constants/exam';

export interface ExamSessionState {
  selectedProvider: CloudProvider | null;
  quizQuestions: Question[] | null;
  activeExam: ExamConfiguration | null;
  activeSessionId: string | null;
  historicalAttempt: any;
}

export function useExamSession() {
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[] | null>(null);
  const [activeExam, setActiveExam] = useState<ExamConfiguration | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historicalAttempt, setHistoricalAttempt] = useState<any>(null);

  const startQuiz = async (
    cert: any,
    exam: ExamConfiguration & {
      _difficulty?: string;
      isPracticeMode?: boolean;
      _numQuestions?: number;
      _duration?: number;
      _passingScore?: number;
    },
    isPracticeMode = false,
  ) => {
    try {
      const practiceMode = isPracticeMode || !!(exam as any).isPracticeMode;

      // Wizard overrides — these take priority over the exam config's stored values
      const numQuestionsOverride: number | undefined = (exam as any)._numQuestions;
      const difficultyOverride: string | undefined = (exam as any)._difficulty;
      const durationOverride: number | undefined = (exam as any)._duration;
      const passingScoreOverride: number | undefined = (exam as any)._passingScore;

      // Check unseen question count before fetching (question-history-tracking feature)
      const unseenData = await fetchApi(`/certifications/${cert.id}/questions/unseen`);
      const unseenCount: number = (unseenData as any)?.unseenCount ?? 0;
      const requestedCount = numQuestionsOverride ?? exam.totalQuestions ?? DEFAULT_QUESTION_COUNT;

      if (unseenCount === 0) {
        throw new Error(
          'No unseen questions available for this exam. Consider resetting your question history to review questions again.',
        );
      }

      if (unseenCount < requestedCount) {
        console.warn(
          `Only ${unseenCount} of ${requestedCount} requested questions are unseen. Some questions may have been seen before.`,
        );
      }

      // Fetch questions, passing wizard overrides so the server applies them
      const allQuestions = await fetchExamQuestions(exam.id, {
        count: numQuestionsOverride,
        difficulty: difficultyOverride,
      });

      if (allQuestions.length === 0) {
        throw new Error('No questions available for this exam configuration');
      }

      // Server already applied count + difficulty filter — use pool as-is
      // Enforce client-side count cap in case server returns more than requested
      const effectiveCount = numQuestionsOverride ?? exam.totalQuestions ?? DEFAULT_QUESTION_COUNT;
      const pool = allQuestions.slice(0, effectiveCount);

      if (pool.length === 0) {
        throw new Error(`No ${difficultyOverride} questions available for this exam`);
      }

      const sessionName = practiceMode ? `${exam.name} — Practice` : exam.name;

      // Resolve effective duration: wizard > exam config
      const effectiveDuration = practiceMode ? 999 : (durationOverride ?? exam.duration ?? 120);

      const session = await createExamSession({
        examConfigurationId: exam.id,
        questions: pool.map((q: Question) => q.id),
        isPracticeMode: practiceMode,
        sessionName,
        certificationId: cert.id,
        // Pass wizard overrides so the server stores them on the session row
        ...(durationOverride !== undefined && !practiceMode
          ? { durationMinutes: durationOverride }
          : {}),
        ...(passingScoreOverride !== undefined ? { passingScore: passingScoreOverride } : {}),
      });

      setQuizQuestions(pool);
      setSelectedProvider(cert.vendor);
      setActiveExam({
        ...exam,
        certificationId: cert.id,
        isPracticeMode: practiceMode,
        // Reflect wizard overrides in the active exam state so Quiz UI shows correct values
        totalQuestions: pool.length,
        duration: effectiveDuration,
        passingScore: passingScoreOverride ?? exam.passingScore,
      } as any);
      setActiveSessionId(session.id);
      setHistoricalAttempt(null);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startCustomQuiz = async (cert: any, difficulty: string, count: number) => {
    try {
      // Check unseen question count for this difficulty (question-history-tracking feature)
      const difficultyParam =
        difficulty && difficulty !== 'Mixed' ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
      const unseenData = await fetchApi(
        `/certifications/${cert.id}/questions/unseen${difficultyParam}`,
      );
      const unseenCount: number = (unseenData as any)?.unseenCount ?? 0;

      if (unseenCount === 0) {
        throw new Error(
          'No unseen questions available for this difficulty. Consider resetting your question history to review questions again.',
        );
      }

      if (unseenCount < count) {
        console.warn(
          `Only ${unseenCount} of ${count} requested questions are unseen. Some questions may have been seen before.`,
        );
      }

      const questions: Question[] = await fetchApi('/questions/select', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'certification',
          scopeId: cert.id,
          strategy: 'random',
          totalQuestions: count,
          difficulty: difficulty === 'Mixed' ? undefined : difficulty,
        }),
      });

      if (questions.length === 0) {
        throw new Error('No questions available for this difficulty');
      }

      // Enforce client-side count cap (server may return more than requested)
      const sliced = questions.slice(0, count);
      const actualCount = sliced.length;

      const session = await createExamSession({
        questions: sliced.map((q) => q.id),
        isPracticeMode: true,
        isCustomQuiz: true,
        certificationId: cert.id,
        sessionName: `${cert.title} — Custom Quiz — ${difficulty}`,
      });

      setQuizQuestions(sliced);
      setSelectedProvider(cert.vendor);
      setActiveExam({
        id: session.id,
        certificationId: cert.id,
        name: `Custom Quiz — ${difficulty} (${actualCount} questions)`,
        duration: 999,
        totalQuestions: actualCount,
        passingScore: 0,
        questionSelectionStrategy: 'random',
        topicWeights: {},
        isActive: true,
        isPracticeMode: true,
      } as any);
      setActiveSessionId(session.id);
      setHistoricalAttempt(null);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startTopicQuiz = async (
    cert: any,
    topic: any,
    config?: {
      difficulty?: string;
      numQuestions?: number;
      duration?: number;
      passingScore?: number;
    },
  ) => {
    try {
      const difficulty = config?.difficulty;
      const count = config?.numQuestions ?? DEFAULT_QUESTION_COUNT;

      // Check unseen question count for this topic (question-history-tracking feature)
      const unseenData = await fetchApi(
        `/certifications/${cert.id}/questions/unseen?topicId=${topic.id}`,
      );
      const unseenCount: number = (unseenData as any)?.unseenCount ?? 0;

      if (unseenCount === 0) {
        throw new Error(
          'No unseen questions available for this topic. Consider resetting your question history to review questions again.',
        );
      }

      if (unseenCount < count) {
        console.warn(
          `Only ${unseenCount} of ${count} requested questions are unseen. Some questions may have been seen before.`,
        );
      }

      const questions: Question[] = await fetchApi('/questions/select', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'topic',
          scopeId: topic.id,
          strategy: 'random',
          totalQuestions: count,
          difficulty: difficulty && difficulty !== 'Mixed' ? difficulty : undefined,
        }),
      });

      if (questions.length === 0) {
        throw new Error('No questions available for this topic');
      }

      // Enforce client-side count cap (server may return more than requested)
      const sliced = questions.slice(0, count);

      const duration = config?.duration ?? 999;
      const passingScore = config?.passingScore ?? 0;
      const isTimed = duration < 999;

      const session = await createExamSession({
        questions: sliced.map((q) => q.id),
        isPracticeMode: !isTimed,
        certificationId: cert.id,
        sessionName: `${cert.title} — ${topic.title} — Topic Practice`,
      });

      setQuizQuestions(sliced);
      setSelectedProvider(cert.vendor);
      setActiveExam({
        id: session.id,
        certificationId: cert.id,
        name: `${topic.title} — Practice`,
        duration,
        totalQuestions: questions.length,
        passingScore,
        questionSelectionStrategy: 'random',
        topicWeights: {},
        isActive: true,
        isPracticeMode: !isTimed,
      } as any);
      setActiveSessionId(session.id);
      setHistoricalAttempt(null);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startSubtopicQuiz = async (cert: any, topic: any, subtopicIds: string[]) => {
    try {
      // Check unseen question count for each subtopic (question-history-tracking feature)
      const unseenChecks = await Promise.all(
        subtopicIds.map((subtopicId) =>
          fetchApi(`/certifications/${cert.id}/questions/unseen?subtopicId=${subtopicId}`),
        ),
      );
      const totalUnseen = unseenChecks.reduce(
        (sum: number, data: any) => sum + ((data as any)?.unseenCount ?? 0),
        0,
      );

      if (totalUnseen === 0) {
        throw new Error(
          'No unseen questions available for the selected subtopics. Consider resetting your question history to review questions again.',
        );
      }

      // Phase 2: fetch questions per-subtopic in parallel and combine
      // (each subtopic gets its own /questions/select call so results are traceable)
      const questionArrays = await Promise.all(
        subtopicIds.map((subtopicId) =>
          fetchApi('/questions/select', {
            method: 'POST',
            body: JSON.stringify({
              scope: 'subtopics',
              scopeId: [subtopicId],
              strategy: 'random',
              totalQuestions: 9999, // server caps at pool size
            }),
          }),
        ),
      );

      const questions: Question[] = (questionArrays as Question[][]).flat();

      if (questions.length === 0) {
        throw new Error('No questions available for the selected subtopics');
      }

      const session = await createExamSession({
        questions: questions.map((q) => q.id),
        isPracticeMode: true,
        certificationId: cert.id,
        sessionName: `${cert.title} — ${topic.title} — Subtopic Practice`,
      });

      setQuizQuestions(questions);
      setSelectedProvider(cert.vendor);
      setActiveExam({
        id: session.id,
        certificationId: cert.id,
        name: `${topic.title} — Subtopic Practice`,
        duration: 999,
        totalQuestions: questions.length,
        passingScore: 0,
        questionSelectionStrategy: 'random',
        topicWeights: {},
        isActive: true,
        isPracticeMode: true,
      } as any);
      setActiveSessionId(session.id);
      setHistoricalAttempt(null);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const viewHistoricalAttempt = async (attempt: any) => {
    try {
      const session = await fetchExamSession(attempt.id);

      // Fetch questions directly from the session (works for all session types)
      const questions: any[] = await fetchApi(`/exam-sessions/${attempt.id}/questions`);

      if (questions.length === 0) {
        throw new Error('No questions available for this historical session');
      }

      const sessionQuestionIds: string[] = session.questions;
      const sessionQuestions = questions.filter((q: any) => sessionQuestionIds.includes(q.id));
      sessionQuestions.sort(
        (a: any, b: any) => sessionQuestionIds.indexOf(a.id) - sessionQuestionIds.indexOf(b.id),
      );

      setQuizQuestions(sessionQuestions);
      setHistoricalAttempt({
        ...session,
        answers: session.answers.map((a: any) => ({
          ...a,
          selectedOptions: a.userAnswer,
        })),
      });
      setActiveExam(null);
      setActiveSessionId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const reset = () => {
    setSelectedProvider(null);
    setQuizQuestions(null);
    setActiveExam(null);
    setActiveSessionId(null);
    setHistoricalAttempt(null);
  };

  return {
    selectedProvider,
    quizQuestions,
    activeExam,
    activeSessionId,
    historicalAttempt,
    startQuiz,
    startTopicQuiz,
    startSubtopicQuiz,
    startCustomQuiz,
    viewHistoricalAttempt,
    reset,
  };
}
