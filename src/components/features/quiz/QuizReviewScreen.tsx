import React from 'react';
import type { Question } from '../../../types';

export interface QuizReviewScreenProps {
  questions: Question[];
  userAnswers: (string | string[] | null)[];
  flagged: boolean[];
  onJumpToQuestion: (idx: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function QuizReviewScreen({
  questions,
  userAnswers,
  flagged,
  onJumpToQuestion,
  onSubmit,
  onCancel,
}: QuizReviewScreenProps) {
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
              {userAnswers.filter((a) => a !== null).length}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              Answered
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-rose-600">
              {userAnswers.filter((a) => a === null).length}
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
          {questions.map((_, i) => {
            const userAns = userAnswers[i];
            const isAnswered =
              userAns !== null && (Array.isArray(userAns) ? userAns.length > 0 : true);
            const isFlagged = flagged[i];
            return (
              <button
                key={i}
                onClick={() => onJumpToQuestion(i)}
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
            onClick={onCancel}
            className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Return to Exam
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 px-6 py-4 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            Submit Final Answers
          </button>
        </div>
      </div>
    </div>
  );
}
