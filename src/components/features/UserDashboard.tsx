/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { type PageSize } from '../../hooks/usePagination';
import { useClampedInput } from '../../hooks/useClampedInput';
import {
  Trophy,
  ChevronRight,
  ArrowLeft,
  FileText,
  TrendingUp,
  Layers,
  Shuffle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type Difficulty } from '../../hooks/customQuizUtils';
import { ScoreChart } from './dashboard/ScoreChart';
import { DashboardMetrics } from './dashboard/DashboardMetrics';
import { ExamHistoryTable } from './dashboard/ExamHistoryTable';
import { CertificationSelector } from './dashboard/CertificationSelector';
import { QuizWizard } from './dashboard/QuizWizard';

export default function UserDashboard({
  onStartQuiz,
  onStartTopicQuiz,
  onViewAttempt,
  onStartCustomQuiz,
  onViewInsights,
}: {
  onStartQuiz: (cert: any, exam: any, isPracticeMode: boolean) => void;
  onStartTopicQuiz: (
    cert: any,
    topic: any,
    config?: {
      difficulty?: string;
      numQuestions?: number;
      duration?: number;
      passingScore?: number;
    },
  ) => void;
  onViewAttempt: (attempt: any) => void;
  onStartCustomQuiz?: (cert: any, difficulty: Difficulty, count: number) => Promise<void>;
  onViewInsights?: (certId: string, certTitle: string, sessionId?: string) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { certificationId } = useParams<{ certificationId?: string }>();
  const [certs, setCerts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertForExams, setSelectedCertForExams] = useState<any>(null);
  const [certExams, setCertExams] = useState<any[]>([]);
  const [certTopics, setCertTopics] = useState<any[]>([]);
  const [examToStart, setExamToStart] = useState<any>(null);
  const [loadingExams, setLoadingExams] = useState(false);

  // Filter state - Default to showing all types and difficulties
  const [examTypeFilter, setExamTypeFilter] = useState<
    'mock' | 'practice' | 'topic' | 'custom' | 'all'
  >('all');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');

  // Session config modal state -- only mock/practice; topic & custom have their own flows
  type TestType = 'mock' | 'practice';
  const [sessionConfig, setSessionConfig] = useState<{
    testType: TestType;
    difficulty: Difficulty;
    numQuestions: number;
    duration: number;
    passingScore: number;
  }>({ testType: 'mock', difficulty: 'Mixed', numQuestions: 50, duration: 60, passingScore: 70 });
  const [sessionStarting, setSessionStarting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [_selectedTopicForConfig, setSelectedTopicForConfig] = useState<any>(null);
  const [_topicError] = useState<string | null>(null);

  // Direct-access flows for Topic-wise and Custom Quiz
  const [showTopicFlow, setShowTopicFlow] = useState(false);
  const [showCustomFlow, setShowCustomFlow] = useState(false);
  const [topicFlowConfig, setTopicFlowConfig] = useState<{
    selectedTopic: any | null;
    difficulty: Difficulty;
    numQuestions: number;
    duration: number;
    passingScore: number;
  }>({
    selectedTopic: null,
    difficulty: 'Mixed',
    numQuestions: 20,
    duration: 30,
    passingScore: 70,
  });
  const [topicFlowStarting, setTopicFlowStarting] = useState(false);
  const [topicFlowError, setTopicFlowError] = useState<string | null>(null);
  const [customConfig, setCustomConfig] = useState<{
    difficulty: Difficulty;
    numQuestions: number;
  }>({ difficulty: 'Mixed', numQuestions: 10 });
  const [customStarting, setCustomStarting] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // ── Clamped numeric inputs (deferred validation on blur, free typing during edit) ──
  const sessionNumQuestionsInput = useClampedInput(
    sessionConfig.numQuestions,
    (v) => setSessionConfig((prev) => ({ ...prev, numQuestions: v })),
    5,
    60,
  );
  const sessionDurationInput = useClampedInput(
    sessionConfig.duration,
    (v) => setSessionConfig((prev) => ({ ...prev, duration: v })),
    5,
    120,
  );
  const sessionPassingScoreInput = useClampedInput(
    sessionConfig.passingScore,
    (v) => setSessionConfig((prev) => ({ ...prev, passingScore: v })),
    70,
    100,
  );
  const topicNumQuestionsInput = useClampedInput(
    topicFlowConfig.numQuestions,
    (v) => setTopicFlowConfig((prev) => ({ ...prev, numQuestions: v })),
    5,
    60,
  );
  const topicDurationInput = useClampedInput(
    topicFlowConfig.duration,
    (v) => setTopicFlowConfig((prev) => ({ ...prev, duration: v })),
    5,
    120,
  );
  const customNumQuestionsInput = useClampedInput(
    customConfig.numQuestions,
    (v) => setCustomConfig((prev) => ({ ...prev, numQuestions: v })),
    5,
    60,
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const certsData = await fetchApi('/certifications');
      setCerts(certsData);

      // If certificationId is in URL, load that certification
      if (certificationId) {
        const cert = certsData.find((c: any) => c.id === certificationId);
        if (cert) {
          setSelectedCertForExams(cert);
          setLoadingExams(true);
          try {
            const [examsData, topicsData] = await Promise.all([
              fetchApi(`/certifications/${cert.id}/exams`),
              fetchApi(`/certifications/${cert.id}/topics`),
            ]);
            setCertExams(examsData);
            setCertTopics(topicsData);
          } catch (e) {
            console.error(e);
          }
          setLoadingExams(false);
        }
      }

      if (user) {
        // Add cache-busting parameter to force fresh data
        const timestamp = Date.now();
        const historyData = await fetchApi(`/exam-sessions?_t=${timestamp}`);
        setHistory(
          historyData.sort(
            (a: { createdAt: string }, b: { createdAt: string }) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user, certificationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCertClick = async (cert: any) => {
    navigate(`/dashboard/${cert.id}`);
  };

  // Filter sessions to only those explicitly linked to the selected cert
  const certExamIds = new Set(certExams.map((e) => e.id));
  const certId = selectedCertForExams?.id;

  // Helper function to determine exam type from session data
  const getExamType = (session: any): 'mock' | 'practice' | 'topic' | 'custom' => {
    if (session.isCustomQuiz === 1) return 'custom';
    if (session.isTopicQuiz === 1 || (session.topicId && session.isPracticeMode === 1))
      return 'topic';
    if (session.isPracticeMode === 1) return 'practice';
    if (session.isPracticeMode === 0) return 'mock';

    const examName = session.examName || session.sessionName || '';
    const lowerName = examName.toLowerCase();
    if (lowerName.includes('custom quiz')) return 'custom';
    if (lowerName.includes('topic practice') || lowerName.includes('topic quiz')) return 'topic';
    if (lowerName.includes('practice') && !lowerName.includes('topic')) return 'practice';
    return 'mock';
  };

  // Helper function to extract difficulty from session data
  const getDifficulty = (session: any): Difficulty => {
    if (session.difficulty) return session.difficulty as Difficulty;
    const name = session.sessionName || session.examName || '';
    if (name.includes('Easy')) return 'Easy';
    if (name.includes('Medium')) return 'Medium';
    if (name.includes('Hard')) return 'Hard';
    return 'Mixed';
  };

  const certHistoryBase = selectedCertForExams
    ? history.filter((h: any) => {
        const matchesCertId =
          (h.resolvedCertId && h.resolvedCertId === certId) ||
          (h.certificationId && h.certificationId === certId) ||
          (h.examConfigurationId && certExamIds.has(h.examConfigurationId));

        const isInProgress = h.status === 'in_progress' || h.status === 'paused';

        // Hide all "In Progress" or "Paused" exams from the dashboard history
        if (isInProgress) {
          return false;
        }

        return matchesCertId;
      })
    : [];

  // Apply filters
  const certHistoryDisplay = certHistoryBase.filter((h: any) => {
    const examType = getExamType(h);
    const difficulty = getDifficulty(h);

    // Apply exam type filter (skip if "all" selected)
    if (examTypeFilter !== 'all' && examType !== examTypeFilter) return false;

    // Apply difficulty filter (skip if "all" selected)
    if (difficultyFilter !== 'all' && difficulty !== difficultyFilter) return false;

    return true;
  });

  const certStats = {
    totalAttempts: certHistoryDisplay.length,
    averageScore:
      certHistoryDisplay.length > 0
        ? Math.round(
            certHistoryDisplay.reduce((acc, curr) => acc + (curr.score || 0), 0) /
              certHistoryDisplay.length,
          )
        : 0,
    passedExams: certHistoryDisplay.filter((h) => h.score >= h.passingScore).length,
    bestScore:
      certHistoryDisplay.length > 0 ? Math.max(...certHistoryDisplay.map((h) => h.score || 0)) : 0,
  };

  // Search + Pagination + Favorites for the certifications grid -- must be before any early returns (Rules of Hooks)
  const [certSearch, setCertSearch] = useState('');
  const [certPage, setCertPage] = useState(1);
  const [certPageSize, setCertPageSize] = useState<PageSize>(8);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Favorites stored in localStorage per user -- persists across sessions without backend changes
  const favKey = `cert_favorites_${user?.id ?? 'guest'}`;
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(favKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (certId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(certId)) {
        next.delete(certId);
      } else {
        next.add(certId);
      }
      try {
        localStorage.setItem(favKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        <p className="text-slate-400 font-bold animate-pulse">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <div className="space-y-1">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">
          Welcome back, <span className="text-indigo-600">{user?.name?.split(' ')[0]}</span>!
        </h2>
        <p className="text-slate-500 text-lg font-medium">
          Ready to crush your next cloud certification?
        </p>
      </div>

      {!selectedCertForExams ? (
        <CertificationSelector
          certs={certs}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          showFavoritesOnly={showFavoritesOnly}
          setShowFavoritesOnly={setShowFavoritesOnly}
          certSearch={certSearch}
          setCertSearch={setCertSearch}
          certPage={certPage}
          setCertPage={setCertPage}
          certPageSize={certPageSize}
          setCertPageSize={setCertPageSize}
          onCertSelect={handleCertClick}
        />
      ) : (
        /* -- Cert detail: single column -- stats at top, then exams + history below -- */
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Back + title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{selectedCertForExams.title}</h3>
              <p className="text-sm text-slate-500">Select an exam to begin</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Exam Type Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Exam Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All Types' },
                    { value: 'mock', label: 'Mock Test' },
                    { value: 'practice', label: 'Practice' },
                    { value: 'topic', label: 'Topic Quiz' },
                    { value: 'custom', label: 'Custom' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setExamTypeFilter(type.value as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        examTypeFilter === type.value
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Difficulty
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All Levels' },
                    { value: 'Easy', label: 'Easy' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'Hard', label: 'Hard' },
                    { value: 'Mixed', label: 'Mixed' },
                  ].map((diff) => (
                    <button
                      key={diff.value}
                      onClick={() => setDifficultyFilter(diff.value as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        difficultyFilter === diff.value
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {diff.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active filters indicator */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">Active filters:</span>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">
                {examTypeFilter.charAt(0).toUpperCase() + examTypeFilter.slice(1)}
              </span>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">
                {difficultyFilter}
              </span>
              <button
                onClick={() => {
                  setExamTypeFilter('mock');
                  setDifficultyFilter('Easy');
                }}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Reset to Defaults
              </button>
            </div>
          </div>

          {/* Stats cards -- top of page */}
          <DashboardMetrics stats={certStats} />

          {/* Score chart */}
          {certHistoryDisplay.filter((h) => h.score !== null).length >= 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-indigo-600" /> Score History
              </h4>
              <ScoreChart
                attempts={certHistoryDisplay
                  .filter((h) => h.score !== null)
                  .slice(0, 20)
                  .reverse()}
              />
            </div>
          )}

          {/* Available Exams */}
          {loadingExams ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : certExams.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
              <FileText className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="font-bold text-slate-900">No exams configured.</p>
              <p className="text-sm text-slate-500">
                Admins need to create mock exams for this certification.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h4 className="font-bold text-slate-900 text-lg">{selectedCertForExams.title}</h4>

              {/* View Analytics Button - only show if user has completed at least one exam */}
              {certHistoryDisplay.length > 0 && onViewInsights && (
                <button
                  onClick={() =>
                    onViewInsights(selectedCertForExams.id, selectedCertForExams.title)
                  }
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all text-lg flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  View Insights Dashboard
                </button>
              )}

              {/* All exam configurations -- each is independently selectable */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {certExams.length === 1
                    ? 'Available Exam'
                    : `Available Exams (${certExams.length})`}
                </p>
                {certExams.map((exam: any) => (
                  <button
                    key={exam.id}
                    onClick={() => {
                      setExamToStart(exam);
                      setSessionConfig({
                        testType: 'mock',
                        difficulty: 'Mixed',
                        numQuestions: Math.min(exam.totalQuestions, 50),
                        duration: exam.duration ?? 60,
                        passingScore: exam.passingScore ?? 70,
                      });
                      setSessionError(null);
                    }}
                    className="w-full text-left p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 group-hover:text-indigo-700 truncate">
                          {exam.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500">
                            {exam.totalQuestions} questions
                          </span>
                          <span className="text-xs text-slate-500">{exam.duration} min</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                            {(exam.questionSelectionStrategy ?? 'random').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center">
                Select an exam to configure test type, difficulty, and more
              </p>
            </div>
          )}

          {/* Practice Tools -- Topic-wise and Custom Quiz */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" /> Practice Tools
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Topic-wise */}
              <button
                onClick={() => {
                  setShowTopicFlow(true);
                  setShowCustomFlow(false);
                }}
                className="p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-xl transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Layers className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm group-hover:text-amber-700">
                    Topic-wise Practice
                  </p>
                </div>
                <p className="text-xs text-slate-500">Practice questions from a specific topic</p>
              </button>
              {/* Custom Quiz */}
              {onStartCustomQuiz && (
                <button
                  onClick={() => {
                    setShowCustomFlow(true);
                    setShowTopicFlow(false);
                  }}
                  className="p-4 bg-violet-50 hover:bg-violet-100 border border-violet-200 hover:border-violet-300 rounded-xl transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Shuffle className="w-4 h-4 text-violet-600" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm group-hover:text-violet-700">
                      Custom Quiz
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Build your own quiz with custom difficulty and count
                  </p>
                </button>
              )}
            </div>

            {/* Topic-wise inline flow */}
            <AnimatePresence>
              {showTopicFlow && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-amber-800">Topic-wise Practice</p>
                    <button
                      onClick={() => {
                        setShowTopicFlow(false);
                        setTopicFlowConfig((prev) => ({ ...prev, selectedTopic: null }));
                        setTopicFlowError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      &#x2715; Close
                    </button>
                  </div>
                  {!topicFlowConfig.selectedTopic ? (
                    <>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Select Topic
                      </p>
                      <div className="grid gap-2 max-h-48 overflow-y-auto">
                        {certTopics.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">
                            No topics available for this certification.
                          </p>
                        ) : (
                          certTopics.map((topic) => (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() =>
                                setTopicFlowConfig((prev) => ({ ...prev, selectedTopic: topic }))
                              }
                              className="flex items-center justify-between p-3 bg-white border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors text-left"
                            >
                              <span className="font-bold text-slate-800 text-sm">
                                {topic.title}
                              </span>
                              <span className="text-xs font-bold text-amber-600">
                                Configure &#x2192;
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setTopicFlowConfig((prev) => ({ ...prev, selectedTopic: null }))
                          }
                          className="text-xs font-bold text-amber-700 hover:text-amber-900"
                        >
                          &#x2190; Back
                        </button>
                        <span className="text-xs text-slate-400">|</span>
                        <span className="text-xs font-bold text-slate-700 truncate">
                          {topicFlowConfig.selectedTopic.title}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Difficulty Filter (Optional)
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {(['Easy', 'Medium', 'Hard', 'Mixed'] as Difficulty[]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                setTopicFlowConfig((prev) => ({ ...prev, difficulty: d }))
                              }
                              className={`px-3 py-1.5 rounded-lg font-bold text-xs border-2 transition-all ${
                                topicFlowConfig.difficulty === d
                                  ? 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-slate-200 text-slate-600 hover:border-amber-300'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Questions{' '}
                            <span className="normal-case font-normal text-slate-400">(5-60)</span>
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={60}
                            {...topicNumQuestionsInput.inputProps}
                            className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-slate-900 font-bold text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Duration (min){' '}
                            <span className="normal-case font-normal text-slate-400">(5-120)</span>
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={120}
                            {...topicDurationInput.inputProps}
                            className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-slate-900 font-bold text-sm"
                          />
                        </div>
                      </div>
                      {topicFlowError && (
                        <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                          {topicFlowError}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={topicFlowStarting}
                        onClick={async () => {
                          setTopicFlowStarting(true);
                          setTopicFlowError(null);
                          try {
                            await onStartTopicQuiz(
                              selectedCertForExams,
                              topicFlowConfig.selectedTopic,
                              {
                                difficulty: topicFlowConfig.difficulty,
                                numQuestions: topicFlowConfig.numQuestions,
                                duration: topicFlowConfig.duration,
                                passingScore: topicFlowConfig.passingScore,
                              },
                            );
                            setShowTopicFlow(false);
                            setTopicFlowConfig((prev) => ({ ...prev, selectedTopic: null }));
                          } catch (e: any) {
                            setTopicFlowError(e?.message ?? 'Failed to start topic quiz.');
                          }
                          setTopicFlowStarting(false);
                        }}
                        className="w-full py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all disabled:opacity-60 text-sm"
                      >
                        {topicFlowStarting ? 'Starting...' : 'Start Topic Quiz'}
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Quiz inline flow */}
            <AnimatePresence>
              {showCustomFlow && onStartCustomQuiz && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="border border-violet-200 rounded-xl p-4 bg-violet-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-violet-800">Custom Quiz</p>
                    <button
                      onClick={() => {
                        setShowCustomFlow(false);
                        setCustomError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      &#x2715; Close
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Difficulty Filter (Optional)
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(['Easy', 'Medium', 'Hard', 'Mixed'] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCustomConfig((prev) => ({ ...prev, difficulty: d }))}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs border-2 transition-all ${
                            customConfig.difficulty === d
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-slate-200 text-slate-600 hover:border-violet-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Number of Questions{' '}
                      <span className="normal-case font-normal text-slate-400">(5-60)</span>
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      {...customNumQuestionsInput.inputProps}
                      className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-violet-400 text-slate-900 font-bold text-sm"
                    />
                  </div>
                  {customError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                      {customError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={customStarting}
                    onClick={async () => {
                      setCustomStarting(true);
                      setCustomError(null);
                      try {
                        await onStartCustomQuiz(
                          selectedCertForExams,
                          customConfig.difficulty,
                          customConfig.numQuestions,
                        );
                        setShowCustomFlow(false);
                      } catch (e: any) {
                        setCustomError(e?.message ?? 'Failed to start custom quiz.');
                      }
                      setCustomStarting(false);
                    }}
                    className="w-full py-3 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all disabled:opacity-60 text-sm"
                  >
                    {customStarting ? 'Starting...' : 'Start Custom Quiz'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Exam history */}
          <ExamHistoryTable
            attempts={certHistoryDisplay}
            onViewAttempt={onViewAttempt}
            getDifficulty={getDifficulty}
          />
        </motion.div>
      )}

      {/* Session Configuration Modal */}
      <AnimatePresence>
        {examToStart && (
          <QuizWizard
            examToStart={examToStart}
            sessionConfig={sessionConfig}
            setSessionConfig={setSessionConfig}
            sessionStarting={sessionStarting}
            sessionError={sessionError}
            sessionNumQuestionsInput={sessionNumQuestionsInput}
            sessionDurationInput={sessionDurationInput}
            sessionPassingScoreInput={sessionPassingScoreInput}
            onCancel={() => {
              setExamToStart(null);
              setSessionError(null);
              setSelectedTopicForConfig(null);
            }}
            onStart={async () => {
              setSessionStarting(true);
              setSessionError(null);
              try {
                const isPractice = sessionConfig.testType === 'practice';
                const isDifficultyBalanced =
                  examToStart.questionSelectionStrategy === 'difficulty_balanced';
                const effectiveDifficulty = isDifficultyBalanced
                  ? 'Mixed'
                  : sessionConfig.difficulty;
                const examOverride = {
                  ...examToStart,
                  totalQuestions: sessionConfig.numQuestions,
                  duration: isPractice ? 999 : sessionConfig.duration,
                  passingScore: sessionConfig.passingScore,
                  isPracticeMode: isPractice,
                  _difficulty: effectiveDifficulty,
                  _numQuestions: sessionConfig.numQuestions,
                  _duration: isPractice ? undefined : sessionConfig.duration,
                  _passingScore: sessionConfig.passingScore,
                };
                await onStartQuiz(selectedCertForExams, examOverride, isPractice);
                setExamToStart(null);
              } catch (e: any) {
                setSessionError(e?.message ?? 'Failed to start session.');
              } finally {
                setSessionStarting(false);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
