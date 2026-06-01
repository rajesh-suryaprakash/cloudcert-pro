import React from 'react';
import { TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import type { ConsistencyMetric } from '../../../server/types/insights';

interface ConsistencyTrendChartProps {
  consistencyMetric: ConsistencyMetric;
}

export default function ConsistencyTrendChart({ consistencyMetric }: ConsistencyTrendChartProps) {
  const { recentSessions, standardDeviation, hasHighVariance, insufficientData } =
    consistencyMetric;

  // Handle insufficient data case
  if (insufficientData || recentSessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Consistency Trend</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">Insufficient Data</p>
          <p className="text-sm text-slate-500">
            Complete at least 5 exam sessions to see your consistency trend
          </p>
          {recentSessions.length > 0 && (
            <p className="text-xs text-slate-400">Current sessions: {recentSessions.length} / 5</p>
          )}
        </div>
      </div>
    );
  }

  // Calculate min and max scores for scaling
  const scores = recentSessions.map((s) => s.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore;
  const chartMin = Math.max(0, minScore - 10);
  const chartMax = 100; // Always cap at 100%
  const chartRange = chartMax - chartMin;

  // Calculate position for each point
  const getYPosition = (score: number) => {
    if (chartRange === 0) return 50; // Center if all scores are the same
    // Add 5% padding at top and bottom to prevent clipping
    const paddedRange = chartRange * 1.1;
    const paddedMin = chartMin - (paddedRange - chartRange) / 2;
    return 95 - ((score - paddedMin) / paddedRange) * 90;
  };

  // Add slight horizontal offset for overlapping points
  const getXPosition = (index: number, _score: number) => {
    const baseX = (index / (recentSessions.length - 1)) * 100;
    return baseX;
  };

  // Generate SVG path for line chart
  const generatePath = () => {
    if (recentSessions.length === 0) return '';

    const points = recentSessions.map((session, index) => {
      const x = getXPosition(index, session.score) * 10;
      const y = getYPosition(session.score) * 4;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Consistency Trend
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Score progression over last {recentSessions.length} exam sessions
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Std. Deviation</p>
          <p
            className={`text-lg font-black ${hasHighVariance ? 'text-amber-600' : 'text-emerald-600'}`}
          >
            {standardDeviation.toFixed(1)}
          </p>
        </div>
      </div>

      {/* High Variance Warning */}
      {hasHighVariance && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-amber-900 text-sm">High Score Variance Detected</p>
            <p className="text-xs text-amber-700 mt-1">
              Your scores vary significantly between sessions. Focus on consistent study habits and
              full-length timed practice to stabilize performance.
            </p>
          </div>
        </div>
      )}

      {/* Line Chart */}
      <div className="space-y-4">
        <div className="relative bg-slate-50 rounded-xl p-6 pt-10 pl-12 border border-slate-200">
          {/* SVG Chart */}
          <div className="relative">
            <svg viewBox="0 0 1000 400" className="w-full h-48" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="100" x2="1000" y2="100" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="0" y1="200" x2="1000" y2="200" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="0" y1="300" x2="1000" y2="300" stroke="#e2e8f0" strokeWidth="1" />

              {/* Line path */}
              <path
                d={generatePath()}
                fill="none"
                stroke="#4338ca"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Data points as HTML for sharp rendering */}
            {recentSessions.map((session, index) => {
              const x = getXPosition(index, session.score);
              const y = getYPosition(session.score);

              return (
                <div
                  key={`point-${session.sessionId}`}
                  className="absolute w-3.5 h-3.5 rounded-full bg-indigo-700 border-2 border-white shadow-sm"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%)`,
                    zIndex: 15,
                  }}
                />
              );
            })}

            {/* Score labels as HTML for crisp rendering */}
            {recentSessions.map((session, index) => {
              const x = getXPosition(index, session.score);
              const y = getYPosition(session.score);
              const scoreLabel = Math.round(session.score);

              // Adjust vertical offset for scores at the top to prevent overflow
              const verticalOffset = '-200%';

              return (
                <div
                  key={`label-${session.sessionId}`}
                  className="absolute text-xs font-bold text-indigo-700 whitespace-nowrap bg-white px-2 py-1 rounded-md shadow-md border-2 border-indigo-200"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, ${verticalOffset})`,
                    zIndex: 20,
                  }}
                >
                  {scoreLabel}%
                </div>
              );
            })}
          </div>
        </div>

        {/* Session Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {recentSessions.map((session, index) => (
            <div
              key={session.sessionId}
              className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Session {index + 1}</span>
                <span
                  className={`text-lg font-black ${
                    session.score >= 80
                      ? 'text-emerald-600'
                      : session.score >= 60
                        ? 'text-amber-600'
                        : 'text-rose-600'
                  }`}
                >
                  {Math.round(session.score)}%
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-600 truncate" title={session.sessionName}>
                  {session.sessionName}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(session.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-4 text-center space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Average</p>
          <p className="text-2xl font-black text-indigo-600">
            {Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)}%
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-center space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Range</p>
          <p className="text-2xl font-black text-slate-600">{Math.round(scoreRange)}%</p>
        </div>
        <div
          className={`rounded-xl p-4 text-center space-y-1 ${
            hasHighVariance ? 'bg-amber-50' : 'bg-emerald-50'
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-widest ${
              hasHighVariance ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            Consistency
          </p>
          <p
            className={`text-2xl font-black ${
              hasHighVariance ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {hasHighVariance ? 'Variable' : 'Stable'}
          </p>
        </div>
      </div>
    </div>
  );
}
