import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../api/client';
import { ArrowLeft, TrendingUp, AlertCircle } from 'lucide-react';
import ReadinessScoreCard from './insights/ReadinessScoreCard';
import DoubleDownMetricCard from './insights/DoubleDownMetricCard';
import KnowledgeGapHeatmap from './insights/KnowledgeGapHeatmap';
import TopicBreakdownView from './insights/TopicBreakdownView';
import SubtopicBreakdownView from './insights/SubtopicBreakdownView';
import UnitBreakdownView from './insights/UnitBreakdownView';
import ConsistencyTrendChart from './insights/ConsistencyTrendChart';
import CommunityBenchmarkComparison from './insights/CommunityBenchmarkComparison';
import StudyListView from './insights/StudyListView';
import RealExamResultForm from './insights/RealExamResultForm';
import ROIStudyRecommendations from './insights/ROIStudyRecommendations';
import TimeAnalysisChart from './insights/TimeAnalysisChart';
import HesitationAnalysisCard from './insights/HesitationAnalysisCard';
import FatigueFactorChart from './insights/FatigueFactorChart';
import CertaintyAccuracyMatrix from './insights/CertaintyAccuracyMatrix';
import type {
  ReadinessScore,
  DoubleDownMetric,
  TimeAnalysis,
  HesitationAnalysis,
  CertaintyMatrix,
  ConsistencyMetric,
  CommunityBenchmark,
  ROIScore,
  FatigueAnalysis,
  DomainProficiency,
  TopicProficiency,
  SubtopicProficiency,
  UnitProficiency,
} from '../../server/types/insights';

interface DashboardData {
  readinessScore: ReadinessScore | null;
  domainProficiency: DomainProficiency[];
  doubleDownMetric: DoubleDownMetric | null;
  timeAnalysis: TimeAnalysis;
  hesitationAnalysis: HesitationAnalysis;
  certaintyMatrix: CertaintyMatrix;
  consistencyMetric: ConsistencyMetric;
  communityBenchmarks: CommunityBenchmark[];
  roiRecommendations: ROIScore[];
  fatigueAnalysis?: FatigueAnalysis | null;
  userPercentile?: number;
  lastUpdated: string;
}

interface InsightDashboardProps {
  certificationId: string;
  certificationTitle: string;
  sessionId?: string; // Optional session ID for study list access
  initialDomainId?: string;
  initialTopicId?: string;
  onBack: () => void;
  onNavigateToTopics?: (domainId: string, domainName: string) => void;
  onNavigateToSubtopics?: (domainId: string, topicId: string, topicName: string) => void;
  onNavigateToDashboard?: () => void;
  onStartTopicQuiz?: (topicId: string, topicName: string) => void;
  onStartSubtopicQuiz?: (topicId: string, topicName: string, subtopicIds: string[]) => void;
}

type DrillDownView =
  | { type: 'dashboard' }
  | { type: 'topics'; domainId: string; domainName: string }
  | { type: 'subtopics'; topicId: string; topicName: string }
  | { type: 'unit-drilldown'; subtopicId: string; subtopicName: string };

export default function InsightDashboard({
  certificationId,
  certificationTitle,
  sessionId,
  initialDomainId,
  initialTopicId,
  onBack,
  onNavigateToTopics,
  onNavigateToSubtopics,
  onNavigateToDashboard,
  onStartTopicQuiz,
  onStartSubtopicQuiz,
}: InsightDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<DrillDownView>({ type: 'dashboard' });
  const [topicData, setTopicData] = useState<TopicProficiency[] | null>(null);
  const [subtopicData, setSubtopicData] = useState<SubtopicProficiency[] | null>(null);
  const [unitData, setUnitData] = useState<UnitProficiency[] | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [showRealExamForm, setShowRealExamForm] = useState(false);

  // Filter state
  const [examTypeFilter, setExamTypeFilter] = useState<'mock' | 'practice'>('mock');
  const [difficultyFilter, setDifficultyFilter] = useState<'Easy' | 'Medium' | 'Hard' | 'Mixed'>(
    'Easy',
  );

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Build query params for filters
        const params = new URLSearchParams();
        params.append('examType', examTypeFilter);
        params.append('difficulty', difficultyFilter);

        const queryString = params.toString();
        const url = `/insights/dashboard/${certificationId}${queryString ? `?${queryString}` : ''}`;

        const response = await fetchApi(url);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [certificationId, examTypeFilter, difficultyFilter]);

  // Initialize view from URL params
  useEffect(() => {
    const initializeView = async () => {
      if (initialTopicId && initialDomainId && data) {
        // Load subtopic view
        setDrillDownLoading(true);
        try {
          const topics = await fetchApi(
            `/insights/domain/${initialDomainId}/topics?certificationId=${certificationId}&examType=${examTypeFilter}&difficulty=${difficultyFilter}`,
          );
          setTopicData(topics.topics);

          const subtopics = await fetchApi(
            `/insights/topic/${initialTopicId}/subtopics?certificationId=${certificationId}&examType=${examTypeFilter}&difficulty=${difficultyFilter}`,
          );
          setSubtopicData(subtopics.subtopics);

          const searchParams = new URLSearchParams(window.location.search);
          const topicName = searchParams.get('topicName') || '';
          setCurrentView({ type: 'subtopics', topicId: initialTopicId, topicName });
        } catch (err) {
          console.error('Failed to initialize subtopic view:', err);
        } finally {
          setDrillDownLoading(false);
        }
      } else if (initialDomainId && data) {
        // Load topic view
        setDrillDownLoading(true);
        try {
          const topics = await fetchApi(
            `/insights/domain/${initialDomainId}/topics?certificationId=${certificationId}&examType=${examTypeFilter}&difficulty=${difficultyFilter}`,
          );
          setTopicData(topics.topics);

          const searchParams = new URLSearchParams(window.location.search);
          const domainName = searchParams.get('domainName') || '';
          setCurrentView({ type: 'topics', domainId: initialDomainId, domainName });
        } catch (err) {
          console.error('Failed to initialize topic view:', err);
        } finally {
          setDrillDownLoading(false);
        }
      }
    };

    initializeView();
  }, [initialDomainId, initialTopicId, data, certificationId, examTypeFilter, difficultyFilter]);

  const handleDomainClick = async (domainId: string) => {
    const domain = data?.domainProficiency.find((d) => d.domainId === domainId);
    if (!domain) return;

    setDrillDownLoading(true);
    try {
      const topics = await fetchApi(
        `/insights/domain/${domainId}/topics?certificationId=${certificationId}&examType=${examTypeFilter}&difficulty=${difficultyFilter}`,
      );
      setTopicData(topics.topics);
      setCurrentView({ type: 'topics', domainId, domainName: domain.domainName });

      // Navigate to URL if handler provided
      if (onNavigateToTopics) {
        onNavigateToTopics(domainId, domain.domainName);
      }
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleTopicClick = async (topicId: string) => {
    const topic = topicData?.find((t) => t.topicId === topicId);
    if (!topic) return;

    setDrillDownLoading(true);
    try {
      const subtopics = await fetchApi(
        `/insights/topic/${topicId}/subtopics?certificationId=${certificationId}&examType=${examTypeFilter}&difficulty=${difficultyFilter}`,
      );
      setSubtopicData(subtopics.subtopics);
      setCurrentView({ type: 'subtopics', topicId, topicName: topic.topicName });

      // Navigate to URL if handler provided
      if (onNavigateToSubtopics && currentView.type === 'topics') {
        onNavigateToSubtopics(currentView.domainId, topicId, topic.topicName);
      }
    } catch (err) {
      console.error('Failed to load subtopics:', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleSubtopicClick = async (subtopicId: string) => {
    const subtopic = subtopicData?.find((s) => s.subtopicId === subtopicId);
    if (!subtopic) return;

    setDrillDownLoading(true);
    try {
      const response = await fetchApi(
        `/api/insights/subtopic/${subtopicId}/units?certificationId=${certificationId}`,
      );
      setUnitData(response.units);
      setCurrentView({
        type: 'unit-drilldown',
        subtopicId,
        subtopicName: subtopic.subtopicName,
      });
    } catch (err) {
      console.error('Failed to load units:', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleBackToSubtopics = () => {
    if (currentView.type === 'unit-drilldown') {
      // Find the topicId from the subtopic data
      const subtopic = subtopicData?.find((s) => s.subtopicId === currentView.subtopicId);
      const topicId = subtopic?.topicId || (topicData?.[0]?.topicId ?? '');
      const topic = topicData?.find((t) => t.topicId === topicId);
      setCurrentView({
        type: 'subtopics',
        topicId,
        topicName: topic?.topicName || '',
      });
      setUnitData(null);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView({ type: 'dashboard' });
    setTopicData(null);
    setSubtopicData(null);
    setUnitData(null);

    // Navigate to URL if handler provided
    if (onNavigateToDashboard) {
      onNavigateToDashboard();
    }
  };

  const handleBackToTopics = () => {
    if (currentView.type === 'subtopics') {
      const topic = topicData?.find((t) => t.topicId === currentView.topicId);
      const domainId = topic?.domainId || '';
      const domainName =
        data?.domainProficiency.find((d) => d.domainId === domainId)?.domainName || '';

      setCurrentView({
        type: 'topics',
        domainId,
        domainName,
      });
      setSubtopicData(null);
      setUnitData(null);

      // Navigate to URL if handler provided
      if (onNavigateToTopics) {
        onNavigateToTopics(domainId, domainName);
      }
    }
  };

  const handleRealExamFormSuccess = () => {
    setShowRealExamForm(false);
    // Optionally refresh dashboard data
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        <p className="text-slate-400 font-bold animate-pulse">Loading your insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Insight Dashboard</h3>
            <p className="text-sm text-slate-500">{certificationTitle}</p>
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="font-bold text-red-900">Failed to load dashboard</p>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Show drill-down loading state
  if (drillDownLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={
              currentView.type === 'subtopics'
                ? handleBackToTopics
                : currentView.type === 'unit-drilldown'
                  ? handleBackToSubtopics
                  : handleBackToDashboard
            }
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Insight Dashboard</h3>
            <p className="text-sm text-slate-500">{certificationTitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          <p className="text-slate-400 font-bold animate-pulse">Loading details...</p>
        </div>
      </div>
    );
  }

  // Render drill-down views
  if (currentView.type === 'topics' && topicData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="Back to Certification Home"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Insight Dashboard
            </h3>
            <p className="text-sm text-slate-500">{certificationTitle}</p>
          </div>
        </div>
        <TopicBreakdownView
          domainName={currentView.domainName}
          topics={topicData}
          onTopicClick={handleTopicClick}
          onBack={handleBackToDashboard}
        />
      </div>
    );
  }

  if (currentView.type === 'subtopics' && subtopicData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="Back to Certification Home"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Insight Dashboard
            </h3>
            <p className="text-sm text-slate-500">{certificationTitle}</p>
          </div>
        </div>
        <SubtopicBreakdownView
          topicName={currentView.topicName}
          subtopics={subtopicData}
          onBack={handleBackToTopics}
          onSubtopicClick={handleSubtopicClick}
        />
      </div>
    );
  }

  if (currentView.type === 'unit-drilldown' && unitData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="Back to Certification Home"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Insight Dashboard
            </h3>
            <p className="text-sm text-slate-500">{certificationTitle}</p>
          </div>
        </div>
        <UnitBreakdownView
          subtopicName={currentView.subtopicName}
          units={unitData}
          onBack={handleBackToSubtopics}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          title="Back to Certification Home"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Insight Dashboard
          </h3>
          <p className="text-sm text-slate-500">{certificationTitle}</p>
        </div>
        <button
          onClick={() => setShowRealExamForm(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
        >
          Report Real Exam Result
        </button>
        <div className="text-right">
          <p className="text-xs text-slate-400">Last updated</p>
          <p className="text-xs font-bold text-slate-600">
            {new Date(data.lastUpdated).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-8">
          {/* Difficulty Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Difficulty
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setDifficultyFilter('Easy')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  difficultyFilter === 'Easy'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Easy
              </button>
              <button
                onClick={() => setDifficultyFilter('Medium')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  difficultyFilter === 'Medium'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => setDifficultyFilter('Hard')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  difficultyFilter === 'Hard'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hard
              </button>
              <button
                onClick={() => setDifficultyFilter('Mixed')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  difficultyFilter === 'Mixed'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Mixed
              </button>
            </div>
          </div>

          {/* Exam Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Exam Type
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setExamTypeFilter('mock')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  examTypeFilter === 'mock'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Mock Test
              </button>
              <button
                onClick={() => setExamTypeFilter('practice')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  examTypeFilter === 'practice'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Practice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Components */}
      <div className="space-y-6">
        {/* Readiness Score Card */}
        <ReadinessScoreCard readinessScore={data.readinessScore} />

        {/* Double Down Metric Card */}
        <DoubleDownMetricCard doubleDownMetric={data.doubleDownMetric} />

        {/* Knowledge Gap Heatmap */}
        <KnowledgeGapHeatmap
          domainProficiency={data.domainProficiency}
          onDomainClick={handleDomainClick}
        />

        {/* Consistency Trend Chart */}
        <ConsistencyTrendChart consistencyMetric={data.consistencyMetric} />

        {/* Community Benchmark Comparison */}
        <CommunityBenchmarkComparison
          communityBenchmarks={data.communityBenchmarks}
          userPercentile={data.userPercentile}
        />

        {/* Time Analysis Chart */}
        <TimeAnalysisChart timeAnalysis={data.timeAnalysis} />

        {/* Hesitation Analysis Card */}
        <HesitationAnalysisCard hesitationAnalysis={data.hesitationAnalysis} />

        {/* Certainty Accuracy Matrix */}
        <CertaintyAccuracyMatrix certaintyMatrix={data.certaintyMatrix} />

        {/* Fatigue Factor Chart */}
        {data.fatigueAnalysis && <FatigueFactorChart fatigueAnalysis={data.fatigueAnalysis} />}

        {/* ROI Study Recommendations */}
        <ROIStudyRecommendations
          roiRecommendations={data.roiRecommendations}
          certificationId={certificationId}
          onStartTopicQuiz={onStartTopicQuiz}
          onStartSubtopicQuiz={onStartSubtopicQuiz}
        />

        {/* Study List View - only show if sessionId is provided */}
        {sessionId && (
          <StudyListView
            sessionId={sessionId}
            certificationId={certificationId}
            onRetryMissed={(_retrySessionId) => {
              // Navigate to the retry session - handled by the parent component
            }}
          />
        )}
      </div>

      {/* Real Exam Result Form Modal */}
      {showRealExamForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-indigo-600 p-6 text-white rounded-t-3xl">
              <h3 className="text-xl font-black">Report Real Exam Result</h3>
              <p className="text-indigo-200 text-sm mt-1">Help us improve community benchmarks</p>
            </div>

            {/* Form Content */}
            <div className="p-6">
              <RealExamResultForm
                certificationId={certificationId}
                certificationTitle={certificationTitle}
                onSuccess={handleRealExamFormSuccess}
                onCancel={() => setShowRealExamForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
