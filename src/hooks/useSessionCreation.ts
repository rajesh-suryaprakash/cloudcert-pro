import type {
  Question,
  ExamConfiguration,
  Certification,
  Topic,
  WizardExamConfig,
  ExamSession,
  SessionAnswer,
} from '../types';
import { fetchExamQuestions, createExamSession, fetchExamSession } from '../api/exams';
import { fetchApi } from '../api/client';
import { DEFAULT_QUESTION_COUNT } from '../constants/exam';
import type { SessionState } from './useSessionState';

export function useSessionCreation(state: SessionState) {
  const startQuiz = async (
    cert: Pick<Certification, 'id' | 'title' | 'vendor'>,
    exam: WizardExamConfig,
    isPracticeMode = false,
  ) => {
    try {
      const practiceMode = isPracticeMode || !!exam.isPracticeMode;

      // Wizard overrides
      const numQuestionsOverride = exam._numQuestions;
      const difficultyOverride = exam._difficulty;
      const durationOverride = exam._duration;
      const passingScoreOverride = exam._passingScore;

      // Check unseen question count
      const unseenData = (await fetchApi(`/certifications/${cert.id}/questions/unseen`)) as {
        unseenCount?: number;
      } | null;
      const unseenCount = unseenData?.unseenCount ?? 0;
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

      // Fetch questions
      const allQuestions = (await fetchExamQuestions(exam.id, {
        count: numQuestionsOverride,
        difficulty: difficultyOverride,
      })) as Question[];

      if (allQuestions.length === 0) {
        throw new Error('No questions available for this exam configuration');
      }

      const effectiveCount = numQuestionsOverride ?? exam.totalQuestions ?? DEFAULT_QUESTION_COUNT;
      const pool = allQuestions.slice(0, effectiveCount);

      if (pool.length === 0) {
        throw new Error(`No ${difficultyOverride} questions available for this exam`);
      }

      const sessionName = practiceMode ? `${exam.name} — Practice` : exam.name;
      const effectiveDuration = practiceMode ? 999 : (durationOverride ?? exam.duration ?? 120);

      const session = (await createExamSession({
        examConfigurationId: exam.id,
        questions: pool.map((q: Question) => q.id),
        isPracticeMode: practiceMode,
        sessionName,
        certificationId: cert.id,
        ...(durationOverride !== undefined && !practiceMode
          ? { durationMinutes: durationOverride }
          : {}),
        ...(passingScoreOverride !== undefined ? { passingScore: passingScoreOverride } : {}),
      })) as { id: string };

      state.setQuizQuestions(pool);
      state.setSelectedProvider(cert.vendor);
      state.setActiveExam({
        ...exam,
        certificationId: cert.id,
        isPracticeMode: practiceMode,
        totalQuestions: pool.length,
        duration: effectiveDuration,
        passingScore: passingScoreOverride ?? exam.passingScore,
      } as ExamConfiguration);
      state.setActiveSessionId(session.id);
      state.setHistoricalAttempt(null);
      state.setInitialIsPaused(false);
      state.setInitialTimeLeft(undefined);
      state.setInitialAnswers([]);
      if (!practiceMode) {
        localStorage.setItem('active_exam_session_id', session.id);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startCustomQuiz = async (
    cert: Pick<Certification, 'id' | 'title' | 'vendor'>,
    difficulty: string,
    count: number,
  ) => {
    try {
      const difficultyParam =
        difficulty && difficulty !== 'Mixed' ? `?difficulty=${encodeURIComponent(difficulty)}` : '';
      const unseenData = (await fetchApi(
        `/certifications/${cert.id}/questions/unseen${difficultyParam}`,
      )) as { unseenCount?: number } | null;
      const unseenCount = unseenData?.unseenCount ?? 0;

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

      const sliced = questions.slice(0, count);
      const actualCount = sliced.length;

      const session = (await createExamSession({
        questions: sliced.map((q) => q.id),
        isPracticeMode: true,
        isCustomQuiz: true,
        certificationId: cert.id,
        sessionName: `${cert.title} — Custom Quiz — ${difficulty}`,
      })) as { id: string };

      state.setQuizQuestions(sliced);
      state.setSelectedProvider(cert.vendor);
      state.setActiveExam({
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.setActiveSessionId(session.id);
      state.setHistoricalAttempt(null);
      state.setInitialIsPaused(false);
      state.setInitialTimeLeft(undefined);
      state.setInitialAnswers([]);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startTopicQuiz = async (
    cert: Pick<Certification, 'id' | 'title' | 'vendor'>,
    topic: Pick<Topic, 'id' | 'title' | 'certificationId'>,
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

      const unseenData = (await fetchApi(
        `/certifications/${cert.id}/questions/unseen?topicId=${topic.id}`,
      )) as { unseenCount?: number } | null;
      const unseenCount = unseenData?.unseenCount ?? 0;

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

      const sliced = questions.slice(0, count);

      const duration = config?.duration ?? 999;
      const passingScore = config?.passingScore ?? 0;
      const isTimed = duration < 999;

      const session = (await createExamSession({
        questions: sliced.map((q) => q.id),
        isPracticeMode: !isTimed,
        certificationId: cert.id,
        sessionName: `${cert.title} — ${topic.title} — Topic Practice`,
      })) as { id: string };

      state.setQuizQuestions(sliced);
      state.setSelectedProvider(cert.vendor);
      state.setActiveExam({
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.setActiveSessionId(session.id);
      state.setHistoricalAttempt(null);
      state.setInitialIsPaused(false);
      state.setInitialTimeLeft(undefined);
      state.setInitialAnswers([]);
      if (isTimed) {
        localStorage.setItem('active_exam_session_id', session.id);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startSubtopicQuiz = async (
    cert: Pick<Certification, 'id' | 'title' | 'vendor'>,
    topic: Pick<Topic, 'id' | 'title' | 'certificationId'>,
    subtopicIds: string[],
  ) => {
    try {
      const unseenChecks = await Promise.all(
        subtopicIds.map(
          (subtopicId) =>
            fetchApi(
              `/certifications/${cert.id}/questions/unseen?subtopicId=${subtopicId}`,
            ) as Promise<{ unseenCount?: number } | null>,
        ),
      );
      const totalUnseen = unseenChecks.reduce(
        (sum: number, data) => sum + (data?.unseenCount ?? 0),
        0,
      );

      if (totalUnseen === 0) {
        throw new Error(
          'No unseen questions available for the selected subtopics. Consider resetting your question history to review questions again.',
        );
      }

      const questionArrays = await Promise.all(
        subtopicIds.map(
          (subtopicId) =>
            fetchApi('/questions/select', {
              method: 'POST',
              body: JSON.stringify({
                scope: 'subtopics',
                scopeId: [subtopicId],
                strategy: 'random',
                totalQuestions: 9999,
              }),
            }) as Promise<Question[]>,
        ),
      );

      const questions: Question[] = questionArrays.flat();

      if (questions.length === 0) {
        throw new Error('No questions available for the selected subtopics');
      }

      const session = (await createExamSession({
        questions: questions.map((q) => q.id),
        isPracticeMode: true,
        certificationId: cert.id,
        sessionName: `${cert.title} — ${topic.title} — Subtopic Practice`,
      })) as { id: string };

      state.setQuizQuestions(questions);
      state.setSelectedProvider(cert.vendor);
      state.setActiveExam({
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.setActiveSessionId(session.id);
      state.setHistoricalAttempt(null);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const viewHistoricalAttempt = async (attempt: { id: string }) => {
    try {
      const session = (await fetchExamSession(attempt.id)) as ExamSession & {
        answers: SessionAnswer[];
      };
      const questions: Question[] = await fetchApi(`/exam-sessions/${attempt.id}/questions`);

      if (questions.length === 0) {
        throw new Error('No questions available for this historical session');
      }

      const sessionQuestionIds: string[] = session.questions;
      const sessionQuestions = questions.filter((q) => sessionQuestionIds.includes(q.id));
      sessionQuestions.sort(
        (a, b) => sessionQuestionIds.indexOf(a.id) - sessionQuestionIds.indexOf(b.id),
      );

      state.setQuizQuestions(sessionQuestions);
      state.setHistoricalAttempt({
        ...session,
        answers: session.answers.map((a) => ({
          ...a,
          selectedOptions: a.userAnswer,
        })),
      });
      state.setActiveExam(null);
      state.setActiveSessionId(null);
      state.setInitialIsPaused(false);
      state.setInitialTimeLeft(undefined);
      state.setInitialAnswers([]);
    } catch (e) {
      console.error(e);
    }
  };

  const reset = () => {
    state.setSelectedProvider(null);
    state.setQuizQuestions(null);
    state.setActiveExam(null);
    state.setActiveSessionId(null);
    state.setHistoricalAttempt(null);
    state.setInitialIsPaused(false);
    state.setInitialTimeLeft(undefined);
    state.setInitialAnswers([]);
    localStorage.removeItem('active_exam_session_id');
  };

  return {
    startQuiz,
    startCustomQuiz,
    startTopicQuiz,
    startSubtopicQuiz,
    viewHistoricalAttempt,
    reset,
  };
}
