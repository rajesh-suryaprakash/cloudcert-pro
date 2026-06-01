import React from 'react';
import { Users, TrendingUp, TrendingDown, Award, AlertCircle } from 'lucide-react';
import type { CommunityBenchmark } from '../../../server/types/insights';

interface CommunityBenchmarkComparisonProps {
  communityBenchmarks: CommunityBenchmark[];
  userPercentile?: number;
}

export default function CommunityBenchmarkComparison({
  communityBenchmarks,
  userPercentile,
}: CommunityBenchmarkComparisonProps) {
  if (!communityBenchmarks || communityBenchmarks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Community Benchmark</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Benchmark Data Available</p>
          <p className="text-sm text-slate-500">
            Community benchmarks will be available once sufficient users report passing the real
            exam
          </p>
        </div>
      </div>
    );
  }

  // Sort benchmarks by difference (lowest first to highlight areas needing improvement)
  const sortedBenchmarks = [...communityBenchmarks].sort((a, b) => a.difference - b.difference);

  // Calculate overall comparison
  const belowAverageCount = communityBenchmarks.filter((b) => b.needsImprovement).length;
  const totalCount = communityBenchmarks.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Community Benchmark Comparison
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Compare your performance to users who passed the real exam
          </p>
        </div>
      </div>

      {/* Percentile Ranking (if available) */}
      {userPercentile !== undefined && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border-2 border-indigo-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 rounded-full p-3">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-600">Your Percentile Ranking</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compared to all users who took this certification
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-indigo-600">{Math.round(userPercentile)}</p>
              <p className="text-sm font-bold text-indigo-700">percentile</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Total Domains/Topics
          </p>
          <p className="text-3xl font-black text-slate-900">{totalCount}</p>
        </div>
        <div
          className={`rounded-xl p-4 space-y-2 ${
            belowAverageCount > 0 ? 'bg-amber-50' : 'bg-emerald-50'
          }`}
        >
          <p
            className={`text-xs font-bold uppercase tracking-widest ${
              belowAverageCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            Below Average
          </p>
          <p
            className={`text-3xl font-black ${
              belowAverageCount > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {belowAverageCount}
          </p>
        </div>
      </div>

      {/* Benchmark Comparison Table */}
      <div className="space-y-3">
        <h5 className="text-sm font-bold text-slate-700">Performance by Domain/Topic</h5>
        <div className="space-y-2">
          {sortedBenchmarks.map((benchmark) => {
            const isAboveAverage = benchmark.difference >= 0;
            const isAboveThreshold = benchmark.userScore >= benchmark.typicalPassingThreshold;

            return (
              <div
                key={benchmark.domainId || benchmark.topicId || benchmark.name}
                className={`rounded-xl p-4 border-2 transition-all ${
                  benchmark.needsImprovement
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h6 className="font-bold text-slate-900 text-sm">{benchmark.name}</h6>
                  <div className="flex items-center gap-2">
                    {isAboveAverage ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-bold">Above Avg</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-rose-600">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs font-bold">Below Avg</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scores Comparison */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Your Score</p>
                    <p
                      className={`text-xl font-black ${
                        isAboveThreshold ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {Math.round(benchmark.userScore)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Community Avg</p>
                    <p className="text-xl font-black text-indigo-600">
                      {Math.round(benchmark.communityAverage)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Difference</p>
                    <p
                      className={`text-xl font-black ${
                        isAboveAverage ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {benchmark.difference > 0 ? '+' : ''}
                      {Math.round(benchmark.difference)}%
                    </p>
                  </div>
                </div>

                {/* Visual Comparison Bar */}
                <div className="space-y-2">
                  {/* User Score Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">You</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAboveThreshold ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${benchmark.userScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Community Average Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">Community</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${benchmark.communityAverage}%` }}
                      />
                    </div>
                  </div>

                  {/* Passing Threshold Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-16">Threshold</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden relative">
                      <div
                        className="bg-slate-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${benchmark.typicalPassingThreshold}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-10 text-right">
                      {Math.round(benchmark.typicalPassingThreshold)}%
                    </span>
                  </div>
                </div>

                {/* Needs Improvement Alert */}
                {benchmark.needsImprovement && (
                  <div className="mt-3 bg-rose-100 border border-rose-200 rounded-lg p-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <p className="text-xs text-rose-700 font-medium">
                      Focus area: Your score is below the community average for users who passed
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-indigo-900 font-medium">
            Community averages are calculated from users who reported passing the real certification
            exam. Use these benchmarks to identify areas where you need to reach passing standards.
          </p>
        </div>
      </div>
    </div>
  );
}
