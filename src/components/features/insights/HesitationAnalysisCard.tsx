import React from 'react';
import { GitBranch, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import type { HesitationAnalysis } from '../../../server/types/insights';

interface HesitationAnalysisCardProps {
  hesitationAnalysis: HesitationAnalysis | null;
}

export default function HesitationAnalysisCard({
  hesitationAnalysis,
}: HesitationAnalysisCardProps) {
  if (!hesitationAnalysis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Hesitation Analysis</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <GitBranch className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Data Available</p>
          <p className="text-sm text-slate-500">Answer changes will be tracked as you take exams</p>
        </div>
      </div>
    );
  }

  const { totalChanges, correctToIncorrectPct, incorrectToCorrectPct, confidenceWarning } =
    hesitationAnalysis;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            Hesitation Analysis
          </h4>
          <p className="text-sm text-slate-500 mt-1">Impact of changing your answers</p>
        </div>
      </div>

      {/* Total Changes */}
      <div className="bg-slate-50 rounded-xl p-4 text-center">
        <p className="text-sm font-bold text-slate-600 mb-2">Total Answer Changes</p>
        <p className="text-4xl font-black text-slate-900">{totalChanges}</p>
      </div>

      {/* Change Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Correct to Incorrect */}
        <div
          className={`rounded-xl p-4 border-2 ${confidenceWarning ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown
              className={`w-4 h-4 ${confidenceWarning ? 'text-rose-600' : 'text-slate-600'}`}
            />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              Correct → Incorrect
            </span>
          </div>
          <p
            className={`text-3xl font-black ${confidenceWarning ? 'text-rose-600' : 'text-slate-900'}`}
          >
            {Math.round(correctToIncorrectPct)}%
          </p>
          {confidenceWarning && (
            <p className="text-xs text-rose-700 mt-2 font-medium">
              High rate - trust your first instinct
            </p>
          )}
        </div>

        {/* Incorrect to Correct */}
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
              Incorrect → Correct
            </span>
          </div>
          <p className="text-3xl font-black text-emerald-600">
            {Math.round(incorrectToCorrectPct)}%
          </p>
          <p className="text-xs text-emerald-700 mt-2 font-medium">Good catch rate</p>
        </div>
      </div>

      {/* Confidence Warning */}
      {confidenceWarning && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-900 mb-1">Confidence Warning</p>
            <p className="text-sm text-rose-700">
              You're changing from correct to incorrect answers more than 20% of the time. This
              suggests you may be second-guessing yourself. Trust your initial instinct more often.
            </p>
          </div>
        </div>
      )}

      {/* Insight */}
      {!confidenceWarning && totalChanges > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm text-indigo-900">
            <span className="font-bold">Good news:</span> Your answer changes are helping more than
            hurting. You're catching mistakes at a healthy rate.
          </p>
        </div>
      )}

      {totalChanges === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm text-slate-700">
            You haven't changed any answers yet. It's okay to reconsider your choices if you catch a
            mistake!
          </p>
        </div>
      )}
    </div>
  );
}
