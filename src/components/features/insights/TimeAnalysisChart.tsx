import React from 'react';
import { Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import type { TimeAnalysis } from '../../../server/types/insights';

interface TimeAnalysisChartProps {
  timeAnalysis: TimeAnalysis | null;
}

export default function TimeAnalysisChart({ timeAnalysis }: TimeAnalysisChartProps) {
  if (!timeAnalysis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Time Analysis</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Clock className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Data Available</p>
          <p className="text-sm text-slate-500">
            Complete exams to see your time management patterns
          </p>
        </div>
      </div>
    );
  }

  const {
    avgTimeCorrect,
    avgTimeIncorrect,
    dangerZoneWarning,
    projectedCompletionTime,
    pacingAlert,
  } = timeAnalysis;

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate max value for bar chart scaling
  const maxTime = Math.max(avgTimeCorrect, avgTimeIncorrect);
  const correctPercentage = (avgTimeCorrect / maxTime) * 100;
  const incorrectPercentage = (avgTimeIncorrect / maxTime) * 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Time Analysis
          </h4>
          <p className="text-sm text-slate-500 mt-1">Average time spent per question</p>
        </div>
      </div>

      {/* Bar Chart Comparison */}
      <div className="space-y-4">
        {/* Correct Answers Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-700">Correct Answers</span>
            <span className="text-lg font-black text-emerald-600">
              {formatTime(avgTimeCorrect)}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-8 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3"
              style={{ width: `${correctPercentage}%` }}
            >
              {correctPercentage > 20 && (
                <span className="text-xs font-bold text-white">{Math.round(avgTimeCorrect)}s</span>
              )}
            </div>
          </div>
        </div>

        {/* Incorrect Answers Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-rose-700">Incorrect Answers</span>
            <span className="text-lg font-black text-rose-600">{formatTime(avgTimeIncorrect)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-8 overflow-hidden">
            <div
              className={`${dangerZoneWarning ? 'bg-rose-600' : 'bg-rose-500'} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
              style={{ width: `${incorrectPercentage}%` }}
            >
              {incorrectPercentage > 20 && (
                <span className="text-xs font-bold text-white">
                  {Math.round(avgTimeIncorrect)}s
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone Warning */}
      {dangerZoneWarning && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-900 mb-1">Danger Zone Detected</p>
            <p className="text-sm text-rose-700">
              You're spending over 3 minutes on incorrect answers. Consider moving on when stuck to
              manage time better.
            </p>
          </div>
        </div>
      )}

      {/* Projected Completion Time */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Projected Completion Time</span>
          <span className="text-xl font-black text-slate-900">
            {formatTime(projectedCompletionTime)}
          </span>
        </div>

        {/* Pacing Alert */}
        {pacingAlert && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-900 mb-1">Pacing Alert</p>
              <p className="text-xs text-amber-700">
                Your current pace may not leave enough time to complete the exam. Try to speed up
                slightly.
              </p>
            </div>
          </div>
        )}

        {!pacingAlert && (
          <p className="text-xs text-slate-600">
            Your pacing is on track to complete the exam comfortably within the time limit.
          </p>
        )}
      </div>

      {/* Insight */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900">
          <span className="font-bold">Tip:</span> If you're spending significantly more time on
          incorrect answers, it may indicate you're overthinking questions you don't know. Trust
          your instincts and move on.
        </p>
      </div>
    </div>
  );
}
