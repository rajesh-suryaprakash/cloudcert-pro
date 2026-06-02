/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchApi } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { paginate, type PageSize } from '../../hooks/usePagination';
import Pagination from '../ui/Pagination';
import { useClampedInput } from '../../hooks/useClampedInput';
import {
  Clock,
  Trophy,
  ChevronRight,
  BookOpen,
  Target,
  Award,
  BrainCircuit,
  ArrowLeft,
  FileText,
  AlertCircle,
  TrendingUp,
  Search,
  Heart,
  Layers,
  Shuffle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type Difficulty } from '../../hooks/customQuizUtils';

function ScoreChart({ attempts }: { attempts: any[] }) {
  const W = 600,
    H = 160,
    PAD = 32;
  const scores = attempts.map((a) => Math.round(a.score || 0));
  const min = Math.max(0, Math.min(...scores) - 10);
  const max = Math.min(100, Math.max(...scores) + 10);
  const xStep = (W - PAD * 2) / Math.max(scores.length - 1, 1);
  const yScale = (s: number) => H - PAD - ((s - min) / (max - min || 1)) * (H - PAD * 2);
  const points = scores.map((s, i) => `${PAD + i * xStep},${yScale(s)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Score history chart">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <text
            x={PAD - 8}
            y={yScale(v)}
            textAnchor="end"
            fontSize="10"
            fill="#94a3b8"
            dominantBaseline="middle"
          >
            {v}%
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinejoin="round"
        points={points}
      />
      {scores.map((s, i) => (
        <g key={i}>
          <circle cx={PAD + i * xStep} cy={yScale(s)} r="5" fill="#6366f1" />
          <text
            x={PAD + i * xStep}
            y={yScale(s) - 10}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill="#6366f1"
          >
            {s}%
          </text>
          <text x={PAD + i * xStep} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {new Date(attempts[i].createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </text>
        </g>
      ))}
    </svg>
  );
}

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

  // Filter state
  const [examTypeFilter, setExamTypeFilter] = useState<'mock' | 'practice' | 'topic' | 'custom'>(
    'mock',
  );
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty>('Easy');

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
  }>({ selectedTopic: null, difficulty: 'Mixed', numQuestions: 20, duration: 30, passingScore: 70 });
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
    5, 60,
  );
  const sessionDurationInput = useClampedInput(
    sessionConfig.duration,
    (v) => setSessionConfig((prev) => ({ ...prev, duration: v })),
    5, 120,
  );
  const sessionPassingScoreInput = useClampedInput(
    sessionConfig.passingScore,
    (v) => setSessionConfig((prev) => ({ ...prev, passingScore: v })),
    70, 100,
  );
  const topicNumQuestionsInput = useClampedInput(
    topicFlowConfig.numQuestions,
    (v) => setTopicFlowConfig((prev) => ({ ...prev, numQuestions: v })),
    5, 60,
  );
  const topicDurationInput = useClampedInput(
    topicFlowConfig.duration,
    (v) => setTopicFlowConfig((prev) => ({ ...prev, duration: v })),
    5, 120,
  );
  const customNumQuestionsInput = useClampedInput(
    customConfig.numQuestions,
    (v) => setCustomConfig((prev) => ({ ...prev, numQuestions: v })),
    5, 60,
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

  const _stats = {
    totalAttempts: history.length,
    averageScore:
      history.length > 0
        ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / history.length)
        : 0,
    passedExams: history.filter((h) => h.score >= h.passingScore).length,
    bestScore: history.length > 0 ? Math.max(...history.map((h) => h.score)) : 0,
  };

  // Filter sessions to only those explicitly linked to the selected cert
  const certExamIds = new Set(certExams.map((e) => e.id));
  const certId = selectedCertForExams?.id;

  // Helper function to determine exam type from session data
  const getExamType = (session: any): 'mock' | 'practice' | 'topic' | 'custom' => {
    if (session.isCustomQuiz === 1) return 'custom';
    if (session.isTopicQuiz === 1 || (session.topicId && session.isPracticeMode === 1)) return 'topic';
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
    ? history.filter(
        (h: any) =>
          (h.resolvedCertId && h.resolvedCertId === certId) ||
          (h.certificationId && h.certificationId === certId) ||
          (h.examConfigurationId && certExamIds.has(h.examConfigurationId)),
      )
    : [];

  // Apply filters
  const certHistoryDisplay = certHistoryBase.filter((h: any) => {
    const examType = getExamType(h);
    const difficulty = getDifficulty(h);

    console.warn('Session:', h.sessionName);
    console.warn('  - difficulty field from API:', h.difficulty);
    console.warn('  - getDifficulty result:', difficulty);
    console.warn('  - isPracticeMode:', h.isPracticeMode);
    console.warn('  - getExamType result:', examType);
    console.warn('  - Filters: examType=' + examTypeFilter + ', difficulty=' + difficultyFilter);
    console.warn('  - Matches exam type?', examType === examTypeFilter);
    console.warn('  - Matches difficulty?', difficulty === difficultyFilter);

    if (examType !== examTypeFilter) return false;
    if (difficulty !== difficultyFilter) return false;
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

  const filteredCerts = certs
    .filter((c) => {
      if (showFavoritesOnly && !favorites.has(c.id)) return false;
      const q = certSearch.toLowerCase();
      return (
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.vendor ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  const paginatedCerts = paginate(filteredCerts as any[], certPage, certPageSize);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        <p className="text-slate-400 font-bold animate-pulse">Loading your dashboard...</p>
      </div>
    );
  }

  const vendorBadgeClass = (vendor: string) =>
    vendor === 'Amazon'
      ? 'bg-orange-100 text-orange-700'
      : vendor === 'Google'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-sky-100 text-sky-700';

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
        /* -- Landing: certifications grid only -- */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" /> Available Certifications
              </h3>
              <button
                onClick={() => {
                  setShowFavoritesOnly(!showFavoritesOnly);
                  setCertPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  showFavoritesOnly
                    ? 'bg-rose-100 text-rose-600 border border-rose-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 border border-transparent'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-rose-500' : ''}`} />
                Favorites {favorites.size > 0 && `(${favorites.size})`}
              </button>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={certSearch}
                onChange={(e) => {
                  setCertSearch(e.target.value);
                  setCertPage(1);
                }}
                placeholder="Search certifications..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-900"
              />
            </div>
          </div>
          {filteredCerts.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
              <BrainCircuit className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="font-bold text-slate-900">
                {certSearch
                  ? 'No certifications match your search.'
                  : showFavoritesOnly
                    ? 'No favorites yet.'
                    : 'No certifications available yet.'}
              </p>
              <p className="text-sm text-slate-500">
                {certSearch
                  ? 'Try a different search term.'
                  : showFavoritesOnly
                    ? 'Click the heart icon on any certification to add it to your favorites.'
                    : 'Check back later or ask an admin to add some!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {paginatedCerts.map((cert, i) => (
                <motion.button
                  key={cert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCertClick(cert)}
                  className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 text-left transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-100 transition-colors" />
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      {cert.iconUrl ? (
                        <img
                          src={cert.iconUrl}
                          alt={`${cert.vendor} logo`}
                          className="w-10 h-10 object-contain rounded-lg"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${vendorBadgeClass(cert.vendor)}`}
                        >
                          {cert.vendor}
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    {cert.iconUrl && (
                      <div
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${vendorBadgeClass(cert.vendor)}`}
                      >
                        {cert.vendor}
                      </div>
                    )}
                    <h4 className="text-lg font-bold text-slate-900 line-clamp-2 h-14">
                      {cert.title}
                    </h4>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {cert.description ||
                        'Master this certification with our curated question bank.'}
                    </p>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                        <span>View Exams</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      <button
                        onClick={(e) => toggleFavorite(cert.id, e)}
                        className={`p-1.5 rounded-full transition-all ${
                          favorites.has(cert.id)
                            ? 'text-rose-500 bg-rose-50'
                            : 'text-slate-300 hover:text-rose-400 hover:bg-rose-50'
                        }`}
                        title={
                          favorites.has(cert.id) ? 'Remove from favorites' : 'Add to favorites'
                        }
                      >
                        <Heart
                          className={`w-5 h-5 ${favorites.has(cert.id) ? 'fill-rose-500' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
          {filteredCerts.length > certPageSize && (
            <Pagination
              page={certPage}
              pageSize={certPageSize}
              total={filteredCerts.length}
              onPageChange={setCertPage}
              onPageSizeChange={(s) => {
                setCertPageSize(s);
                setCertPage(1);
              }}
            />
          )}
        </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Attempts',
                value: certStats.totalAttempts,
                icon: Clock,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
              {
                label: 'Avg Score',
                value: `${certStats.averageScore}%`,
                icon: Target,
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
              },
              {
                label: 'Passed',
                value: certStats.passedExams,
                icon: Award,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Best Score',
                value: `${Number(certStats.bestScore).toFixed(2)}%`,
                icon: Trophy,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2"
              >
                <div
                  className={`${stat.bg} ${stat.color} w-8 h-8 rounded-lg flex items-center justify-center`}
                >
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <p className="text-xl font-black text-slate-900">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

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
                onClick={() => { setShowTopicFlow(true); setShowCustomFlow(false); }}
                className="p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-xl transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Layers className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm group-hover:text-amber-700">Topic-wise Practice</p>
                </div>
                <p className="text-xs text-slate-500">Practice questions from a specific topic</p>
              </button>
              {/* Custom Quiz */}
              {onStartCustomQuiz && (
                <button
                  onClick={() => { setShowCustomFlow(true); setShowTopicFlow(false); }}
                  className="p-4 bg-violet-50 hover:bg-violet-100 border border-violet-200 hover:border-violet-300 rounded-xl transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Shuffle className="w-4 h-4 text-violet-600" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm group-hover:text-violet-700">Custom Quiz</p>
                  </div>
                  <p className="text-xs text-slate-500">Build your own quiz with custom difficulty and count</p>
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
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Topic</p>
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
                              onClick={() => setTopicFlowConfig((prev) => ({ ...prev, selectedTopic: topic }))}
                              className="flex items-center justify-between p-3 bg-white border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors text-left"
                            >
                              <span className="font-bold text-slate-800 text-sm">{topic.title}</span>
                              <span className="text-xs font-bold text-amber-600">Configure &#x2192;</span>
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
                          onClick={() => setTopicFlowConfig((prev) => ({ ...prev, selectedTopic: null }))}
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
                              onClick={() => setTopicFlowConfig((prev) => ({ ...prev, difficulty: d }))}
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
                            Questions <span className="normal-case font-normal text-slate-400">(5-60)</span>
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
                            Duration (min) <span className="normal-case font-normal text-slate-400">(5-120)</span>
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
                            await onStartTopicQuiz(selectedCertForExams, topicFlowConfig.selectedTopic, {
                              difficulty: topicFlowConfig.difficulty,
                              numQuestions: topicFlowConfig.numQuestions,
                              duration: topicFlowConfig.duration,
                              passingScore: topicFlowConfig.passingScore,
                            });
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
                      onClick={() => { setShowCustomFlow(false); setCustomError(null); }}
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
                      Number of Questions <span className="normal-case font-normal text-slate-400">(5-60)</span>
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
                        await onStartCustomQuiz(selectedCertForExams, customConfig.difficulty, customConfig.numQuestions);
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
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> My Exam History
            </h3>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {certHistoryDisplay.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Exam Name
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Difficulty
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Questions
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Correct
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Wrong
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(() => {
                        const displayed = certHistoryDisplay.slice(0, 8);
                        const counters: Record<string, number> = {};
                        const allReversed = [...certHistoryDisplay].reverse();
                        const iterMap = new Map<string, number>();
                        allReversed.forEach((a: any) => {
                          const name = a.sessionName ?? a.examName ?? 'Exam Attempt';
                          counters[name] = (counters[name] || 0) + 1;
                          iterMap.set(a.id, counters[name]);
                        });
                        return displayed.map((attempt: any, i: number) => {
                          const baseName = attempt.sessionName ?? attempt.examName ?? 'Exam Attempt';
                          const iter = iterMap.get(attempt.id) ?? 1;
                          const totalForName = counters[baseName] ?? 1;
                          const displayName = totalForName > 1 ? `${baseName} #${iter}` : baseName;
                          const difficulty = getDifficulty(attempt);

                          const difficultyColors = {
                            Easy: 'bg-emerald-100 text-emerald-700',
                            Medium: 'bg-amber-100 text-amber-700',
                            Hard: 'bg-rose-100 text-rose-700',
                            Mixed: 'bg-indigo-100 text-indigo-700',
                          };

                          return (
                            <motion.tr
                              key={attempt.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => onViewAttempt(attempt)}
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                            >
                              <td className="px-6 py-4">
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                                    {displayName}
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                                    <Clock className="w-3 h-3" />
                                    {new Date(attempt.createdAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${difficultyColors[difficulty]}`}
                                >
                                  {difficulty}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-sm font-bold text-slate-700">
                                  {attempt.totalQuestions ?? '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-sm font-bold text-emerald-600">
                                  {attempt.correctAnswers ?? '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-sm font-bold text-rose-500">
                                  {attempt.incorrectAnswers ?? '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-lg font-black text-indigo-600">
                                  {Math.round(attempt.score || 0)}%
                                </span>
                              </td>
                            </motion.tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center space-y-3">
                  <Trophy className="w-8 h-8 text-slate-200 mx-auto" />
                  <p className="font-bold text-slate-900 text-sm">No attempts yet</p>
                  <p className="text-xs text-slate-400">Your practice history will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Session Configuration Modal */}
      <AnimatePresence>
        {examToStart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-4"
            >
              {/* Header */}
              <div className="bg-indigo-600 p-6 text-white rounded-t-3xl">
                <h3 className="text-xl font-black">{examToStart.name}</h3>
                <p className="text-indigo-200 text-sm mt-1">
                  Configure your session before starting
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* Test Type -- Mock and Practice only */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Test Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'mock', label: 'Mock Test', sub: 'Timed' },
                        { value: 'practice', label: 'Practice Test', sub: 'Untimed' },
                      ] as { value: TestType; label: string; sub: string }[]
                    ).map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setSessionConfig({
                            ...sessionConfig,
                            testType: t.value,
                          });
                          setSessionError(null);
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          sessionConfig.testType === t.value
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <p
                          className={`font-bold text-sm ${
                            sessionConfig.testType === t.value ? 'text-indigo-700' : 'text-slate-700'
                          }`}
                        >
                          {t.label}
                        </p>
                        <p className="text-xs text-slate-400">{t.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Filter -- hidden for difficulty_balanced strategy */}
                {examToStart.questionSelectionStrategy === 'difficulty_balanced' ? (
                  <div className="space-y-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">
                          Difficulty Balanced Strategy
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          This exam automatically distributes questions proportionally across
                          Easy, Medium, and Hard levels. No difficulty filter is needed.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Difficulty Filter (Optional)
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(['Easy', 'Medium', 'Hard', 'Mixed'] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSessionConfig({ ...sessionConfig, difficulty: d })}
                          className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                            sessionConfig.difficulty === d
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 px-1">
                      Leave as "Mixed" to include all difficulty levels
                    </p>
                  </div>
                )}

                {/* Number of Questions */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Number of Questions{' '}
                    <span className="normal-case font-normal text-slate-400">(5-60)</span>
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    {...sessionNumQuestionsInput.inputProps}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-slate-900 font-bold"
                  />
                </div>

                {/* Duration -- hidden for practice/untimed */}
                {sessionConfig.testType !== 'practice' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Session Duration (minutes){' '}
                      <span className="normal-case font-normal text-slate-400">(5-120)</span>
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      {...sessionDurationInput.inputProps}
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-slate-900 font-bold"
                    />
                  </div>
                )}

                {/* Passing Score */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Passing Score (%){' '}
                    <span className="normal-case font-normal text-slate-400">(70-100)</span>
                  </label>
                  <input
                    type="number"
                    min={70}
                    max={100}
                    {...sessionPassingScoreInput.inputProps}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-slate-900 font-bold"
                  />
                </div>

                {/* Error message */}
                {sessionError && (
                  <p className="text-sm font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {sessionError}
                  </p>
                )}

                {/* Cancel + Start Session buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => {
                      setExamToStart(null);
                      setSessionError(null);
                      setSelectedTopicForConfig(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={sessionStarting}
                    onClick={async () => {
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
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-60"
                  >
                    {sessionStarting ? 'Starting...' : 'Start Session'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
