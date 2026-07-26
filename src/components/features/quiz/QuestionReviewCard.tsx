import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Question } from '../../../types';
import type { DetailedResult } from '../../../server/services/ExamGradingService';
import { isAnswerCorrect } from '../../../utils/answerUtils';
import ExplanationDisplay from '../../ui/ExplanationDisplay';

export interface QuestionReviewCardProps {
  question: Question;
  userAnswer: string | string[] | null;
  detailedResult?: DetailedResult;
}

export function QuestionReviewCard({
  question,
  userAnswer,
  detailedResult,
}: QuestionReviewCardProps) {
  const isCorrect = isAnswerCorrect(question, userAnswer);
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <h4 className="font-bold text-slate-900">{question.questionText}</h4>
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
        {question.options.map((opt, idx) => {
          const isCorrectOption = Array.isArray(question.correctAnswers)
            ? question.correctAnswers.includes(opt)
            : question.correctAnswers === opt;
          const isSelectedOption = Array.isArray(userAnswer)
            ? userAnswer.includes(opt)
            : userAnswer === opt;

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
            text={question.explanation}
            options={question.options}
            textClassName="text-indigo-800"
            headingClassName="text-indigo-900"
            labelClassName="text-indigo-700"
          />
        </div>
      </div>
    </div>
  );
}
