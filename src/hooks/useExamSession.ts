import { useSessionState } from './useSessionState';
import { useSessionRestoration } from './useSessionRestoration';
import { useSessionCreation } from './useSessionCreation';

export { useSessionState } from './useSessionState';
export { useSessionRestoration } from './useSessionRestoration';
export { useSessionCreation } from './useSessionCreation';

export function useExamSession() {
  const state = useSessionState();
  const restoration = useSessionRestoration(state);
  const creation = useSessionCreation(state);

  return {
    selectedProvider: state.selectedProvider,
    quizQuestions: state.quizQuestions,
    activeExam: state.activeExam,
    activeSessionId: state.activeSessionId,
    historicalAttempt: state.historicalAttempt,
    restoringSession: state.restoringSession,
    initialIsPaused: state.initialIsPaused,
    initialTimeLeft: state.initialTimeLeft,
    initialAnswers: state.initialAnswers,

    resumeActiveSession: restoration.resumeActiveSession,

    startQuiz: creation.startQuiz,
    startCustomQuiz: creation.startCustomQuiz,
    startTopicQuiz: creation.startTopicQuiz,
    startSubtopicQuiz: creation.startSubtopicQuiz,
    viewHistoricalAttempt: creation.viewHistoricalAttempt,
    reset: creation.reset,
  };
}
