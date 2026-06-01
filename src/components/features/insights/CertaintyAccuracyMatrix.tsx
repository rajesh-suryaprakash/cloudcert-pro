import React from 'react';
import { Target, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import type { CertaintyMatrix } from '../../../server/types/insights';

interface CertaintyAccuracyMatrixProps {
  certaintyMatrix: CertaintyMatrix | null;
}

export default function CertaintyAccuracyMatrix({ certaintyMatrix }: CertaintyAccuracyMatrixProps) {
  if (!certaintyMatrix) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Certainty vs Accuracy</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Data Available</p>
          <p className="text-sm text-slate-500">
            Rate your confidence on questions to see this analysis
          </p>
        </div>
      </div>
    );
  }

  const {
    highConfidenceCorrect,
    highConfidenceIncorrect,
    lowConfidenceCorrect,
    lowConfidenceIncorrect,
  } = certaintyMatrix;

  // Calculate total for validation
  const total =
    highConfidenceCorrect.count +
    highConfidenceIncorrect.count +
    lowConfidenceCorrect.count +
    lowConfidenceIncorrect.count;

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Certainty vs Accuracy</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Confidence Data</p>
          <p className="text-sm text-slate-500">
            Start rating your confidence on questions to see this matrix
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div>
        <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Certainty vs Accuracy Matrix
        </h4>
        <p className="text-sm text-slate-500 mt-1">How your confidence aligns with correctness</p>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Left: High Confidence + Incorrect (DANGER ZONE) */}
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span className="text-xs font-bold text-rose-900 uppercase tracking-widest">
                Danger Zone
              </span>
            </div>
            {highConfidenceIncorrect.count > 0 && (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
          </div>
          <div>
            <p className="text-3xl font-black text-rose-600">{highConfidenceIncorrect.count}</p>
            <p className="text-sm text-rose-700 font-medium mt-1">
              {Math.round(highConfidenceIncorrect.percentage)}% of total
            </p>
          </div>
          <p className="text-xs text-rose-800">High confidence but incorrect - false confidence</p>
        </div>

        {/* Top Right: High Confidence + Correct */}
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-widest">
              Well Calibrated
            </span>
          </div>
          <div>
            <p className="text-3xl font-black text-emerald-600">{highConfidenceCorrect.count}</p>
            <p className="text-sm text-emerald-700 font-medium mt-1">
              {Math.round(highConfidenceCorrect.percentage)}% of total
            </p>
          </div>
          <p className="text-xs text-emerald-800">High confidence and correct - strong knowledge</p>
        </div>

        {/* Bottom Left: Low Confidence + Incorrect */}
        <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
              Learning Zone
            </span>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{lowConfidenceIncorrect.count}</p>
            <p className="text-sm text-slate-600 font-medium mt-1">
              {Math.round(lowConfidenceIncorrect.percentage)}% of total
            </p>
          </div>
          <p className="text-xs text-slate-700">Low confidence and incorrect - aware of gaps</p>
        </div>

        {/* Bottom Right: Low Confidence + Correct (UNDERCONFIDENT) */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-bold text-amber-900 uppercase tracking-widest">
              Underconfident
            </span>
          </div>
          <div>
            <p className="text-3xl font-black text-amber-600">{lowConfidenceCorrect.count}</p>
            <p className="text-sm text-amber-700 font-medium mt-1">
              {Math.round(lowConfidenceCorrect.percentage)}% of total
            </p>
          </div>
          <p className="text-xs text-amber-800">Low confidence but correct - trust yourself more</p>
        </div>
      </div>

      {/* Axis Labels */}
      <div className="relative">
        {/* Horizontal axis label */}
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600">
          <span>← Incorrect</span>
          <span className="text-slate-400">|</span>
          <span>Correct →</span>
        </div>
        {/* Vertical axis label - positioned horizontally for better readability */}
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 mt-2">
          <span>High Confidence ↑</span>
          <span className="text-slate-400">|</span>
          <span>↓ Low Confidence</span>
        </div>
      </div>

      {/* Insights */}
      {highConfidenceIncorrect.percentage > 15 && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-900 mb-1">High False Confidence</p>
            <p className="text-sm text-rose-700">
              You have a significant number of questions where you were confident but incorrect.
              Review these topics carefully - you may have misconceptions.
            </p>
          </div>
        </div>
      )}

      {lowConfidenceCorrect.percentage > 20 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-900">
            <span className="font-bold">Build confidence:</span> You're getting many questions right
            despite low confidence. Trust your knowledge more!
          </p>
        </div>
      )}

      {highConfidenceCorrect.percentage > 60 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-900">
            <span className="font-bold">Excellent calibration!</span> Your confidence aligns well
            with your actual knowledge. Keep it up!
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900">
          <span className="font-bold">Ideal distribution:</span> Most questions should be in the
          "Well Calibrated" (top-right) quadrant, with minimal in the "Danger Zone" (top-left).
        </p>
      </div>
    </div>
  );
}
