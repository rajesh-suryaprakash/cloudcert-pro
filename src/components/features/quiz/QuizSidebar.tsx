import React from 'react';
import { Clock, Play, Pause } from 'lucide-react';
import type { Question } from '../../../types';

export interface QuizSidebarProps {
  isPracticeMode: boolean;
  timeLeft: number;
  isPaused: boolean;
  isPauseLoading: boolean;
  pauseError: string | null;
  questions: Question[];
  userAnswers: (string | string[] | null)[];
  flagged: boolean[];
  currentQuestionIndex: number;
  onQuestionSelect: (idx: number) => void;
  onReviewClick: () => void;
  onPauseResumeToggle: () => void;
  onCancel: () => void;
  formatTime: (seconds: number) => string;
}

export function QuizSidebar({
  isPracticeMode,
  timeLeft,
  isPaused,
  isPauseLoading,
  pauseError,
  questions,
  userAnswers,
  flagged,
  currentQuestionIndex,
  onQuestionSelect,
  onReviewClick,
  onPauseResumeToggle,
  onCancel,
  formatTime,
}: QuizSidebarProps) {
  return (
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
              {isPaused ? (
                <span className="text-amber-500">{formatTime(timeLeft)}</span>
              ) : (
                formatTime(timeLeft)
              )}
            </p>
          )}
          {isPracticeMode && <p className="text-xs font-bold text-amber-600">Untimed</p>}
          {pauseError && (
            <p className="text-[10px] text-rose-600 font-semibold leading-tight">{pauseError}</p>
          )}
        </div>

        {/* Question grid */}
        <div className="flex-1 overflow-y-auto p-1 scrollbar-hide min-h-0">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${
                questions.length <= 6
                  ? 6
                  : questions.length <= 10
                    ? 5
                    : questions.length <= 15
                      ? 6
                      : questions.length <= 24
                        ? 6
                        : questions.length <= 35
                          ? 7
                          : questions.length <= 56
                            ? 8
                            : questions.length <= 80
                              ? 9
                              : 10
              }, minmax(0, 1fr))`,
            }}
          >
            {questions.map((_, i) => {
              const userAns = userAnswers[i];
              const isAnswered =
                userAns !== null && (Array.isArray(userAns) ? userAns.length > 0 : true);
              const isFlagged = flagged[i];
              const isCurrent = currentQuestionIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => onQuestionSelect(i)}
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
          onClick={onReviewClick}
          className="w-full py-3 px-4 rounded-lg font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 transition-all shrink-0"
        >
          Review
        </button>

        {!isPracticeMode && (
          <button
            onClick={onPauseResumeToggle}
            disabled={isPauseLoading}
            className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-all shrink-0 flex items-center justify-center gap-2 ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600'
                : 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-500'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
            aria-label={isPaused ? 'Resume exam' : 'Pause exam'}
          >
            {isPauseLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : isPaused ? (
              <>
                <Play className="w-4 h-4" /> Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            )}
          </button>
        )}

        <button
          onClick={onCancel}
          className="w-full py-3 px-4 rounded-lg font-bold text-sm text-white bg-slate-500 border border-slate-500 hover:bg-slate-600 transition-all shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
