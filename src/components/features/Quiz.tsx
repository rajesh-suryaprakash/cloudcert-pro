/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Flag,
  LayoutGrid,
  AlertCircle,
  BookOpen,
  ExternalLink,
  CheckCheck,
  TrendingUp,
} from 'lucide-react';
import type {
  Question,
  QuizState,
  QuizResult,
  ExamConfiguration,
  ConfidenceMatrix,
} from '../../types';
import { fetchApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { isAnswerCorrect } from '../../utils/answerUtils';
import { filterWrongAnswersByTopic } from '../../hooks/customQuizUtils';
import type { DetailedResult } from '../../server/services/ExamGradingService';
import ExplanationDisplay from '../ui/ExplanationDisplay';

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
  historicalAttempt?: any;
  onFinish: (result: QuizResult) => void;
  onReset: () => void;
  onStartTopicQuiz?: (cert: any, topic: any) => void;
  onViewInsights?: (certId: string, certTitle: string, sessionId?: string) => void;
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
}: QuizProps) {
  const { user } = useAuth();
  const [quizState, setQuizState] = useState<QuizState>({
    questions,
    currentQuestionIndex: 0,
    userAnswers: historicalAttempt
      ? historicalAttempt.answers.map((a: any) => a.selectedOptions)
      : new Array(questions.length).fill(null),
    isFinished: !!historicalAttempt,
    startTime: historicalAttempt ? historicalAttempt.startTime : Date.now(),
    endTime: historicalAttempt ? historicalAttempt.endTime : null,
  });
  const [confidenceMatrix, setConfidenceMatrix] = useState<ConfidenceMatrix | null>(null);
  const [percentileRank, setPercentileRank] = useState<number | null>(null);
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
  const isPracticeMode = !!(examConfig as any)?.isPracticeMode;
  const [timeLeft, setTimeLeft] = useState((examConfig?.duration || 120) * 60);
  const [flagged, setFlagged] = useState<boolean[]>(new Array(questions.length).fill(false));
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showReviewAnswers, setShowReviewAnswers] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [questionTimes, setQuestionTimes] = useState<number[]>(new Array(questions.length).fill(0));
  const [confidenceLevels, setConfidenceLevels] = useState<(number | null)[]>(
    new Array(questions.length).fill(null),
  );

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
    if (quizState.isFinished || showReviewScreen || isPracticeMode) return;
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
  }, [quizState.isFinished, showReviewScreen, isPracticeMode]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  const saveAnswer = async (
    index: number,
    answers: any[],
    isFlagged: boolean,
    confidence: number | null = null,
  ) => {
    if (!sessionId) return;
    const q = quizState.questions[index];
    const userAns = answers[index];

    const timeSpentOnQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
    const totalTimeOnQuestion = questionTimes[index] + timeSpentOnQuestion;

    const mappedConfidence = mapConfidenceLevel(confidence);
    console.warn('[DEBUG] saveAnswer called:', {
      questionIndex: index,
      confidence,
      mappedConfidence,
      isFlagged,
    });

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
  };

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

  const nextQuestion = () => {
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
  };

  const prevQuestion = () => {
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
  };

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
    const _result: QuizResult = {
      score,
      totalQuestions: quizState.questions.length,
      timeSpent: Math.floor((endTime - quizState.startTime) / 1000),
      categoryBreakdown: breakdown,
    };

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

  // ── Renders a single question in review format (red/green highlighting) ──
  const renderQuestionReview = (q: Question, userAns: any, detailedResult?: DetailedResult) => {
    const isCorrect = isAnswerCorrect(q, userAns);
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <h4 className="font-bold text-slate-900">{q.questionText}</h4>
            {(() => {
              const cl = detailedResult?.confidenceLevel ?? null;
              if (!cl) return null;
              const isConfident = cl === 'confident';
              return (
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    isConfident ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isConfident ? 'Confident' : 'Guessed'}
                </span>
              );
            })()}
          </div>
          {isCorrect ? (
            <CheckCircle2 className="text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="text-rose-500 shrink-0" />
          )}
        </div>
        <div className="grid gap-2">
          {q.options.map((opt, idx) => {
            const isCorrectOption = Array.isArray(q.correctAnswers)
              ? q.correctAnswers.includes(opt)
              : q.correctAnswers === opt;
            const isSelectedOption = Array.isArray(userAns)
              ? userAns.includes(opt)
              : userAns === opt;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-sm font-medium ${
                  isCorrectOption
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : isSelectedOption
                      ? 'bg-rose-50 border-rose-100 text-rose-700'
                      : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}
              >
                {opt}
              </div>
            );
          })}
        </div>
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="bg-indigo-50 p-4 rounded-xl">
            <p className="text-sm font-bold text-indigo-900 mb-1">Standard Explanation</p>
            <ExplanationDisplay
              text={q.explanation}
              options={q.options}
              textClassName="text-indigo-800"
              headingClassName="text-indigo-900"
              labelClassName="text-indigo-700"
            />
          </div>
        </div>
      </div>
    );
  };

  if (quizState.isFinished) {
    const correctCount = quizState.userAnswers.filter((ans, i) => {
      const q = quizState.questions[i];
      return isAnswerCorrect(q, ans);
    }).length;
    const totalCount = quizState.questions.length;
    const scorePercent = Math.round((correctCount / totalCount) * 100);

    return (
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-600 p-12 text-center text-white space-y-4">
            <Trophy className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-4xl font-extrabold">
              {historicalAttempt ? 'Attempt Review' : 'Test Completed!'}
            </h2>
            <div className="text-6xl font-black py-4">{scorePercent}%</div>
            <div className="text-2xl font-bold text-indigo-200">
              {correctCount} / {totalCount}
            </div>
            {passed !== null && (
              <div
                className={`inline-block px-6 py-2 rounded-full text-lg font-bold ${
                  passed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}
              >
                {passed ? 'Passed' : 'Failed'}
              </div>
            )}
            {percentileRank !== null && (
              <p className="text-indigo-200 text-lg font-medium">
                You scored higher than{' '}
                <span className="text-white font-bold">{percentileRank}%</span> of users on this
                exam.
              </p>
            )}
          </div>
          <div className="p-8 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center border-t border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time</p>
              <p className="text-xl font-bold">
                {(() => {
                  let timeInSeconds = 0;
                  if (historicalAttempt && historicalAttempt.timeTaken !== null) {
                    // Use timeTaken field if available (in seconds)
                    timeInSeconds = historicalAttempt.timeTaken;
                  } else if (quizState.endTime && quizState.startTime) {
                    // Calculate from timestamps (convert to seconds)
                    const startMs =
                      typeof quizState.startTime === 'string'
                        ? new Date(quizState.startTime).getTime()
                        : quizState.startTime;
                    const endMs =
                      typeof quizState.endTime === 'string'
                        ? new Date(quizState.endTime).getTime()
                        : quizState.endTime;
                    timeInSeconds = Math.floor((endMs - startMs) / 1000);
                  }
                  const minutes = Math.floor(timeInSeconds / 60);
                  const seconds = timeInSeconds % 60;
                  return `${minutes}m ${seconds}s`;
                })()}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Questions
              </p>
              <p className="text-xl font-bold">{totalCount}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Correct</p>
              <p className="text-xl font-bold text-emerald-600">{correctCount}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Incorrect
              </p>
              <p className="text-xl font-bold text-rose-600">{totalCount - correctCount}</p>
            </div>
          </div>
        </div>

        {!historicalAttempt && (
          <button
            onClick={() => setShowReviewAnswers((v) => !v)}
            className="w-full py-4 rounded-2xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-all"
          >
            {showReviewAnswers ? 'Hide Answer Review' : 'Review Your Answers'}
          </button>
        )}

        {confidenceMatrix &&
          confidenceMatrix.trueKnowledge +
            confidenceMatrix.luckyGuesses +
            confidenceMatrix.knownWeaknesses +
            confidenceMatrix.criticalGaps >
            0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Confidence Matrix</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center space-y-1">
                  <p className="text-3xl font-black text-emerald-700">
                    {confidenceMatrix.trueKnowledge}
                  </p>
                  <p className="text-sm font-bold text-emerald-600">True Knowledge</p>
                  <p className="text-xs text-emerald-500">Correct + Confident</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center space-y-1">
                  <p className="text-3xl font-black text-amber-700">
                    {confidenceMatrix.luckyGuesses}
                  </p>
                  <p className="text-sm font-bold text-amber-600">Lucky Guesses — Review!</p>
                  <p className="text-xs text-amber-500">Correct + Guessed</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center space-y-1">
                  <p className="text-3xl font-black text-orange-700">
                    {confidenceMatrix.knownWeaknesses}
                  </p>
                  <p className="text-sm font-bold text-orange-600">Known Weaknesses — Study!</p>
                  <p className="text-xs text-orange-500">Incorrect + Guessed</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-center space-y-1">
                  <p className="text-3xl font-black text-rose-700">
                    {confidenceMatrix.criticalGaps}
                  </p>
                  <p className="text-sm font-bold text-rose-600">Critical Gaps — High Priority!</p>
                  <p className="text-xs text-rose-500">Incorrect + Confident</p>
                </div>
              </div>
            </div>
          )}

        {/* ── Enhanced Study Plan Section (Tasks 6.1–6.7) ── */}
        {studyPlan && studyPlan.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Your Study Plan</h3>
              <p className="text-sm text-slate-500 mt-1">
                Focus on these topics to improve your score.
              </p>
            </div>

            <div className="space-y-6">
              {studyPlan.map((topic) => {
                const wrongAnswers = filterWrongAnswersByTopic(
                  submitDetailedResults,
                  topic.topicId,
                );
                const isReviewOpen = openReviewTopicId === topic.topicId;

                return (
                  <div
                    key={topic.topicId}
                    className="border border-slate-100 rounded-2xl overflow-hidden"
                  >
                    {/* Topic header */}
                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-100">
                      <p className="font-bold text-slate-900">{topic.topicTitle}</p>
                      <p className="text-sm text-slate-500">
                        {topic.incorrectCount} question{topic.incorrectCount !== 1 ? 's' : ''}{' '}
                        missed
                      </p>
                    </div>

                    <div className="divide-y divide-slate-50">
                      {/* Task 6.3: Review wrong answers row */}
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Task 6.7: completion indicator */}
                            {completions.has(`${topic.topicId}:review_wrong_answers`) ? (
                              <CheckCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                            )}
                            <span
                              className={`text-sm font-bold ${
                                completions.has(`${topic.topicId}:review_wrong_answers`)
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800'
                              }`}
                            >
                              Review wrong answers ({wrongAnswers.length})
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const next = isReviewOpen ? null : topic.topicId;
                              setOpenReviewTopicId(next);
                              // Task 6.2: mark complete on open
                              if (!isReviewOpen) {
                                markComplete(topic.topicId, 'review_wrong_answers');
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 transition-all shrink-0 border border-rose-100"
                          >
                            {isReviewOpen ? 'Hide' : 'Review'}
                          </button>
                        </div>

                        {/* Inline wrong-answer review panel (Task 6.3) */}
                        {isReviewOpen && (
                          <div className="space-y-3 pt-2">
                            {wrongAnswers.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">
                                No wrong answers found for this topic.
                              </p>
                            ) : (
                              wrongAnswers.map((result) => {
                                const q = quizState.questions.find(
                                  (q) => q.id === result.questionId,
                                );
                                if (!q) return null;
                                const userAns =
                                  quizState.userAnswers[quizState.questions.indexOf(q)];
                                return (
                                  <div key={result.questionId}>
                                    {renderQuestionReview(q, userAns, result)}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Task 6.6: Read the docs row — only when docUrl is non-null */}
                      {topic.docUrl !== null && (
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Task 6.7: completion indicator */}
                              {completions.has(`${topic.topicId}:read_docs`) ? (
                                <CheckCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                              ) : (
                                <BookOpen className="w-5 h-5 text-blue-400 shrink-0" />
                              )}
                              <span
                                className={`text-sm font-bold ${
                                  completions.has(`${topic.topicId}:read_docs`)
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800'
                                }`}
                              >
                                Read the official documentation
                              </span>
                            </div>
                            {/* Task 6.2: markComplete on link click */}
                            <a
                              href={topic.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => markComplete(topic.topicId, 'read_docs')}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-all shrink-0 border border-blue-100"
                            >
                              Open <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`space-y-6 ${!historicalAttempt && !showReviewAnswers ? 'hidden' : ''}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">Review Questions</h3>
          </div>
          <div className="space-y-4">
            {quizState.questions.map((q, i) => {
              const userAns = quizState.userAnswers[i];
              const detailedResult = submitDetailedResults[i] ?? undefined;
              return <div key={q.id}>{renderQuestionReview(q, userAns, detailedResult)}</div>;
            })}
          </div>
        </div>

        <div className="flex gap-4">
          {!historicalAttempt &&
            sessionId &&
            examConfig?.certificationId &&
            onViewInsights &&
            (() => {
              // Only show Insights Dashboard for mock tests and practice tests
              // Exclude: topic quizzes, subtopic quizzes, custom quizzes
              const isTopicQuiz =
                (examConfig as any)?.isTopicQuiz ||
                examConfig.name?.includes('Topic Practice') ||
                examConfig.name?.includes('Subtopic Practice');
              const isCustomQuiz =
                (examConfig as any)?.isCustomQuiz || examConfig.name?.includes('Custom Quiz');
              const isMockOrPracticeTest = !isTopicQuiz && !isCustomQuiz;

              return isMockOrPracticeTest ? (
                <button
                  onClick={() =>
                    onViewInsights(
                      examConfig.certificationId,
                      examConfig.name || 'Certification',
                      sessionId,
                    )
                  }
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  View Insights Dashboard
                </button>
              ) : null;
            })()}
          <button
            onClick={onReset}
            className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (showReviewScreen && !quizState.isFinished) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-900">Exam Review</h2>
            <p className="text-slate-500">Review your answers before final submission.</p>
          </div>

          <div className="flex justify-center gap-8 py-6 border-y border-slate-100">
            <div className="text-center">
              <p className="text-3xl font-black text-indigo-600">
                {quizState.userAnswers.filter((a) => a !== null).length}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Answered
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-rose-600">
                {quizState.userAnswers.filter((a) => a === null).length}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Unanswered
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-amber-600">{flagged.filter(Boolean).length}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Flagged
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {quizState.questions.map((_, i) => {
              const userAns = quizState.userAnswers[i];
              const isAnswered =
                userAns !== null && (Array.isArray(userAns) ? userAns.length > 0 : true);
              const isFlagged = flagged[i];
              return (
                <button
                  key={i}
                  onClick={() => {
                    setQuizState({ ...quizState, currentQuestionIndex: i });
                    setShowReviewScreen(false);
                  }}
                  className={`relative p-3 rounded-xl font-bold text-sm transition-all border-2 ${
                    isFlagged
                      ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                      : isAnswered
                        ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={() => setShowReviewScreen(false)}
              className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Return to Exam
            </button>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="flex-1 px-6 py-4 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              Submit Final Answers
            </button>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
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
        )}
      </div>
    );
  }

  // ── Main exam question view ───────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3 items-stretch">
      {/* Sidebar for Desktop */}
      <div className="hidden lg:flex flex-col w-80 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3 h-full">
          <div className="text-center space-y-0.5 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> {isPracticeMode ? 'Practice' : 'Time'}
            </p>
            {!isPracticeMode && (
              <p
                className={`text-xl font-black ${timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}
              >
                {formatTime(timeLeft)}
              </p>
            )}
            {isPracticeMode && <p className="text-xs font-bold text-amber-600">Untimed</p>}
          </div>{' '}
          {/* Question grid: grows to fill available space, scrolls if many questions */}
          <div className="flex-1 overflow-y-auto p-1 scrollbar-hide min-h-0">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${
                  // Dynamic column calculation for larger cards with better usability
                  quizState.questions.length <= 6
                    ? 6
                    : quizState.questions.length <= 10
                      ? 5
                      : quizState.questions.length <= 15
                        ? 6
                        : quizState.questions.length <= 24
                          ? 6
                          : quizState.questions.length <= 35
                            ? 7
                            : quizState.questions.length <= 56
                              ? 8
                              : quizState.questions.length <= 80
                                ? 9
                                : 10
                }, minmax(0, 1fr))`,
              }}
            >
              {quizState.questions.map((_, i) => {
                const userAns = quizState.userAnswers[i];
                const isAnswered =
                  userAns !== null && (Array.isArray(userAns) ? userAns.length > 0 : true);
                const isFlagged = flagged[i];
                const isCurrent = quizState.currentQuestionIndex === i;
                return (
                  <button
                    key={i}
                    onClick={() => setQuizState({ ...quizState, currentQuestionIndex: i })}
                    className={`aspect-square rounded-md font-bold text-base flex items-center justify-center transition-all border p-1 ${
                      isCurrent
                        ? 'border-indigo-600 ring-1 ring-indigo-100 bg-indigo-50'
                        : isFlagged
                          ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                          : isAnswered
                            ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setShowReviewScreen(true)}
            className="w-full py-3 px-4 rounded-lg font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 transition-all shrink-0"
          >
            Review
          </button>
          <button
            onClick={handleCancel}
            className="w-full py-3 px-4 rounded-lg font-bold text-sm text-white bg-slate-500 border border-slate-500 hover:bg-slate-600 transition-all shrink-0"
          >
            Cancel
          </button>
        </div>
      </div>

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
            <span
              className={`font-black text-base ${timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}
            >
              {formatTime(timeLeft)}
            </span>
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
        {(() => {
          const q = quizState.questions[quizState.currentQuestionIndex];
          const userAns = quizState.userAnswers[quizState.currentQuestionIndex];
          const isFlaggedCurrent = flagged[quizState.currentQuestionIndex];

          return (
            <motion.div
              key={quizState.currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 flex flex-col"
            >
              <div className="flex justify-between items-start gap-2 shrink-0">
                <h3 className="text-base font-bold text-slate-900 leading-relaxed flex-1">
                  {q.questionText}
                </h3>
                <button
                  onClick={() => {
                    const newFlagged = [...flagged];
                    newFlagged[quizState.currentQuestionIndex] = !isFlaggedCurrent;
                    setFlagged(newFlagged);
                  }}
                  className={`p-2 rounded-md transition-all shrink-0 ${
                    isFlaggedCurrent
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500'
                  }`}
                  aria-label={isFlaggedCurrent ? 'Unflag question' : 'Flag question'}
                >
                  <Flag className="w-5 h-5 fill-current" />
                </button>
              </div>

              {q.questionType === 'multiple' && (
                <p className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md inline-block shrink-0">
                  Select all that apply
                </p>
              )}

              {/* Options: compact, wraps naturally with page scroll */}
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt, idx) => {
                  const isSelected = Array.isArray(userAns)
                    ? userAns.includes(opt)
                    : userAns === opt;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(opt)}
                      className={`w-full px-3 py-2 rounded-lg border transition-all shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-left text-sm font-medium">
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs font-black shrink-0 ${
                            isSelected
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Confidence Level Selector */}
              <div className="pt-2 border-t border-slate-100 shrink-0">
                <p className="text-sm font-bold text-slate-500 mb-2">Confidence Level (Optional)</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        const newConfidence = [...confidenceLevels];
                        newConfidence[quizState.currentQuestionIndex] = level;
                        setConfidenceLevels(newConfidence);
                      }}
                      className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold transition-all ${
                        confidenceLevels[quizState.currentQuestionIndex] === level
                          ? level <= 2
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : level === 3
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : level <= 2
                            ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                            : level === 3
                              ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                  {confidenceLevels[quizState.currentQuestionIndex] !== null && (
                    <button
                      onClick={() => {
                        const newConfidence = [...confidenceLevels];
                        newConfidence[quizState.currentQuestionIndex] = null;
                        setConfidenceLevels(newConfidence);
                      }}
                      className="px-3 py-3 rounded-lg text-sm font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Navigation */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={prevQuestion}
            disabled={quizState.currentQuestionIndex === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg font-bold text-sm text-white bg-slate-500 border border-slate-500 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={nextQuestion}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
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

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
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
      )}
    </div>
  );
}
