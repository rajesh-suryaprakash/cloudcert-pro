import React from 'react';
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import type { ReadinessScore } from '../../../server/types/insights';

interface ReadinessScoreCardProps {
  readinessScore: ReadinessScore | null;
}

export default function ReadinessScoreCard({ readinessScore }: ReadinessScoreCardProps) {
  if (!readinessScore) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Exam Readiness Score</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">Insufficient Data</p>
          <p className="text-sm text-slate-500">
            Complete at least 3 exam sessions to see your readiness score
          </p>
        </div>
      </div>
    );
  }

  const {
    overallScore,
    consistencyScore,
    pacingScore,
    recentTrend,
    greenLightStatus,
    criteriaForGreen,
  } = readinessScore;

  // Status indicator configuration
  const statusConfig = {
    green: {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      label: 'Ready to Test',
    },
    yellow: {
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      label: 'Almost Ready',
    },
    red: {
      icon: XCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      label: 'Keep Practicing',
    },
  };

  const status = statusConfig[greenLightStatus];
  const StatusIcon = status.icon;

  // Trend icon configuration
  const trendConfig = {
    improving: { icon: TrendingUp, color: 'text-emerald-600', label: 'Improving' },
    stable: { icon: Minus, color: 'text-slate-600', label: 'Stable' },
    declining: { icon: TrendingDown, color: 'text-rose-600', label: 'Declining' },
  };

  const trend = trendConfig[recentTrend];
  const TrendIcon = trend.icon;

  // Calculate weighted domain score (60% of overall)
  const weightedDomainScore = readinessScore.domainScores.reduce(
    (sum, domain) => sum + (domain.proficiencyScore * domain.domainWeight) / 100,
    0,
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-slate-900">Exam Readiness Score</h4>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${status.bg} ${status.border} border-2`}
        >
          <StatusIcon className={`w-4 h-4 ${status.color}`} />
          <span className={`text-sm font-bold ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {/* Overall Score Display */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle cx="64" cy="64" r="56" stroke="#e2e8f0" strokeWidth="12" fill="none" />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke={
                greenLightStatus === 'green'
                  ? '#10b981'
                  : greenLightStatus === 'yellow'
                    ? '#f59e0b'
                    : '#ef4444'
              }
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${(overallScore / 100) * 351.86} 351.86`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-slate-900">{Math.round(overallScore)}</span>
            <span className="text-xs font-bold text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <TrendIcon className={`w-4 h-4 ${trend.color}`} />
            <span className={`text-sm font-bold ${trend.color}`}>{trend.label}</span>
          </div>
          <p className="text-sm text-slate-600">
            Your readiness score is calculated from domain proficiency, consistency, pacing, and
            confidence calibration.
          </p>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3">
        <h5 className="text-sm font-bold text-slate-700">Score Components</h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Domain Score */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Domain
              </span>
              <span className="text-xs text-slate-400">60% weight</span>
            </div>
            <p className="text-2xl font-black text-indigo-600">
              {Math.round(weightedDomainScore)}%
            </p>
          </div>

          {/* Consistency Score */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Consistency
              </span>
              <span className="text-xs text-slate-400">20% weight</span>
            </div>
            <p className="text-2xl font-black text-indigo-600">{Math.round(consistencyScore)}%</p>
          </div>

          {/* Pacing Score */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Pacing
              </span>
              <span className="text-xs text-slate-400">15% weight</span>
            </div>
            <p className="text-2xl font-black text-indigo-600">{Math.round(pacingScore)}%</p>
          </div>
        </div>
      </div>

      {/* Criteria for Green Light */}
      {greenLightStatus !== 'green' && criteriaForGreen.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <h5 className="text-sm font-bold text-indigo-900">To achieve green light status:</h5>
          <ul className="space-y-2">
            {criteriaForGreen.map((criterion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-indigo-700">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Green Light Celebration */}
      {greenLightStatus === 'green' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="font-bold text-emerald-900">You're ready to take the real exam!</p>
          <p className="text-sm text-emerald-700">
            Your consistent performance indicates strong exam readiness.
          </p>
        </div>
      )}
    </div>
  );
}
