import React from 'react';
import { Flag } from 'lucide-react';
import { motion } from 'motion/react';
import type { Question } from '../../../types';

export interface QuizQuestionViewProps {
  question: Question;
  userAnswer: string | string[] | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  flagged: boolean;
  onFlagToggle: () => void;
  onAnswerSelect: (opt: string) => void;
  confidenceLevel: number | null;
  onConfidenceSelect: (level: number | null) => void;
  isPauseLoading: boolean;
}

export function QuizQuestionView({
  question,
  userAnswer,
  currentQuestionIndex,
  totalQuestions: _totalQuestions,
  flagged,
  onFlagToggle,
  onAnswerSelect,
  confidenceLevel,
  onConfidenceSelect,
  isPauseLoading,
}: QuizQuestionViewProps) {
  return (
    <motion.div
      key={currentQuestionIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 flex flex-col"
    >
      <div className="flex justify-between items-start gap-2 shrink-0">
        <h3 className="text-base font-bold text-slate-900 leading-relaxed flex-1">
          {question.questionText}
        </h3>
        <button
          disabled={isPauseLoading}
          onClick={onFlagToggle}
          className={`p-2 rounded-md transition-all shrink-0 ${
            flagged
              ? 'bg-amber-100 text-amber-600'
              : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500'
          }`}
          aria-label={flagged ? 'Unflag question' : 'Flag question'}
        >
          <Flag className="w-5 h-5 fill-current" />
        </button>
      </div>

      {question.questionType === 'multiple' && (
        <p className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md inline-block shrink-0">
          Select all that apply
        </p>
      )}

      {/* Options: compact, wraps naturally with page scroll */}
      <div className="flex flex-col gap-1.5">
        {question.options.map((opt, idx) => {
          const isSelected = Array.isArray(userAnswer)
            ? userAnswer.includes(opt)
            : userAnswer === opt;

          return (
            <button
              key={idx}
              disabled={isPauseLoading}
              onClick={() => onAnswerSelect(opt)}
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
              disabled={isPauseLoading}
              onClick={() => onConfidenceSelect(level)}
              className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold transition-all ${
                confidenceLevel === level
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
          {confidenceLevel !== null && (
            <button
              disabled={isPauseLoading}
              onClick={() => onConfidenceSelect(null)}
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
}
