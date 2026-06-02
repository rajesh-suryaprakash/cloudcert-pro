import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';
import QuestionReviewCard from './QuestionReviewCard';

interface QuestionReviewData {
  id: string;
  questionText: string;
  options: string[];
  correctAnswers: string | string[];
  userAnswers: string[];
  isCorrect: boolean;
  explanation?: string;
  distractorExplanations?: Record<string, string>;
  sessionId: string;
  sessionDate: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface QuestionReviewViewProps {
  topicId: string;
  topicName: string;
  certificationId: string;
  onBack: () => void;
}

export default function QuestionReviewView({
  topicId,
  topicName,
  certificationId,
  onBack,
}: QuestionReviewViewProps) {
  const [questions, setQuestions] = useState<QuestionReviewData[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchQuestions = async (page: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/insights/topic/${topicId}/questions?certificationId=${certificationId}&page=${page}&limit=20`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to load questions');
      }

      const data = await response.json();
      setQuestions(data.questions || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions(currentPage);
    // fetchQuestions is defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, certificationId, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && pagination && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-8">
        {/* Previous button */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!pagination.hasPrev}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm"
            >
              1
            </button>
            {startPage > 2 && <span className="text-slate-400">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              page === currentPage
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < pagination.totalPages && (
          <>
            {endPage < pagination.totalPages - 1 && <span className="text-slate-400">...</span>}
            <button
              onClick={() => handlePageChange(pagination.totalPages)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm"
            >
              {pagination.totalPages}
            </button>
          </>
        )}

        {/* Next button */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!pagination.hasNext}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h4 className="text-lg font-bold text-slate-900">Question Review - {topicName}</h4>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="text-sm text-slate-400 font-bold animate-pulse">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h4 className="text-lg font-bold text-slate-900">Question Review - {topicName}</h4>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="font-bold text-red-900">Failed to load questions</p>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => fetchQuestions(currentPage)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h4 className="text-lg font-bold text-slate-900">Question Review - {topicName}</h4>
        </div>
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-8 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="font-bold text-emerald-900">No Incorrect Answers</p>
          <p className="text-sm text-emerald-600">
            You haven't answered any questions incorrectly for this topic yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Question Review - {topicName}
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                Review incorrect answers to understand your mistakes
              </p>
            </div>
          </div>
          {pagination && (
            <div className="text-right">
              <p className="text-xs text-slate-400">Questions</p>
              <p className="text-lg font-black text-slate-900">{pagination.total}</p>
            </div>
          )}
        </div>

        {/* Pagination Info */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {(currentPage - 1) * pagination.limit + 1} to{' '}
              {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total}{' '}
              questions
            </p>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question: QuestionReviewData, index: number) =>
          // key is passed as the 3rd arg to createElement — separate from props,
          // avoiding TS 5.8's JSX key-in-props type error (TS2322).
          React.createElement(QuestionReviewCard, {
            key: question.id,
            question,
            questionNumber: (currentPage - 1) * (pagination?.limit || 20) + index + 1,
          }),
        )}
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Footer Info */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900 font-medium">
          These questions show your most recent incorrect answers for this topic. Review the
          explanations to understand why each answer is correct or incorrect.
        </p>
      </div>
    </div>
  );
}
