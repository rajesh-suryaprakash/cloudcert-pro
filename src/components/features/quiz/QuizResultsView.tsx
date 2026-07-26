import React from 'react';
import {
  Trophy,
  CheckCheck,
  XCircle,
  BookOpen,
  ExternalLink,
  TrendingUp,
  Download,
} from 'lucide-react';
import type {
  QuizState,
  ConfidenceMatrix,
  HistoricalAttempt,
  ExamConfiguration,
  Certification,
  Topic,
} from '../../../types';
import type { DetailedResult } from '../../../server/services/ExamGradingService';
import { filterWrongAnswersByTopic } from '../../../hooks/customQuizUtils';
import { QuestionReviewCard } from './QuestionReviewCard';
import { downloadAttemptReviewMarkdown } from '../../../utils/markdownExport';

interface WeakTopic {
  topicId: string;
  topicTitle: string;
  incorrectCount: number;
  docUrl: string | null;
}

type TaskType = 'review_wrong_answers' | 'practice_quiz' | 'read_docs';

export interface QuizResultsViewProps {
  historicalAttempt: HistoricalAttempt | null;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  passed: boolean | null;
  confidenceMatrix: ConfidenceMatrix | null;
  studyPlan: WeakTopic[] | null;
  completions: Set<string>;
  openReviewTopicId: string | null;
  setOpenReviewTopicId: (id: string | null) => void;
  onMarkComplete: (topicId: string, taskType: TaskType) => void;
  submitDetailedResults: DetailedResult[];
  quizState: QuizState;
  showReviewAnswers: boolean;
  setShowReviewAnswers: (val: boolean) => void;
  onViewInsights?: (certId: string, certTitle: string, sessionId?: string) => void;
  onReset: () => void;
  examConfig?: ExamConfiguration & { isTopicQuiz?: boolean; isCustomQuiz?: boolean };
  sessionId?: string;
  onStartTopicQuiz?: (cert: Certification, topic: Topic) => void;
}

export function QuizResultsView({
  historicalAttempt,
  scorePercent,
  correctCount,
  totalCount,
  passed,
  confidenceMatrix,
  studyPlan,
  completions,
  openReviewTopicId,
  setOpenReviewTopicId,
  onMarkComplete,
  submitDetailedResults,
  quizState,
  showReviewAnswers,
  setShowReviewAnswers,
  onViewInsights,
  onReset,
  examConfig,
  sessionId,
  onStartTopicQuiz: _onStartTopicQuiz,
}: QuizResultsViewProps) {
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
              {passed ? 'PASSED' : 'FAILED'}
            </div>
          )}
        </div>

        {/* Confidence Matrix Stats Dashboard (Task 7.1) */}
        {confidenceMatrix &&
          (confidenceMatrix.trueKnowledge > 0 ||
            confidenceMatrix.luckyGuesses > 0 ||
            confidenceMatrix.knownWeaknesses > 0 ||
            confidenceMatrix.criticalGaps > 0) && (
            <div className="p-8 border-b border-slate-100 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Your Confidence Profile</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Enhanced Study Plan Section (Tasks 6.1–6.7) */}
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
                                onMarkComplete(topic.topicId, 'review_wrong_answers');
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
                                    <QuestionReviewCard
                                      question={q}
                                      userAnswer={userAns}
                                      detailedResult={result}
                                    />
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
                            <a
                              href={topic.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => onMarkComplete(topic.topicId, 'read_docs')}
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

        <div className="p-8 border-t border-slate-100 space-y-6">
          {!historicalAttempt && !showReviewAnswers && (
            <button
              onClick={() => setShowReviewAnswers(true)}
              className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
            >
              Review All Questions & Explanations
            </button>
          )}

          <div className={`space-y-6 ${!historicalAttempt && !showReviewAnswers ? 'hidden' : ''}`}>
            <div className="flex justify-between items-center gap-4 flex-wrap">
              <h3 className="text-xl font-bold text-slate-900">Review Questions</h3>
              <button
                onClick={() =>
                  downloadAttemptReviewMarkdown({
                    quizState,
                    scorePercent,
                    correctCount,
                    totalCount,
                    passed,
                    confidenceMatrix,
                    examConfig,
                    historicalAttempt,
                    sessionId,
                  })
                }
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all select-none border border-indigo-100 shadow-sm"
              >
                <Download className="w-4 h-4" /> Export Review as Markdown
              </button>
            </div>
            <div className="space-y-4">
              {quizState.questions.map((q, i) => {
                const userAns = quizState.userAnswers[i];
                const detailedResult = submitDetailedResults[i] ?? undefined;
                return (
                  <div key={q.id}>
                    <QuestionReviewCard
                      question={q}
                      userAnswer={userAns}
                      detailedResult={detailedResult}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4">
            {!historicalAttempt &&
              sessionId &&
              examConfig?.certificationId &&
              onViewInsights &&
              (() => {
                const isTopicQuiz =
                  examConfig?.isTopicQuiz ||
                  examConfig?.name?.includes('Topic Practice') ||
                  examConfig?.name?.includes('Subtopic Practice');
                const isCustomQuiz =
                  examConfig?.isCustomQuiz || examConfig?.name?.includes('Custom Quiz');
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
      </div>
    </div>
  );
}
