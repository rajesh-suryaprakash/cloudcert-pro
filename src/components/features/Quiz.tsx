import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react';
import type {
  Question,
  QuizState,
  QuizResult,
  ExamConfiguration,
  ConfidenceMatrix,
  HistoricalAttempt,
  SessionAnswer,
  Certification,
  Topic,
} from '../../types';
import { fetchApi } from '../../api/client';
import { pauseExamSession, resumeExamSession } from '../../api/exams';
import { useAuth } from '../../hooks/useAuth';
import { useKeyboardShortcuts } from '../../contexts/KeyboardShortcutContext';
import { isAnswerCorrect } from '../../utils/answerUtils';
import type { DetailedResult } from '../../server/services/ExamGradingService';
import { QuizReviewScreen } from './quiz/QuizReviewScreen';
import { QuizResultsView } from './quiz/QuizResultsView';
import { QuizQuestionView } from './quiz/QuizQuestionView';
import { QuizSidebar } from './quiz/QuizSidebar';

type TaskType = 'review_wrong_answers' | 'practice_quiz' | 'read_docs';

interface WeakTopic {
  topicId: string;
  topicTitle: string;
  incorrectCount: number;
  docUrl: string | null;
}

interface StudyPlanCompletion {
  topicId: string;
  taskType: TaskType;
}

interface QuizProps {
  questions: Question[];
  examConfig?: ExamConfiguration;
  sessionId?: string;
  historicalAttempt?: HistoricalAttempt;
  onFinish: (result: QuizResult) => void;
  onReset: () => void;
  onStartTopicQuiz?: (cert: Certification, topic: Topic) => void;
  onViewInsights?: (certId: string, certTitle: string, sessionId?: string) => void;
  initialIsPaused?: boolean;
  initialTimeLeft?: number;
  initialAnswers?: SessionAnswer[];
}

export default function Quiz({
  questions,
  examConfig,
  sessionId,
  historicalAttempt,
  onFinish: _onFinish,
  onReset,
  onStartTopicQuiz: _onStartTopicQuiz,
  onViewInsights,
  initialIsPaused = false,
  initialTimeLeft,
  initialAnswers = [],
}: QuizProps) {
  const { user } = useAuth();
  const { shortcutsEnabled } = useKeyboardShortcuts();

  // Prevent browser back/forward navigation on horizontal swipe/scroll during quiz
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // If horizontal scroll is greater than vertical, it's a swipe
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
      }
    };

    // We must use passive: false to be able to call preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);
  const [quizState, setQuizState] = useState<QuizState>({
    questions,
    currentQuestionIndex: 0,
    userAnswers: (() => {
      if (historicalAttempt) {
        return historicalAttempt.answers.map((a: SessionAnswer) => a.selectedOptions);
      }
      if (initialAnswers && initialAnswers.length > 0) {
        return questions.map((q) => {
          const saved = initialAnswers.find((a: SessionAnswer) => a.questionId === q.id);
          return saved ? saved.userAnswer : null;
        });
      }
      return new Array(questions.length).fill(null);
    })(),
    isFinished: !!historicalAttempt,
    startTime: historicalAttempt ? historicalAttempt.startTime : Date.now(),
    endTime: historicalAttempt ? historicalAttempt.endTime : null,
  });
  const [confidenceMatrix, setConfidenceMatrix] = useState<ConfidenceMatrix | null>(null);
  const [_percentileRank, setPercentileRank] = useState<number | null>(null);
  const [submitDetailedResults, setSubmitDetailedResults] = useState<DetailedResult[]>([]);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [studyPlan, setStudyPlan] = useState<WeakTopic[] | null>(null);

  // Task 6.1: completions state — keyed as `${topicId}:${taskType}`
  const [completions, setCompletions] = useState<Set<string>>(new Set());

  // Task 6.3: which topic's wrong-answer panel is open
  const [openReviewTopicId, setOpenReviewTopicId] = useState<string | null>(null);

  // Task 6.4: per-topic disabled state for practice quiz (no questions available)
  const [_disabledPracticeTopics, _setDisabledPracticeTopics] = useState<Set<string>>(new Set());

  // Phase 3: Realistic Exam Interface State
  const isPracticeMode = !!examConfig?.isPracticeMode;
  const [timeLeft, setTimeLeft] = useState(() => {
    if (initialTimeLeft !== undefined && initialTimeLeft !== null) return initialTimeLeft;
    return (examConfig?.duration || 120) * 60;
  });
  const [flagged, setFlagged] = useState<boolean[]>(() => {
    if (initialAnswers && initialAnswers.length > 0) {
      return questions.map((q) => {
        const saved = initialAnswers.find((a: SessionAnswer) => a.questionId === q.id);
        return saved ? !!saved.markedForReview : false;
      });
    }
    return new Array(questions.length).fill(false);
  });
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showReviewAnswers, setShowReviewAnswers] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [questionTimes, setQuestionTimes] = useState<number[]>(() => {
    if (initialAnswers && initialAnswers.length > 0) {
      return questions.map((q) => {
        const saved = initialAnswers.find((a: SessionAnswer) => a.questionId === q.id);
        return saved ? saved.timeSpent || 0 : 0;
      });
    }
    return new Array(questions.length).fill(0);
  });
  const [confidenceLevels, setConfidenceLevels] = useState<(number | null)[]>(() => {
    if (initialAnswers && initialAnswers.length > 0) {
      return questions.map((q) => {
        const saved = initialAnswers.find((a: SessionAnswer) => a.questionId === q.id);
        return saved && saved.confidenceLevel !== null ? Number(saved.confidenceLevel) : null;
      });
    }
    return new Array(questions.length).fill(null);
  });

  /**
   * Pause / Resume state.
   * isPaused – whether the exam timer is currently stopped.
   * isPauseLoading – in-flight API call guard (prevents double-clicks).
   * pauseError – surface transient API errors without crashing the exam.
   */
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [isPauseLoading, setIsPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  // Stable ref so the timer useEffect can call the latest finishQuiz without stale closure
  const finishQuizRef = useRef<() => void>(() => {});

  // Task 6.1: Load study plan + completions together
  useEffect(() => {
    if (!quizState.isFinished || !sessionId || historicalAttempt) return;
    fetchApi(`/exam-sessions/${sessionId}/study-plan`)
      .then((res) => {
        if (res?.weakTopics) setStudyPlan(res.weakTopics);
        if (Array.isArray(res?.completions)) {
          const keys = (res.completions as StudyPlanCompletion[]).map(
            (c) => `${c.topicId}:${c.taskType}`,
          );
          setCompletions(new Set(keys));
        }
      })
      .catch((e) => console.error('Failed to fetch study plan:', e));
  }, [quizState.isFinished, sessionId, historicalAttempt]);

  useEffect(() => {
    if (quizState.isFinished || showReviewScreen || isPracticeMode || isPaused) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishQuizRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [quizState.isFinished, showReviewScreen, isPracticeMode, isPaused]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /**
   * Pause the exam timer.
   * Calls the server to record the pause timestamp, then stops the local interval
   * via isPaused. The question-time accumulator is also frozen.
   */
  const handlePause = useCallback(async () => {
    if (!sessionId || isPaused || isPauseLoading || quizState.isFinished || isPracticeMode) return;
    setIsPauseLoading(true);
    setPauseError(null);
    try {
      // Freeze the elapsed time for the current question before pausing
      const elapsedOnCurrentQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
      const updatedTimes = [...questionTimes];
      updatedTimes[quizState.currentQuestionIndex] += elapsedOnCurrentQuestion;
      setQuestionTimes(updatedTimes);
      // Reset so that when the user resumes, questionStartTime is fresh
      setQuestionStartTime(Date.now());

      await pauseExamSession(sessionId);
      setIsPaused(true);
    } catch (err) {
      console.error('Failed to pause session:', err);
      setPauseError('Could not pause the exam. Please try again.');
    } finally {
      setIsPauseLoading(false);
    }
  }, [
    sessionId,
    isPaused,
    isPauseLoading,
    quizState.isFinished,
    isPracticeMode,
    questionStartTime,
    questionTimes,
    quizState.currentQuestionIndex,
  ]);

  /**
   * Resume the exam timer.
   * Calls the server which shifts autoSubmitAt forward by the pause duration and
   * returns the authoritative remaining seconds. We update timeLeft from the server
   * response so the client is always in sync (handles refresh, clock skew, etc.).
   */
  const handleResume = useCallback(async () => {
    if (!sessionId || !isPaused || isPauseLoading) return;
    setIsPauseLoading(true);
    setPauseError(null);
    try {
      const res = await resumeExamSession(sessionId);
      // Sync the countdown to the server's authoritative remaining time
      setTimeLeft(res.timeLeftSeconds);
      setQuestionStartTime(Date.now());
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to resume session:', err);
      setPauseError('Could not resume the exam. Please try again.');
    } finally {
      setIsPauseLoading(false);
    }
  }, [sessionId, isPaused, isPauseLoading]);

  // Task 6.2: markComplete helper
  const markComplete = useCallback(
    async (topicId: string, taskType: TaskType) => {
      if (!sessionId) return;
      const key = `${topicId}:${taskType}`;
      if (completions.has(key)) return;
      try {
        await fetchApi('/study-plan-completions', {
          method: 'POST',
          body: JSON.stringify({ sessionId, topicId, taskType }),
        });
        setCompletions((prev) => new Set([...prev, key]));
      } catch (e) {
        console.error('Failed to mark completion:', e);
      }
    },
    [sessionId, completions],
  );

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await fetchApi(`/exam-sessions/${sessionId}/abandon`, { method: 'POST' });
      } catch (e) {
        console.error('Failed to abandon session:', e);
      }
    }
    onReset();
  };

  const mapConfidenceLevel = (confidence: number | null): number | null => {
    // Confidence is now directly a number from 1-5
    return confidence;
  };

  const saveAnswer = useCallback(
    async (
      index: number,
      answers: (string | string[] | null)[],
      isFlagged: boolean,
      confidence: number | null = null,
    ) => {
      if (!sessionId || isPaused) return;
      const q = quizState.questions[index];
      const userAns = answers[index];

      const timeSpentOnQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
      const totalTimeOnQuestion = questionTimes[index] + timeSpentOnQuestion;

      const mappedConfidence = mapConfidenceLevel(confidence);

      try {
        await fetchApi(`/exam-sessions/${sessionId}/answers`, {
          method: 'POST',
          body: JSON.stringify({
            questionId: q.id,
            userAnswer: userAns,
            markedForReview: isFlagged,
            confidenceLevel: mappedConfidence,
            answerOrder: index,
            timeSpent: totalTimeOnQuestion,
          }),
        });
      } catch (e) {
        console.error('Failed to save answer:', e);
      }
    },
    [sessionId, isPaused, quizState.questions, questionStartTime, questionTimes],
  );

  const handleAnswer = async (option: string) => {
    if (quizState.isFinished) return;
    const q = quizState.questions[quizState.currentQuestionIndex];
    const newAnswers = [...quizState.userAnswers];

    let selectedOptions: string[];
    if (q.questionType === 'multiple') {
      const current = Array.isArray(newAnswers[quizState.currentQuestionIndex])
        ? [...(newAnswers[quizState.currentQuestionIndex] as string[])]
        : [];

      if (current.includes(option)) {
        selectedOptions = current.filter((o) => o !== option);
      } else {
        selectedOptions = [...current, option];
      }
    } else {
      selectedOptions = [option];
    }

    const finalAnswer = q.questionType === 'multiple' ? selectedOptions : option;
    newAnswers[quizState.currentQuestionIndex] = finalAnswer;
    setQuizState({ ...quizState, userAnswers: newAnswers });

    saveAnswer(
      quizState.currentQuestionIndex,
      newAnswers,
      flagged[quizState.currentQuestionIndex],
      confidenceLevels[quizState.currentQuestionIndex],
    );
  };

  const nextQuestion = useCallback(() => {
    saveAnswer(
      quizState.currentQuestionIndex,
      quizState.userAnswers,
      flagged[quizState.currentQuestionIndex],
      confidenceLevels[quizState.currentQuestionIndex],
    );

    const timeSpentOnQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
    const newQuestionTimes = [...questionTimes];
    newQuestionTimes[quizState.currentQuestionIndex] += timeSpentOnQuestion;
    setQuestionTimes(newQuestionTimes);
    setQuestionStartTime(Date.now());

    if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
      setQuizState({ ...quizState, currentQuestionIndex: quizState.currentQuestionIndex + 1 });
    } else {
      setShowReviewScreen(true);
    }
  }, [quizState, flagged, confidenceLevels, questionStartTime, questionTimes, saveAnswer]);

  const prevQuestion = useCallback(() => {
    saveAnswer(
      quizState.currentQuestionIndex,
      quizState.userAnswers,
      flagged[quizState.currentQuestionIndex],
      confidenceLevels[quizState.currentQuestionIndex],
    );

    const timeSpentOnQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
    const newQuestionTimes = [...questionTimes];
    newQuestionTimes[quizState.currentQuestionIndex] += timeSpentOnQuestion;
    setQuestionTimes(newQuestionTimes);
    setQuestionStartTime(Date.now());

    if (quizState.currentQuestionIndex > 0) {
      setQuizState({ ...quizState, currentQuestionIndex: quizState.currentQuestionIndex - 1 });
    }
  }, [quizState, flagged, confidenceLevels, questionStartTime, questionTimes, saveAnswer]);

  const stateRef = useRef({
    currentQuestionIndex: quizState.currentQuestionIndex,
    isFinished: quizState.isFinished,
    isPaused,
    isPauseLoading,
    showReviewScreen,
  });

  useEffect(() => {
    stateRef.current = {
      currentQuestionIndex: quizState.currentQuestionIndex,
      isFinished: quizState.isFinished,
      isPaused,
      isPauseLoading,
      showReviewScreen,
    };
  }, [
    quizState.currentQuestionIndex,
    quizState.isFinished,
    isPaused,
    isPauseLoading,
    showReviewScreen,
  ]);

  const callbacksRef = useRef({
    prevQuestion,
    nextQuestion,
    handlePause,
    handleResume,
  });

  useEffect(() => {
    callbacksRef.current = {
      prevQuestion,
      nextQuestion,
      handlePause,
      handleResume,
    };
  }, [prevQuestion, nextQuestion, handlePause, handleResume]);

  // Keyboard navigation for Previous (Left Arrow), Next (Right Arrow), Pause/Resume (Space Bar)
  useEffect(() => {
    if (!shortcutsEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        isFinished,
        showReviewScreen: reviewOpen,
        currentQuestionIndex: idx,
        isPaused: paused,
        isPauseLoading: loading,
      } = stateRef.current;

      // Shortcuts are disabled if quiz is finished or review screen is active
      if (isFinished || reviewOpen) {
        return;
      }

      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInputFocused) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        // If not at the first question, not loading, and not paused
        if (idx > 0 && !loading && !paused) {
          event.preventDefault();
          callbacksRef.current.prevQuestion();
        }
      } else if (event.key === 'ArrowRight') {
        // If not loading and not paused
        if (!loading && !paused) {
          event.preventDefault();
          callbacksRef.current.nextQuestion();
        }
      } else if (event.key === ' ' || event.key === 'Spacebar') {
        // Accessibility guard: Do not intercept Space if focus is on an interactive button or anchor link
        if (target.tagName === 'BUTTON' || target.tagName === 'A') {
          return;
        }

        // Space bar for Pause / Resume
        if (sessionId && !isPracticeMode && !loading) {
          event.preventDefault();
          if (paused) {
            callbacksRef.current.handleResume();
          } else {
            callbacksRef.current.handlePause();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sessionId, isPracticeMode, shortcutsEnabled]);

  const finishQuiz = useCallback(async () => {
    const endTime = Date.now();
    let correct = 0;
    const breakdown: Record<string, { correct: number; total: number }> = {};

    quizState.questions.forEach((q, i) => {
      const cat = q.tags?.[0] || 'General';
      if (!breakdown[cat]) breakdown[cat] = { correct: 0, total: 0 };
      breakdown[cat].total++;

      const userAns = quizState.userAnswers[i];
      const isCorrect = isAnswerCorrect(q, userAns);

      if (isCorrect) {
        correct++;
        breakdown[cat].correct++;
      }
    });

    const score = (correct / quizState.questions.length) * 100;

    if (user && !historicalAttempt) {
      try {
        if (sessionId) {
          const submitRes = await fetchApi(`/exam-sessions/${sessionId}/submit`, {
            method: 'POST',
          });
          if (submitRes) {
            if (submitRes.confidenceMatrix) setConfidenceMatrix(submitRes.confidenceMatrix);
            if (submitRes.percentileRank !== undefined) setPercentileRank(submitRes.percentileRank);
            if (submitRes.detailedResults) setSubmitDetailedResults(submitRes.detailedResults);
            if (submitRes.passed !== undefined) setPassed(submitRes.passed);
          }
        } else {
          await fetchApi('/attempts', {
            method: 'POST',
            body: JSON.stringify({
              certificationId: examConfig?.certificationId || 'unknown',
              examConfigurationId: examConfig?.id || 'practice',
              score,
              totalQuestions: quizState.questions.length,
              startTime: quizState.startTime,
              endTime,
              answers: quizState.userAnswers.map((ans, i) => {
                const q = questions[i];
                return {
                  questionId: q.id,
                  selectedOptions: ans,
                  isCorrect: isAnswerCorrect(q, ans),
                };
              }),
            }),
          });
        }
      } catch (e) {
        console.error('Failed to submit exam session:', e);
      }
    }

    setQuizState((prev) => ({ ...prev, isFinished: true, endTime }));
    setShowReviewScreen(false);
    // Don't call onFinish automatically - let user stay on review page
    // onFinish(result) should only be called when user explicitly navigates away
  }, [quizState, user, historicalAttempt, sessionId, examConfig, questions]);

  useEffect(() => {
    finishQuizRef.current = finishQuiz;
  }, [finishQuiz]);

  if (quizState.isFinished) {
    const correctCount = quizState.userAnswers.filter((ans, i) => {
      const q = quizState.questions[i];
      return isAnswerCorrect(q, ans);
    }).length;
    const totalCount = quizState.questions.length;
    const scorePercent = Math.round((correctCount / totalCount) * 100);

    return (
      <QuizResultsView
        historicalAttempt={historicalAttempt}
        scorePercent={scorePercent}
        correctCount={correctCount}
        totalCount={totalCount}
        passed={passed}
        confidenceMatrix={confidenceMatrix}
        studyPlan={studyPlan}
        completions={completions}
        openReviewTopicId={openReviewTopicId}
        setOpenReviewTopicId={setOpenReviewTopicId}
        onMarkComplete={markComplete}
        submitDetailedResults={submitDetailedResults}
        quizState={quizState}
        showReviewAnswers={showReviewAnswers}
        setShowReviewAnswers={setShowReviewAnswers}
        onViewInsights={onViewInsights}
        onReset={onReset}
        examConfig={examConfig}
        sessionId={sessionId}
        onStartTopicQuiz={_onStartTopicQuiz}
      />
    );
  }

  const submitModal = showSubmitConfirm && (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-90" />
          <h3 className="text-2xl font-black">Submit Exam?</h3>
        </div>
        <div className="p-8 space-y-6">
          <p className="text-slate-600 text-center text-lg leading-relaxed">
            Are you sure you want to end the exam and submit your answers?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSubmitConfirm(false)}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowSubmitConfirm(false);
                finishQuiz();
              }}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
            >
              Yes, Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const pauseModal = isPaused && (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
      >
        <div className="bg-amber-500 p-8 text-white text-center">
          <Pause className="w-14 h-14 mx-auto mb-3 opacity-90" />
          <h3 className="text-3xl font-black">Exam Paused</h3>
        </div>
        <div className="p-8 space-y-6 text-center">
          <div>
            <p className="text-slate-500 text-base leading-relaxed">
              Your timer is stopped. Your answers are saved.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Time remaining when paused:{' '}
              <span className="font-bold text-slate-700">{formatTime(timeLeft)}</span>
            </p>
          </div>
          {pauseError && <p className="text-sm text-rose-600 font-semibold">{pauseError}</p>}
          <button
            onClick={handleResume}
            disabled={isPauseLoading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPauseLoading ? (
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Play className="w-5 h-5" /> Resume Exam
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            className="w-full py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all text-sm"
          >
            Abandon Exam
          </button>
        </div>
      </motion.div>
    </div>
  );

  if (showReviewScreen && !quizState.isFinished) {
    return (
      <>
        <QuizReviewScreen
          questions={quizState.questions}
          userAnswers={quizState.userAnswers}
          flagged={flagged}
          onJumpToQuestion={(i) => {
            setQuizState({ ...quizState, currentQuestionIndex: i });
            setShowReviewScreen(false);
          }}
          onSubmit={() => setShowSubmitConfirm(true)}
          onCancel={() => setShowReviewScreen(false)}
        />
        {submitModal}
        {pauseModal}
      </>
    );
  }

  // ── Main exam question view ───────────────────────────────────────────────
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const currentUserAnswer = quizState.userAnswers[quizState.currentQuestionIndex];
  const isCurrentFlagged = flagged[quizState.currentQuestionIndex];
  const currentConfidence = confidenceLevels[quizState.currentQuestionIndex];

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3 items-stretch">
      {/* Sidebar for Desktop */}
      <QuizSidebar
        isPracticeMode={isPracticeMode}
        timeLeft={timeLeft}
        isPaused={isPaused}
        isPauseLoading={isPauseLoading}
        pauseError={pauseError}
        questions={quizState.questions}
        userAnswers={quizState.userAnswers}
        flagged={flagged}
        currentQuestionIndex={quizState.currentQuestionIndex}
        onQuestionSelect={(i) => setQuizState({ ...quizState, currentQuestionIndex: i })}
        onReviewClick={() => setShowReviewScreen(true)}
        onPauseResumeToggle={isPaused ? handleResume : handlePause}
        onCancel={handleCancel}
        formatTime={formatTime}
      />

      {/* Main Question Area */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Mobile Timer */}
        <div className="lg:hidden bg-white rounded-lg border border-slate-200 shadow-sm p-2 flex justify-between items-center shrink-0">
          <span className="font-bold text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {isPracticeMode ? 'Practice' : 'Time:'}
          </span>
          {isPracticeMode ? (
            <span className="font-bold text-xs text-amber-600">Untimed</span>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`font-black text-base ${
                  isPaused
                    ? 'text-amber-500'
                    : timeLeft < 300
                      ? 'text-rose-600 animate-pulse'
                      : 'text-slate-900'
                }`}
              >
                {formatTime(timeLeft)}
              </span>
              {/* Mobile Pause/Resume button (inline with timer) */}
              {sessionId && !isPracticeMode && (
                <button
                  onClick={isPaused ? handleResume : handlePause}
                  disabled={isPauseLoading}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all disabled:opacity-60 ${
                    isPaused
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                  aria-label={isPaused ? 'Resume exam' : 'Pause exam'}
                >
                  {isPauseLoading ? (
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                  ) : isPaused ? (
                    <>
                      <Play className="w-3 h-3" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" /> Pause
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          {pauseError && (
            <span className="text-[10px] text-rose-600 font-semibold ml-1">{pauseError}</span>
          )}
        </div>

        <div className="space-y-1 shrink-0">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>
              Q {quizState.currentQuestionIndex + 1}/{quizState.questions.length}
            </span>
            <span>{quizState.userAnswers.filter((a) => a !== null).length} answered</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1">
            <div
              className="bg-indigo-600 h-1 rounded-full transition-all"
              style={{
                width: `${((quizState.currentQuestionIndex + 1) / quizState.questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Question Card */}
        <QuizQuestionView
          question={currentQuestion}
          userAnswer={currentUserAnswer}
          currentQuestionIndex={quizState.currentQuestionIndex}
          totalQuestions={quizState.questions.length}
          flagged={isCurrentFlagged}
          onFlagToggle={() => {
            const newFlagged = [...flagged];
            newFlagged[quizState.currentQuestionIndex] = !isCurrentFlagged;
            setFlagged(newFlagged);
          }}
          onAnswerSelect={handleAnswer}
          confidenceLevel={currentConfidence}
          onConfidenceSelect={(level) => {
            const newConfidence = [...confidenceLevels];
            newConfidence[quizState.currentQuestionIndex] = level;
            setConfidenceLevels(newConfidence);
          }}
          isPauseLoading={isPauseLoading}
        />

        {/* Navigation */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={prevQuestion}
            disabled={quizState.currentQuestionIndex === 0 || isPauseLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg font-bold text-sm text-white bg-slate-500 border border-slate-500 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={nextQuestion}
            disabled={isPauseLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {quizState.currentQuestionIndex === quizState.questions.length - 1 ? 'Review' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Review Button */}
        <button
          onClick={() => setShowReviewScreen(true)}
          className="lg:hidden w-full flex items-center justify-center gap-1.5 py-3 rounded-lg font-bold text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-all shrink-0"
        >
          <LayoutGrid className="w-4 h-4" /> Overview
        </button>
        {/* Mobile Cancel Button */}
        <button
          onClick={handleCancel}
          className="lg:hidden w-full py-2.5 rounded-lg font-bold text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all shrink-0"
        >
          Cancel
        </button>
      </div>

      {/* Modals are rendered from the top-level variables */}
      {submitModal}
      {pauseModal}
    </div>
  );
}
