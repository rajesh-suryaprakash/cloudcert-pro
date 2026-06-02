import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InsightDashboard from './InsightDashboard';
import * as client from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock('./insights/ReadinessScoreCard', () => ({
  default: ({ readinessScore }: { readinessScore: { overallScore: number } | null }) => (
    <div data-testid="readiness-score-card">
      {readinessScore ? `Score: ${readinessScore.overallScore}` : 'No data'}
    </div>
  ),
}));

vi.mock('./insights/DoubleDownMetricCard', () => ({
  default: ({ doubleDownMetric }: { doubleDownMetric: { domainName: string } | null }) => (
    <div data-testid="double-down-metric-card">
      {doubleDownMetric ? `Domain: ${doubleDownMetric.domainName}` : 'No data'}
    </div>
  ),
}));

vi.mock('./insights/KnowledgeGapHeatmap', () => ({
  default: ({ domainProficiency }: { domainProficiency: unknown[] }) => (
    <div data-testid="knowledge-gap-heatmap">Domains: {domainProficiency.length}</div>
  ),
}));

vi.mock('./insights/ConsistencyTrendChart', () => ({
  default: () => <div data-testid="consistency-trend-chart">Consistency Chart</div>,
}));

vi.mock('./insights/CommunityBenchmarkComparison', () => ({
  default: () => <div data-testid="community-benchmark">Benchmark</div>,
}));

vi.mock('./insights/TimeAnalysisChart', () => ({
  default: () => <div data-testid="time-analysis-chart">Time Analysis</div>,
}));

vi.mock('./insights/HesitationAnalysisCard', () => ({
  default: () => <div data-testid="hesitation-analysis-card">Hesitation</div>,
}));

vi.mock('./insights/CertaintyAccuracyMatrix', () => ({
  default: () => <div data-testid="certainty-accuracy-matrix">Certainty Matrix</div>,
}));

vi.mock('./insights/FatigueFactorChart', () => ({
  default: () => <div data-testid="fatigue-factor-chart">Fatigue Chart</div>,
}));

vi.mock('./insights/ROIStudyRecommendations', () => ({
  default: () => <div data-testid="roi-study-recommendations">ROI Recommendations</div>,
}));

vi.mock('./insights/StudyListView', () => ({
  default: () => <div data-testid="study-list-view">Study List</div>,
}));

vi.mock('./insights/RealExamResultForm', () => ({
  default: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="real-exam-result-form">
      <button onClick={onSuccess}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('./insights/TopicBreakdownView', () => ({
  default: () => <div data-testid="topic-breakdown-view">Topic Breakdown</div>,
}));

vi.mock('./insights/SubtopicBreakdownView', () => ({
  default: () => <div data-testid="subtopic-breakdown-view">Subtopic Breakdown</div>,
}));

describe('InsightDashboard', () => {
  const mockOnBack = vi.fn();
  const mockDashboardData = {
    readinessScore: {
      overallScore: 85,
      domainScores: [],
      consistencyScore: 80,
      pacingScore: 90,
      recentTrend: 'improving' as const,
      greenLightStatus: 'yellow' as const,
      criteriaForGreen: ['Score 90% on 3 consecutive sessions'],
    },
    domainProficiency: [
      {
        domainId: 'domain1',
        domainName: 'Security',
        proficiencyScore: 75,
        domainWeight: 30,
        questionsAttempted: 20,
        questionsCorrect: 15,
      },
    ],
    doubleDownMetric: {
      domainId: 'domain1',
      domainName: 'Security',
      proficiencyScore: 75,
      domainWeight: 30,
      priorityScore: 7.5,
    },
    timeAnalysis: {
      avgTimeCorrect: 120,
      avgTimeIncorrect: 180,
      dangerZoneWarning: false,
      projectedCompletionTime: 7200,
      pacingAlert: false,
    },
    hesitationAnalysis: {
      totalChanges: 10,
      correctToIncorrectPct: 15,
      incorrectToCorrectPct: 25,
      confidenceWarning: false,
    },
    certaintyMatrix: {
      highConfidenceCorrect: { count: 50, percentage: 50 },
      highConfidenceIncorrect: { count: 10, percentage: 10 },
      lowConfidenceCorrect: { count: 20, percentage: 20 },
      lowConfidenceIncorrect: { count: 20, percentage: 20 },
    },
    consistencyMetric: {
      recentSessions: [],
      standardDeviation: 5,
      hasHighVariance: false,
      insufficientData: false,
    },
    communityBenchmarks: [],
    roiRecommendations: [],
    lastUpdated: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner while fetching data', () => {
      vi.mocked(client.fetchApi).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      expect(screen.getByText('Loading your insights...')).toBeInTheDocument();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display loading animation with correct classes', () => {
      vi.mocked(client.fetchApi).mockImplementation(() => new Promise(() => {}));

      const { container } = render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('rounded-full', 'border-b-2', 'border-indigo-600');
    });
  });

  describe('Error State', () => {
    it('should display error message when API call fails', async () => {
      vi.mocked(client.fetchApi).mockRejectedValue(new Error('Network error'));

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should display retry button in error state', async () => {
      vi.mocked(client.fetchApi).mockRejectedValue(new Error('Network error'));

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should show back button in error state', async () => {
      vi.mocked(client.fetchApi).mockRejectedValue(new Error('Network error'));

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
      });

      const backButtons = screen.getAllByRole('button');
      const backButton = backButtons.find((btn) => btn.querySelector('svg'));
      expect(backButton).toBeInTheDocument();
    });

    it('should call onBack when back button clicked in error state', async () => {
      vi.mocked(client.fetchApi).mockRejectedValue(new Error('Network error'));

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
      });

      const backButtons = screen.getAllByRole('button');
      const backButton = backButtons.find((btn) => btn.querySelector('svg'));

      if (backButton) {
        await userEvent.click(backButton);
        expect(mockOnBack).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Data Rendering', () => {
    it('should render all dashboard components with data', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('readiness-score-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('double-down-metric-card')).toBeInTheDocument();
      expect(screen.getByTestId('knowledge-gap-heatmap')).toBeInTheDocument();
      expect(screen.getByTestId('consistency-trend-chart')).toBeInTheDocument();
      expect(screen.getByTestId('community-benchmark')).toBeInTheDocument();
      expect(screen.getByTestId('time-analysis-chart')).toBeInTheDocument();
      expect(screen.getByTestId('hesitation-analysis-card')).toBeInTheDocument();
      expect(screen.getByTestId('certainty-accuracy-matrix')).toBeInTheDocument();
      expect(screen.getByTestId('roi-study-recommendations')).toBeInTheDocument();
    });

    it('should pass correct data to ReadinessScoreCard', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Score: 85')).toBeInTheDocument();
      });
    });

    it('should pass correct data to DoubleDownMetricCard', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Domain: Security')).toBeInTheDocument();
      });
    });

    it('should display certification title', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('AWS Solutions Architect')).toBeInTheDocument();
      });
    });

    it('should display last updated timestamp', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Last updated')).toBeInTheDocument();
      });
    });
  });

  describe('Conditional Rendering', () => {
    it('should render FatigueFactorChart when fatigueAnalysis is provided', async () => {
      const dataWithFatigue = {
        ...mockDashboardData,
        fatigueAnalysis: {
          quartiles: [],
          fatigueDetected: true,
          recommendation: 'Take breaks',
        },
      };

      vi.mocked(client.fetchApi).mockResolvedValue(dataWithFatigue);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('fatigue-factor-chart')).toBeInTheDocument();
      });
    });

    it('should not render FatigueFactorChart when fatigueAnalysis is null', async () => {
      const dataWithoutFatigue = {
        ...mockDashboardData,
        fatigueAnalysis: null,
      };

      vi.mocked(client.fetchApi).mockResolvedValue(dataWithoutFatigue);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('readiness-score-card')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('fatigue-factor-chart')).not.toBeInTheDocument();
    });

    it('should render StudyListView when sessionId is provided', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          sessionId="session123"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('study-list-view')).toBeInTheDocument();
      });
    });

    it('should not render StudyListView when sessionId is not provided', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('readiness-score-card')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('study-list-view')).not.toBeInTheDocument();
    });

    it('should handle null readinessScore gracefully', async () => {
      const dataWithNullReadiness = {
        ...mockDashboardData,
        readinessScore: null,
      };

      vi.mocked(client.fetchApi).mockResolvedValue(dataWithNullReadiness);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('No data')).toBeInTheDocument();
      });
    });

    it('should handle null doubleDownMetric gracefully', async () => {
      const dataWithNullDoubleDown = {
        ...mockDashboardData,
        doubleDownMetric: null,
      };

      vi.mocked(client.fetchApi).mockResolvedValue(dataWithNullDoubleDown);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('double-down-metric-card')).toBeInTheDocument();
      });

      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onBack when back button is clicked', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('readiness-score-card')).toBeInTheDocument();
      });

      const backButtons = screen.getAllByRole('button');
      const backButton = backButtons.find((btn) => btn.querySelector('svg'));

      if (backButton) {
        await userEvent.click(backButton);
        expect(mockOnBack).toHaveBeenCalledTimes(1);
      }
    });

    it('should open real exam result form when button clicked', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Report Real Exam Result')).toBeInTheDocument();
      });

      const reportButton = screen.getByText('Report Real Exam Result');
      await userEvent.click(reportButton);

      expect(screen.getByTestId('real-exam-result-form')).toBeInTheDocument();
    });

    it('should close real exam result form when cancel is clicked', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Report Real Exam Result')).toBeInTheDocument();
      });

      const reportButton = screen.getByText('Report Real Exam Result');
      await userEvent.click(reportButton);

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      expect(screen.queryByTestId('real-exam-result-form')).not.toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should call fetchApi with correct certification ID', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDashboardData);

      render(
        <InsightDashboard
          certificationId="cert123"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(client.fetchApi).toHaveBeenCalledWith(
          '/insights/dashboard/cert123?examType=mock&difficulty=Easy',
        );
      });
    });

    it('should handle empty domain proficiency array', async () => {
      const dataWithEmptyDomains = {
        ...mockDashboardData,
        domainProficiency: [],
      };

      vi.mocked(client.fetchApi).mockResolvedValue(dataWithEmptyDomains);

      render(
        <InsightDashboard
          certificationId="cert1"
          certificationTitle="AWS Solutions Architect"
          onBack={mockOnBack}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Domains: 0')).toBeInTheDocument();
      });
    });
  });
});
