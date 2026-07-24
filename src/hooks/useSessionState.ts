import { useState } from 'react';
import type {
  Question,
  ExamConfiguration,
  CloudProvider,
  HistoricalAttempt,
  SessionAnswer,
} from '../types';

export function useSessionState() {
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[] | null>(null);
  const [activeExam, setActiveExam] = useState<ExamConfiguration | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historicalAttempt, setHistoricalAttempt] = useState<HistoricalAttempt | null>(null);
  const [initialIsPaused, setInitialIsPaused] = useState<boolean>(false);
  const [initialTimeLeft, setInitialTimeLeft] = useState<number | undefined>(undefined);
  const [initialAnswers, setInitialAnswers] = useState<SessionAnswer[]>([]);
  const [restoringSession, setRestoringSession] = useState<boolean>(true);

  return {
    selectedProvider,
    setSelectedProvider,
    quizQuestions,
    setQuizQuestions,
    activeExam,
    setActiveExam,
    activeSessionId,
    setActiveSessionId,
    historicalAttempt,
    setHistoricalAttempt,
    initialIsPaused,
    setInitialIsPaused,
    initialTimeLeft,
    setInitialTimeLeft,
    initialAnswers,
    setInitialAnswers,
    restoringSession,
    setRestoringSession,
  };
}
export type SessionState = ReturnType<typeof useSessionState>;
