import React, { useState, useEffect } from 'react';
import {
  BookMarked,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Eye,
} from 'lucide-react';
import type { StudyListItem } from '../../../server/types/insights';
import QuestionReviewView from './QuestionReviewView';

interface StudyListViewProps {
  sessionId: string;
  certificationId: string;
  onRetryMissed?: (sessionId: string) => void;
}

export default function StudyListView({
  sessionId,
  certificationId,
  onRetryMissed: _onRetryMissed,
}: StudyListViewProps) {
  const [studyList, setStudyList] = useState<StudyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [retryLoading, setRetryLoading] = useState(false);
  const [reviewingTopic, setReviewingTopic] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchStudyList = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/insights/study-list/${sessionId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load study list');
        }
        const data = await response.json();
        setStudyList(data.studyList || []);

        // Persist study list to localStorage
        localStorage.setItem(`studyList_${sessionId}`, JSON.stringify(data.studyList || []));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load study list');

        // Try to load from localStorage if API fails
        const cached = localStorage.getItem(`studyList_${sessionId}`);
        if (cached) {
          setStudyList(JSON.parse(cached));
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStudyList();
  }, [sessionId]);

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const handleRetryMissed = async () => {
    setRetryLoading(true);
    try {
      const response = await fetch(`/api/insights/retry-missed/${sessionId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ randomizeOrder: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to create retry session');
      }

      const data = await response.json();

      // Navigate to the new exam session
      window.location.href = `/exam/${data.newSessionId}`;
    } catch (err) {
      console.error('Failed to retry missed questions:', err);
      alert('Failed to create retry session. Please try again.');
    } finally {
      setRetryLoading(false);
    }
  };

  const handleReviewQuestions = (topicId: string, topicName: string) => {
    setReviewingTopic({ id: topicId, name: topicName });
  };

  const handleBackToStudyList = () => {
    setReviewingTopic(null);
  };

  // If reviewing a topic, show the question review view
  if (reviewingTopic) {
    return (
      <QuestionReviewView
        topicId={reviewingTopic.id}
        topicName={reviewingTopic.name}
        certificationId={certificationId}
        onBack={handleBackToStudyList}
      />
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Study List</h4>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="text-sm text-slate-400 font-bold animate-pulse">Loading study list...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Study List</h4>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="font-bold text-red-900">Failed to load study list</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (studyList.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Study List</h4>
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-8 text-center space-y-3">
          <BookMarked className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="font-bold text-emerald-900">Perfect Score!</p>
          <p className="text-sm text-emerald-600">
            You answered all questions correctly. No topics need review.
          </p>
        </div>
      </div>
    );
  }

  // Sort by priority (incorrectCount descending)
  const sortedStudyList = [...studyList].sort((a, b) => b.incorrectCount - a.incorrectCount);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-indigo-600" />
            Study List
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Topics with incorrect answers, ranked by priority
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Topics to Review</p>
          <p className="text-lg font-black text-slate-900">{studyList.length}</p>
        </div>
      </div>

      {/* Retry Missed Questions Button */}
      <button
        onClick={handleRetryMissed}
        disabled={retryLoading}
        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw className={`w-4 h-4 ${retryLoading ? 'animate-spin' : ''}`} />
        {retryLoading ? 'Creating Retry Session...' : 'Retry Missed Questions'}
      </button>

      {/* Study List Items */}
      <div className="space-y-3">
        {sortedStudyList.map((item, index) => {
          const isExpanded = expandedTopics.has(item.topicId);
          const hasSubtopics = item.subtopics && item.subtopics.length > 0;

          return (
            <div
              key={item.topicId}
              className="bg-slate-50 rounded-xl border-2 border-slate-200 overflow-hidden transition-all hover:border-slate-300"
            >
              {/* Topic Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Priority Badge */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                        index === 0
                          ? 'bg-rose-600 text-white'
                          : index === 1
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {index + 1}
                    </div>

                    {/* Topic Info */}
                    <div className="flex-1">
                      <h5 className="text-base font-bold text-slate-900">{item.topicName}</h5>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>
                          <span className="font-bold text-rose-600">{item.incorrectCount}</span>{' '}
                          incorrect {item.incorrectCount === 1 ? 'answer' : 'answers'}
                        </span>
                        {item.priority && (
                          <>
                            <span>•</span>
                            <span>
                              Priority:{' '}
                              <span className="font-bold text-slate-700">{item.priority}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Review Questions Button */}
                    <button
                      onClick={() => handleReviewQuestions(item.topicId, item.topicName)}
                      className="flex-shrink-0 p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                      title="Review Questions"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Documentation Link */}
                    {item.docUrl && (
                      <a
                        href={item.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="View Documentation"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Expand/Collapse Button for Subtopics */}
                {hasSubtopics && (
                  <button
                    onClick={() => toggleTopic(item.topicId)}
                    className="w-full flex items-center justify-between py-2 px-3 bg-white rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold text-slate-700"
                  >
                    <span>
                      {isExpanded ? 'Hide' : 'Show'} Subtopics ({item.subtopics.length})
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {/* Subtopics List (Expandable) */}
              {hasSubtopics && isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Subtopics to Review
                    </p>
                    <ul className="space-y-1">
                      {item.subtopics.map((subtopic, idx) => (
                        <li key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          {subtopic}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900 font-medium">
          This study list persists across sessions. Focus on topics with the most incorrect answers
          first.
        </p>
      </div>
    </div>
  );
}
