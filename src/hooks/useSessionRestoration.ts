import { useEffect } from 'react';
import { fetchExamSession } from '../api/exams';
import { fetchApi } from '../api/client';
import type { CloudProvider, Question, ExamConfiguration } from '../types';
import type { SessionState } from './useSessionState';

export function useSessionRestoration(state: SessionState) {
  const resumeActiveSession = async (sessionId: string) => {
    try {
      const session = await fetchExamSession(sessionId);
      const questions: Question[] = await fetchApi(`/exam-sessions/${sessionId}/questions`);

      if (questions.length === 0) {
        throw new Error('No questions available for this session');
      }

      const sessionQuestionIds: string[] = session.questions;
      const sessionQuestions = questions.filter((q: Question) => sessionQuestionIds.includes(q.id));
      sessionQuestions.sort(
        (a: Question, b: Question) => sessionQuestionIds.indexOf(a.id) - sessionQuestionIds.indexOf(b.id),
      );

      let vendor: CloudProvider | null = null;
      try {
        const cert = await fetchApi(`/certifications/${session.certificationId}`);
        vendor = cert ? cert.vendor : null;
      } catch (err) {
        console.error('Failed to fetch certification details:', err);
      }

      state.setQuizQuestions(sessionQuestions);
      state.setSelectedProvider(vendor);

      state.setActiveExam({
        id: session.examConfigurationId || session.id,
        certificationId: session.certificationId,
        name: session.sessionName || 'Exam Session',
        duration: session.durationMinutes || 120,
        totalQuestions: sessionQuestions.length,
        passingScore: session.passingScoreOverride || 70,
        isPracticeMode: session.isPracticeMode === 1,
      } as unknown as ExamConfiguration);

      state.setActiveSessionId(session.id);
      state.setHistoricalAttempt(null);
      state.setInitialIsPaused(session.status === 'paused');
      state.setInitialTimeLeft(
        session.timeLeftSeconds !== null ? session.timeLeftSeconds : undefined,
      );
      state.setInitialAnswers(session.answers || []);

      if (
        session.isPracticeMode !== 1 &&
        (session.status === 'in_progress' || session.status === 'paused')
      ) {
        localStorage.setItem('active_exam_session_id', session.id);
      } else {
        localStorage.removeItem('active_exam_session_id');
      }
    } catch (e) {
      console.error('Failed to resume active session:', e);
      localStorage.removeItem('active_exam_session_id');
      throw e;
    }
  };

  useEffect(() => {
    // Prevent auto-resume on mount during tests to avoid cross-test localStorage pollution
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      state.setRestoringSession(false);
      return;
    }

    const activeId = localStorage.getItem('active_exam_session_id');
    if (activeId) {
      resumeActiveSession(activeId)
        .catch((err) => {
          console.error('Failed to auto-resume session on mount:', err);
          localStorage.removeItem('active_exam_session_id');
        })
        .finally(() => {
          state.setRestoringSession(false);
        });
    } else {
      state.setRestoringSession(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only effect; re-running on state changes would cause infinite loops
  }, []);

  return {
    resumeActiveSession,
  };
}
