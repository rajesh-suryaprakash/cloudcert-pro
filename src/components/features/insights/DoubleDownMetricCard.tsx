import React from 'react';
import { Target, AlertTriangle, TrendingDown } from 'lucide-react';
import type { DoubleDownMetric } from '../../../server/types/insights';

interface DoubleDownMetricCardProps {
  doubleDownMetric: DoubleDownMetric | null;
}

export default function DoubleDownMetricCard({ doubleDownMetric }: DoubleDownMetricCardProps) {
  if (!doubleDownMetric) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Double-Down Metric</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Data Available</p>
          <p className="text-sm text-slate-500">
            Complete more exams to identify your highest-priority weak area
          </p>
        </div>
      </div>
    );
  }

  const { domainName, proficiencyScore, domainWeight, priorityScore } = doubleDownMetric;

  // Calculate the gap (how much improvement is needed)
  const gap = 100 - proficiencyScore;

  return (
    <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-2xl border-2 border-rose-200 shadow-sm p-6 space-y-4">
      {/* Header with Double-Down Badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-rose-600" />
          Double-Down Metric
        </h4>
        <div className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg">
          Priority Focus
        </div>
      </div>

      {/* Alert Message */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-rose-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-slate-900 text-sm">
              Focus your study time here for maximum impact
            </p>
            <p className="text-xs text-slate-600 mt-1">
              This domain has the lowest proficiency and highest exam weight, making it your
              highest-priority area for improvement.
            </p>
          </div>
        </div>
      </div>

      {/* Domain Information */}
      <div className="bg-white rounded-xl p-5 space-y-4 border border-rose-100">
        <div className="flex items-center justify-between">
          <h5 className="text-base font-bold text-slate-900">{domainName}</h5>
          <div className="flex items-center gap-1 text-rose-600">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-bold">Weak Area</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Proficiency Score */}
          <div className="bg-slate-50 rounded-lg p-3 text-center space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Proficiency
            </p>
            <p className="text-2xl font-black text-rose-600">{Math.round(proficiencyScore)}%</p>
          </div>

          {/* Domain Weight */}
          <div className="bg-slate-50 rounded-lg p-3 text-center space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Exam Weight
            </p>
            <p className="text-2xl font-black text-indigo-600">{Math.round(domainWeight)}%</p>
          </div>

          {/* Priority Score */}
          <div className="bg-rose-100 rounded-lg p-3 text-center space-y-1">
            <p className="text-xs font-bold text-rose-700 uppercase tracking-widest">Priority</p>
            <p className="text-2xl font-black text-rose-700">{Math.round(priorityScore)}</p>
          </div>
        </div>

        {/* Gap Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">Improvement Needed</span>
            <span className="font-bold text-rose-600">{Math.round(gap)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 to-orange-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${gap}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action Recommendation */}
      <div className="bg-rose-600 text-white rounded-xl p-4 text-center space-y-2">
        <p className="font-bold text-sm">Recommended Action</p>
        <p className="text-xs opacity-90">
          Dedicate focused study sessions to {domainName} to maximize your score improvement
        </p>
      </div>
    </div>
  );
}
