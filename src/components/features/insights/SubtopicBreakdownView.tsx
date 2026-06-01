import React from 'react';
import { Layers, ArrowLeft, AlertTriangle, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { SubtopicProficiency } from '../../../server/types/insights';

interface SubtopicBreakdownViewProps {
  topicName: string;
  subtopics: SubtopicProficiency[];
  onBack?: () => void;
  onSubtopicClick?: (subtopicId: string) => void;
}

export default function SubtopicBreakdownView({
  topicName,
  subtopics,
  onBack,
  onSubtopicClick,
}: SubtopicBreakdownViewProps) {
  if (!subtopics || subtopics.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
          )}
          <div>
            <h4 className="text-lg font-bold text-slate-900">Subtopic Breakdown</h4>
            <p className="text-sm text-slate-500">{topicName}</p>
          </div>
        </div>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Subtopics Available</p>
          <p className="text-sm text-slate-500">No subtopic data found for this topic</p>
        </div>
      </div>
    );
  }

  // Sort subtopics by proficiency (lowest first), but put insufficient data at the end
  const sortedSubtopics = [...subtopics].sort((a, b) => {
    if (a.hasInsufficientData && !b.hasInsufficientData) return 1;
    if (!a.hasInsufficientData && b.hasInsufficientData) return -1;
    return a.proficiencyScore - b.proficiencyScore;
  });

  // Get color and icon based on proficiency score
  const getScoreStyle = (score: number, hasInsufficientData: boolean) => {
    if (hasInsufficientData) {
      return {
        bg: 'bg-slate-500',
        text: 'text-slate-600',
        ring: 'ring-slate-200',
        icon: AlertTriangle,
        iconColor: 'text-slate-500',
        label: 'Insufficient Data',
      };
    }
    if (score >= 80) {
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-600',
        ring: 'ring-emerald-200',
        icon: CheckCircle,
        iconColor: 'text-emerald-500',
        label: 'Strong',
      };
    }
    if (score >= 60) {
      return {
        bg: 'bg-amber-500',
        text: 'text-amber-600',
        ring: 'ring-amber-200',
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        label: 'Needs Practice',
      };
    }
    return {
      bg: 'bg-rose-500',
      text: 'text-rose-600',
      ring: 'ring-rose-200',
      icon: XCircle,
      iconColor: 'text-rose-500',
      label: 'Weak Area',
    };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
        )}
        <div className="flex-1">
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Subtopic Breakdown
          </h4>
          <p className="text-sm text-slate-500 mt-1">{topicName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total Subtopics</p>
          <p className="text-lg font-black text-slate-900">{subtopics.length}</p>
        </div>
      </div>

      {/* Subtopics List */}
      <div className="space-y-3">
        {sortedSubtopics.map((subtopic) => {
          const style = getScoreStyle(subtopic.proficiencyScore, subtopic.hasInsufficientData);
          const StatusIcon = style.icon;
          const isClickable = !!onSubtopicClick;

          return (
            <div
              key={subtopic.subtopicId}
              className={`bg-slate-50 rounded-xl p-4 border-2 border-slate-200 space-y-3 ${
                isClickable
                  ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group'
                  : ''
              }`}
              onClick={() => onSubtopicClick?.(subtopic.subtopicId)}
            >
              {/* Subtopic Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h5
                    className={`text-sm font-bold text-slate-900 ${isClickable ? 'group-hover:text-indigo-600 transition-colors' : ''}`}
                  >
                    {subtopic.subtopicName}
                  </h5>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusIcon className={`w-4 h-4 ${style.iconColor}`} />
                    <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
                    {isClickable && (
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    )}
                  </div>
                </div>

                {/* Score Display */}
                {subtopic.hasInsufficientData ? (
                  <div className="bg-slate-100 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Need More Data
                    </p>
                    <p className="text-xs text-slate-400 mt-1">&lt; 3 questions</p>
                  </div>
                ) : (
                  <div
                    className={`relative w-16 h-16 rounded-full ring-4 ${style.ring} bg-white flex items-center justify-center`}
                  >
                    <div className="text-center">
                      <p className={`text-xl font-black ${style.text}`}>
                        {Math.round(subtopic.proficiencyScore)}
                      </p>
                      <p className="text-xs text-slate-400 font-bold">%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Questions:</span>
                  <span className="font-bold text-slate-700">{subtopic.questionsAttempted}</span>
                </div>
                {!subtopic.hasInsufficientData && (
                  <>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Correct:</span>
                      <span className="font-bold text-emerald-600">
                        {subtopic.questionsCorrect}
                      </span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Incorrect:</span>
                      <span className="font-bold text-rose-600">
                        {subtopic.questionsAttempted - subtopic.questionsCorrect}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Bar (only if sufficient data) */}
              {!subtopic.hasInsufficientData && (
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${style.bg} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${subtopic.proficiencyScore}%` }}
                  />
                </div>
              )}

              {/* Insufficient Data Warning */}
              {subtopic.hasInsufficientData && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Answer at least 3 questions on this subtopic to see proficiency score
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200">
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
            Strong
          </p>
          <p className="text-2xl font-black text-emerald-700">
            {subtopics.filter((s) => !s.hasInsufficientData && s.proficiencyScore >= 80).length}
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">
            Needs Work
          </p>
          <p className="text-2xl font-black text-amber-700">
            {subtopics.filter((s) => !s.hasInsufficientData && s.proficiencyScore < 80).length}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">
            Insufficient
          </p>
          <p className="text-2xl font-black text-slate-700">
            {subtopics.filter((s) => s.hasInsufficientData).length}
          </p>
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-indigo-900 font-medium">
            {onSubtopicClick
              ? 'Click on any subtopic to see unit-level breakdown and identify the most granular knowledge gaps.'
              : 'Focus on subtopics with lower proficiency scores. Practice more questions on subtopics with insufficient data to get accurate proficiency measurements.'}
          </p>
        </div>
      </div>
    </div>
  );
}
