import React from 'react';
import { BookOpen, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import type { TopicProficiency } from '../../../server/types/insights';

interface TopicBreakdownViewProps {
  domainName: string;
  topics: TopicProficiency[];
  onTopicClick?: (topicId: string) => void;
  onBack?: () => void;
}

export default function TopicBreakdownView({
  domainName,
  topics,
  onTopicClick,
  onBack,
}: TopicBreakdownViewProps) {
  if (!topics || topics.length === 0) {
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
            <h4 className="text-lg font-bold text-slate-900">Topic Breakdown</h4>
            <p className="text-sm text-slate-500">{domainName}</p>
          </div>
        </div>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Topics Available</p>
          <p className="text-sm text-slate-500">No topic data found for this domain</p>
        </div>
      </div>
    );
  }

  // Sort topics by proficiency (lowest first)
  const sortedTopics = [...topics].sort((a, b) => a.proficiencyScore - b.proficiencyScore);

  // Get color based on proficiency score
  const getScoreColor = (score: number) => {
    if (score >= 80)
      return { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-200' };
    if (score >= 60) return { bg: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-200' };
    return { bg: 'bg-rose-500', text: 'text-rose-600', ring: 'ring-rose-200' };
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
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Topic Breakdown
          </h4>
          <p className="text-sm text-slate-500 mt-1">{domainName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total Topics</p>
          <p className="text-lg font-black text-slate-900">{topics.length}</p>
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedTopics.map((topic) => {
          const colors = getScoreColor(topic.proficiencyScore);
          const isClickable = !!onTopicClick;

          return (
            <div
              key={topic.topicId}
              className={`bg-slate-50 rounded-xl p-4 space-y-3 border-2 border-slate-200 ${
                isClickable
                  ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group'
                  : ''
              }`}
              onClick={() => onTopicClick?.(topic.topicId)}
            >
              {/* Topic Header */}
              <div className="flex items-start justify-between gap-2">
                <h5
                  className={`text-sm font-bold text-slate-900 flex-1 ${isClickable ? 'group-hover:text-indigo-600 transition-colors' : ''}`}
                >
                  {topic.topicName}
                </h5>
                {isClickable && (
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                )}
              </div>

              {/* Proficiency Score Circle */}
              <div className="flex items-center gap-4">
                <div
                  className={`relative w-16 h-16 rounded-full ring-4 ${colors.ring} bg-white flex items-center justify-center`}
                >
                  <div className="text-center">
                    <p className={`text-xl font-black ${colors.text}`}>
                      {Math.round(topic.proficiencyScore)}
                    </p>
                    <p className="text-xs text-slate-400 font-bold">%</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Questions</span>
                    <span className="font-bold text-slate-700">{topic.questionsAttempted}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Correct</span>
                    <span className="font-bold text-slate-700">{topic.questionsCorrect}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Incorrect</span>
                    <span className="font-bold text-slate-700">
                      {topic.questionsAttempted - topic.questionsCorrect}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`${colors.bg} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${topic.proficiencyScore}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Note */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-indigo-900 font-medium">
            Click on any topic to see subtopic-level breakdown and identify specific areas for
            improvement
          </p>
        </div>
      </div>
    </div>
  );
}
