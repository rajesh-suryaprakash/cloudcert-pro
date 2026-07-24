import React, { useState } from 'react';
import { TrendingUp, Target, BookOpen, ArrowRight, X, Layers, Grid } from 'lucide-react';
import type { ROIScore } from '../../../server/types/insights';

interface ROIStudyRecommendationsProps {
  roiRecommendations: ROIScore[];
  certificationId?: string;
  onStartTopicQuiz?: (topicId: string, topicName: string) => void;
  onStartSubtopicQuiz?: (topicId: string, topicName: string, subtopicIds: string[]) => void;
}

export default function ROIStudyRecommendations({
  roiRecommendations,
  certificationId,
  onStartTopicQuiz,
  onStartSubtopicQuiz,
}: ROIStudyRecommendationsProps) {
  const [showQuizTypeModal, setShowQuizTypeModal] = useState(false);
  const [showSubtopicModal, setShowSubtopicModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; name: string } | null>(null);
  const [subtopics, setSubtopics] = useState<
    Array<{ id: string; name: string; proficiency: number }>
  >([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  const [loadingSubtopics, setLoadingSubtopics] = useState(false);

  const handleStartStudying = (topicId: string, topicName: string) => {
    console.warn('Start Studying clicked!', { topicId, topicName, certificationId });
    setSelectedTopic({ id: topicId, name: topicName });
    setShowQuizTypeModal(true);
  };

  const handleQuizTypeSelection = async (type: 'topic' | 'subtopic') => {
    if (!selectedTopic) return;

    setShowQuizTypeModal(false);

    if (type === 'topic' && onStartTopicQuiz) {
      onStartTopicQuiz(selectedTopic.id, selectedTopic.name);
      setSelectedTopic(null);
    } else if (type === 'subtopic') {
      // Fetch subtopics and show selection modal
      await fetchSubtopics(selectedTopic.id);
    }
  };

  const fetchSubtopics = async (topicId: string) => {
    if (!certificationId) return;

    setLoadingSubtopics(true);
    try {
      const response = await fetch(
        `/api/insights/topic/${topicId}/subtopics?certificationId=${certificationId}`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) throw new Error('Failed to fetch subtopics');

      const data = await response.json();
      setSubtopics(
        data.subtopics.map(
          (st: { subtopicId: string; subtopicName: string; proficiencyScore: number }) => ({
            id: st.subtopicId,
            name: st.subtopicName,
            proficiency: st.proficiencyScore,
          }),
        ),
      );
      setShowSubtopicModal(true);
    } catch (error) {
      console.error('Error fetching subtopics:', error);
      alert('Failed to load subtopics. Please try again.');
      setSelectedTopic(null);
    } finally {
      setLoadingSubtopics(false);
    }
  };

  const toggleSubtopic = (subtopicId: string) => {
    const newSelected = new Set(selectedSubtopics);
    if (newSelected.has(subtopicId)) {
      newSelected.delete(subtopicId);
    } else {
      newSelected.add(subtopicId);
    }
    setSelectedSubtopics(newSelected);
  };

  const handleStartSubtopicQuiz = () => {
    if (!selectedTopic || selectedSubtopics.size === 0) return;

    setShowSubtopicModal(false);

    if (onStartSubtopicQuiz) {
      // Pass all selected subtopics as an array
      const subtopicIds = Array.from(selectedSubtopics) as string[];
      onStartSubtopicQuiz(selectedTopic.id, selectedTopic.name, subtopicIds);
    } else {
      alert(
        `Starting subtopic quiz for: ${selectedTopic.name}\nSelected ${selectedSubtopics.size} subtopic(s)`,
      );
    }

    setSelectedTopic(null);
    setSelectedSubtopics(new Set());
  };
  if (!roiRecommendations || roiRecommendations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">ROI Study Recommendations</h4>
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-600">No Recommendations Available</p>
          <p className="text-sm text-slate-500">
            Complete more exams to receive personalized study recommendations
          </p>
        </div>
      </div>
    );
  }

  // Take top 5 recommendations
  const topRecommendations = roiRecommendations.slice(0, 5);

  // Calculate target proficiency (aim for 85%)
  const targetProficiency = 85;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            ROI Study Recommendations
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Topics ranked by potential score improvement per hour of study
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900 font-medium">
          Focus on these high-ROI topics to maximize your score improvement with limited study time
        </p>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {topRecommendations.map((recommendation, index) => {
          const isHighPriority = index === 0;

          return (
            <div
              key={recommendation.topicId}
              className={`rounded-xl p-5 space-y-4 border-2 transition-all ${
                isHighPriority
                  ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300 shadow-md'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Header with Rank Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                      isHighPriority ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <h5 className="text-base font-bold text-slate-900">
                      {recommendation.topicName}
                    </h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Domain Weight:{' '}
                      <span className="font-bold text-slate-700">
                        {Math.round(recommendation.domainWeight)}%
                      </span>
                    </p>
                  </div>
                </div>
                {isHighPriority && (
                  <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                    Top Pick
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Current Proficiency */}
                <div className="bg-white rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Current
                  </p>
                  <p className="text-2xl font-black text-rose-600">
                    {Math.round(recommendation.currentProficiency)}%
                  </p>
                </div>

                {/* Target Proficiency */}
                <div className="bg-white rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Target
                  </p>
                  <p className="text-2xl font-black text-emerald-600">{targetProficiency}%</p>
                </div>

                {/* Estimated Increase */}
                <div className="bg-white rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Est. Gain
                  </p>
                  <p className="text-2xl font-black text-indigo-600">
                    +{Math.round(recommendation.estimatedScoreIncrease)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Progress to Target</span>
                  <span className="font-bold text-slate-700">
                    {Math.min(
                      Math.round((recommendation.currentProficiency / targetProficiency) * 100),
                      100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((recommendation.currentProficiency / targetProficiency) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* ROI Score and Available Questions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-500">ROI Score: </span>
                    <span className="font-bold text-indigo-600">
                      {recommendation.roiScore.toFixed(2)}
                    </span>
                  </div>
                  <span>•</span>
                  <div>
                    <span className="text-slate-500">Available Questions: </span>
                    <span className="font-bold text-slate-700">
                      {recommendation.availableQuestions}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() =>
                  handleStartStudying(recommendation.topicId, recommendation.topicName)
                }
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  isHighPriority
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                    : 'bg-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Start Studying
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-600">
          Estimated score increases are based on one hour of focused study per topic
        </p>
      </div>

      {/* Quiz Type Selection Modal */}
      {showQuizTypeModal && selectedTopic && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white rounded-t-3xl relative">
              <button
                onClick={() => {
                  setShowQuizTypeModal(false);
                  setSelectedTopic(null);
                }}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-black">Choose Quiz Type</h3>
              <p className="text-indigo-200 text-sm mt-1">{selectedTopic.name}</p>
            </div>

            {/* Options */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-6">Select the scope of your practice quiz:</p>

              {/* Topic Quiz Option */}
              <button
                onClick={() => handleQuizTypeSelection('topic')}
                className="w-full p-5 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-100 group-hover:bg-indigo-600 flex items-center justify-center transition-colors">
                    <Layers className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 mb-1">Topic-Specific Quiz</h4>
                    <p className="text-sm text-slate-600">
                      Practice all questions from this entire topic
                    </p>
                  </div>
                </div>
              </button>

              {/* Subtopic Quiz Option */}
              <button
                onClick={() => handleQuizTypeSelection('subtopic')}
                disabled={loadingSubtopics}
                className="w-full p-5 rounded-xl border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-purple-100 group-hover:bg-purple-600 flex items-center justify-center transition-colors">
                    <Grid className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 mb-1">Sub-Topic-Specific Quiz</h4>
                    <p className="text-sm text-slate-600">
                      {loadingSubtopics
                        ? 'Loading subtopics...'
                        : 'Focus on specific sub-topics within this topic'}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setShowQuizTypeModal(false);
                  setSelectedTopic(null);
                }}
                className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtopic Selection Modal */}
      {showSubtopicModal && selectedTopic && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white rounded-t-3xl relative flex-shrink-0">
              <button
                onClick={() => {
                  setShowSubtopicModal(false);
                  setSelectedTopic(null);
                  setSelectedSubtopics(new Set());
                }}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-black">Select Sub-Topics</h3>
              <p className="text-purple-200 text-sm mt-1">{selectedTopic.name}</p>
            </div>

            {/* Subtopics List */}
            <div className="flex-1 overflow-y-auto p-6">
              {subtopics.length === 0 ? (
                <div className="text-center py-12">
                  <Grid className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-bold">No subtopics available</p>
                  <p className="text-sm text-slate-500 mt-2">
                    This topic doesn't have any subtopics defined yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-4">
                    Select one or more subtopics to practice ({selectedSubtopics.size} selected):
                  </p>
                  {subtopics.map((subtopic) => {
                    const isSelected = selectedSubtopics.has(subtopic.id);
                    const proficiencyColor =
                      subtopic.proficiency >= 80
                        ? 'text-emerald-600'
                        : subtopic.proficiency >= 60
                          ? 'text-yellow-600'
                          : 'text-rose-600';

                    return (
                      <button
                        key={subtopic.id}
                        onClick={() => toggleSubtopic(subtopic.id)}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                isSelected ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="w-4 h-4 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1">
                              <h5 className="font-bold text-slate-900">{subtopic.name}</h5>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                              Proficiency
                            </p>
                            <p className={`text-lg font-black ${proficiencyColor}`}>
                              {Math.round(subtopic.proficiency)}%
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex-shrink-0 space-y-3">
              <button
                onClick={handleStartSubtopicQuiz}
                disabled={selectedSubtopics.size === 0}
                className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Start Quiz with {selectedSubtopics.size} Subtopic
                {selectedSubtopics.size !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => {
                  setShowSubtopicModal(false);
                  setSelectedTopic(null);
                  setSelectedSubtopics(new Set());
                }}
                className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
