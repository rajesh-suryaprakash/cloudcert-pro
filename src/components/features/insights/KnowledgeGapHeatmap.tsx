import React from 'react';
import { BarChart3, ChevronRight, AlertCircle } from 'lucide-react';
import type { DomainProficiency } from '../../../server/types/insights';

interface KnowledgeGapHeatmapProps {
  domainProficiency: DomainProficiency[];
  onDomainClick?: (domainId: string) => void;
}

export default function KnowledgeGapHeatmap({
  domainProficiency,
  onDomainClick,
}: KnowledgeGapHeatmapProps) {
  if (!domainProficiency || domainProficiency.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Knowledge Gap Heatmap</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Data Available</p>
          <p className="text-sm text-slate-500">
            Complete exams to see your proficiency across domains
          </p>
        </div>
      </div>
    );
  }

  // Sort domains by proficiency (lowest first to highlight gaps)
  const sortedDomains = [...domainProficiency].sort(
    (a, b) => a.proficiencyScore - b.proficiencyScore,
  );

  // Get color based on proficiency score
  const getScoreColor = (score: number) => {
    if (score >= 80)
      return { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' };
    if (score >= 60) return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' };
    return { bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Knowledge Gap Heatmap
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Proficiency across exam domains (click to drill down)
          </p>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="space-y-4">
        {sortedDomains.map((domain) => {
          const colors = getScoreColor(domain.proficiencyScore);
          const isClickable = !!onDomainClick;

          return (
            <div
              key={domain.domainId}
              className={`space-y-2 ${isClickable ? 'cursor-pointer group' : ''}`}
              onClick={() => onDomainClick?.(domain.domainId)}
            >
              {/* Domain Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <h5
                    className={`text-sm font-bold text-slate-900 ${isClickable ? 'group-hover:text-indigo-600 transition-colors' : ''}`}
                  >
                    {domain.domainName}
                  </h5>
                  {isClickable && (
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Weight:{' '}
                    <span className="font-bold text-slate-700">
                      {Math.round(domain.domainWeight)}%
                    </span>
                  </span>
                  <span className={`text-lg font-black ${colors.text}`}>
                    {Math.round(domain.proficiencyScore)}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="w-full bg-slate-100 rounded-full h-8 overflow-hidden">
                  <div
                    className={`${colors.bg} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                    style={{ width: `${domain.proficiencyScore}%` }}
                  >
                    {domain.proficiencyScore > 15 && (
                      <span className="text-xs font-bold text-white">
                        {domain.questionsCorrect}/{domain.questionsAttempted}
                      </span>
                    )}
                  </div>
                </div>
                {domain.proficiencyScore <= 15 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">
                    {domain.questionsCorrect}/{domain.questionsAttempted}
                  </span>
                )}
              </div>

              {/* Questions Info */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                  <span className="font-bold text-slate-700">{domain.questionsAttempted}</span>{' '}
                  questions attempted
                </span>
                <span>•</span>
                <span>
                  <span className="font-bold text-slate-700">{domain.questionsCorrect}</span>{' '}
                  correct
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <span className="text-xs text-slate-600">&lt; 60% (Needs Work)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-600">60-79% (Improving)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-600">≥ 80% (Strong)</span>
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-indigo-900 font-medium">
            Focus on domains with lower proficiency and higher exam weight for maximum impact
          </p>
        </div>
      </div>
    </div>
  );
}
