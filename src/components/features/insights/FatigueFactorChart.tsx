import React from 'react';
import { Activity, AlertTriangle, TrendingDown } from 'lucide-react';
import type { FatigueAnalysis } from '../../../server/types/insights';

interface FatigueFactorChartProps {
  fatigueAnalysis: FatigueAnalysis | null;
}

export default function FatigueFactorChart({ fatigueAnalysis }: FatigueFactorChartProps) {
  if (!fatigueAnalysis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Fatigue Factor</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Activity className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Data Available</p>
          <p className="text-sm text-slate-500">Complete exams to see your performance over time</p>
        </div>
      </div>
    );
  }

  const { quartiles, fatigueDetected, recommendation } = fatigueAnalysis;

  // Calculate accuracy drop
  const firstQuartileAccuracy = quartiles[0]?.accuracyPct || 0;
  const lastQuartileAccuracy = quartiles[quartiles.length - 1]?.accuracyPct || 0;
  const accuracyDrop = firstQuartileAccuracy - lastQuartileAccuracy;

  // Find max accuracy for scaling
  const maxAccuracy = Math.max(...quartiles.map((q) => q.accuracyPct), 100);

  // Get color based on accuracy
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-emerald-600';
    if (accuracy >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Fatigue Factor
          </h4>
          <p className="text-sm text-slate-500 mt-1">Accuracy by exam quartile</p>
        </div>
        {fatigueDetected && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border-2 border-rose-200">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-bold text-rose-600">Fatigue Detected</span>
          </div>
        )}
      </div>

      {/* Line Chart Visualization */}
      <div className="space-y-4">
        {/* Chart Area */}
        <div className="relative h-48 flex items-end justify-between gap-2 px-4">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-400 font-medium">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {/* Grid lines */}
          <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col justify-between">
            <div className="border-t border-slate-200" />
            <div className="border-t border-slate-200" />
            <div className="border-t border-slate-200" />
            <div className="border-t border-slate-200" />
            <div className="border-t border-slate-200" />
          </div>

          {/* Bars and Line */}
          <div className="relative flex-1 flex items-end justify-around gap-2 ml-8">
            {quartiles.map((quartile, index) => {
              const height = (quartile.accuracyPct / maxAccuracy) * 100;
              const isFirst = index === 0;
              const isLast = index === quartiles.length - 1;
              const color = getAccuracyColor(quartile.accuracyPct);

              return (
                <div key={quartile.quartile} className="flex-1 flex flex-col items-center gap-2">
                  {/* Bar */}
                  <div className="w-full flex flex-col items-center">
                    <span className={`text-sm font-black mb-1 ${color}`}>
                      {Math.round(quartile.accuracyPct)}%
                    </span>
                    <div
                      className="w-full bg-slate-100 rounded-t-lg relative"
                      style={{ height: '160px' }}
                    >
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500 ${
                          isFirst && isLast && fatigueDetected
                            ? 'bg-rose-500'
                            : isFirst
                              ? 'bg-indigo-500'
                              : isLast && fatigueDetected
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  </div>
                  {/* Label */}
                  <span className="text-xs font-bold text-slate-600">Q{quartile.quartile}</span>
                  <span className="text-xs text-slate-500">{quartile.questionsAnswered} qs</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accuracy Drop Indicator */}
        {quartiles.length >= 2 && (
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Accuracy Drop (Q1 → Q4)</span>
            <span
              className={`text-xl font-black ${accuracyDrop > 15 ? 'text-rose-600' : 'text-slate-900'}`}
            >
              {accuracyDrop > 0 ? '-' : '+'}
              {Math.abs(Math.round(accuracyDrop))}%
            </span>
          </div>
        )}
      </div>

      {/* Fatigue Warning */}
      {fatigueDetected && recommendation && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-900 mb-1">Fatigue Warning</p>
            <p className="text-sm text-rose-700 mb-2">
              Your accuracy dropped by more than 15% between the first and last quartile of the
              exam.
            </p>
            <p className="text-sm text-rose-800 font-medium">{recommendation}</p>
          </div>
        </div>
      )}

      {/* Positive Feedback */}
      {!fatigueDetected && quartiles.length >= 2 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-900">
            <span className="font-bold">Great endurance!</span> Your accuracy remains consistent
            throughout the exam. You're maintaining focus well.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900">
          <span className="font-bold">Tip:</span> If you notice fatigue patterns, practice
          full-length timed exams to build endurance for the real test.
        </p>
      </div>
    </div>
  );
}
