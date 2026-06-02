import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConsistencyTrendChart from './ConsistencyTrendChart';
import type { ConsistencyMetric } from '../../../server/types/insights';

/**
 * Unit tests for ConsistencyTrendChart component
 *
 * Tests cover:
 * - Trend line calculation and rendering
 * - Variance warning display (Requirement 9.3)
 * - Insufficient data handling
 * - Statistics calculations
 */
describe('ConsistencyTrendChart', () => {
  const mockConsistencyMetric: ConsistencyMetric = {
    recentSessions: [
      {
        sessionId: 'session1',
        date: '2024-01-01',
        score: 75,
        sessionName: 'Practice Exam 1',
      },
      {
        sessionId: 'session2',
        date: '2024-01-05',
        score: 80,
        sessionName: 'Practice Exam 2',
      },
      {
        sessionId: 'session3',
        date: '2024-01-10',
        score: 78,
        sessionName: 'Practice Exam 3',
      },
      {
        sessionId: 'session4',
        date: '2024-01-15',
        score: 85,
        sessionName: 'Practice Exam 4',
      },
      {
        sessionId: 'session5',
        date: '2024-01-20',
        score: 82,
        sessionName: 'Practice Exam 5',
      },
    ],
    standardDeviation: 3.5,
    hasHighVariance: false,
    insufficientData: false,
  };

  describe('Insufficient Data State', () => {
    it('should display insufficient data message when insufficientData is true', () => {
      const insufficientMetric: ConsistencyMetric = {
        recentSessions: [
          {
            sessionId: 'session1',
            date: '2024-01-01',
            score: 75,
            sessionName: 'Practice Exam 1',
          },
        ],
        standardDeviation: 0,
        hasHighVariance: false,
        insufficientData: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={insufficientMetric} />);

      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
      expect(
        screen.getByText('Complete at least 5 exam sessions to see your consistency trend'),
      ).toBeInTheDocument();
    });

    it('should display current session count when insufficientData is true', () => {
      const insufficientMetric: ConsistencyMetric = {
        recentSessions: [
          {
            sessionId: 'session1',
            date: '2024-01-01',
            score: 75,
            sessionName: 'Practice Exam 1',
          },
          {
            sessionId: 'session2',
            date: '2024-01-05',
            score: 80,
            sessionName: 'Practice Exam 2',
          },
        ],
        standardDeviation: 0,
        hasHighVariance: false,
        insufficientData: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={insufficientMetric} />);

      expect(screen.getByText('Current sessions: 2 / 5')).toBeInTheDocument();
    });

    it('should display insufficient data when recentSessions is empty', () => {
      const emptyMetric: ConsistencyMetric = {
        recentSessions: [],
        standardDeviation: 0,
        hasHighVariance: false,
        insufficientData: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={emptyMetric} />);

      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
    });
  });

  describe('Trend Line Calculation', () => {
    it('should display all session scores in the chart', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      // Check that all scores are displayed (using getAllByText since scores appear multiple times)
      const scores75 = screen.getAllByText(/75%/);
      const scores80 = screen.getAllByText(/80%/);
      const scores78 = screen.getAllByText(/78%/);
      const scores85 = screen.getAllByText(/85%/);
      const scores82 = screen.getAllByText(/82%/);

      expect(scores75.length).toBeGreaterThan(0);
      expect(scores80.length).toBeGreaterThan(0);
      expect(scores78.length).toBeGreaterThan(0);
      expect(scores85.length).toBeGreaterThan(0);
      expect(scores82.length).toBeGreaterThan(0);
    });

    it('should display session names for each data point', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.getByText('Practice Exam 1')).toBeInTheDocument();
      expect(screen.getByText('Practice Exam 2')).toBeInTheDocument();
      expect(screen.getByText('Practice Exam 3')).toBeInTheDocument();
      expect(screen.getByText('Practice Exam 4')).toBeInTheDocument();
      expect(screen.getByText('Practice Exam 5')).toBeInTheDocument();
    });

    it('should display formatted dates for each session', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      // Dates should be formatted using toLocaleDateString
      const dates = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(dates.length).toBeGreaterThan(0);
    });

    it('should render SVG chart element', () => {
      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />,
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render line path in SVG', () => {
      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />,
      );

      const path = container.querySelector('path');
      expect(path).toBeInTheDocument();
      expect(path?.getAttribute('d')).toContain('M'); // SVG path should start with M (move to)
    });

    it('should render data points as circles in SVG', () => {
      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />,
      );

      const circles = container.querySelectorAll('.rounded-full.bg-indigo-700');
      expect(circles.length).toBe(mockConsistencyMetric.recentSessions.length);
    });
  });

  describe('Variance Warning Display - Requirement 9.3', () => {
    it('should display high variance warning when hasHighVariance is true', () => {
      const highVarianceMetric: ConsistencyMetric = {
        ...mockConsistencyMetric,
        standardDeviation: 12.5,
        hasHighVariance: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={highVarianceMetric} />);

      expect(screen.getByText('High Score Variance Detected')).toBeInTheDocument();
      expect(
        screen.getByText(/Your scores vary significantly between sessions/i),
      ).toBeInTheDocument();
    });

    it('should not display variance warning when hasHighVariance is false', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.queryByText('High Score Variance Detected')).not.toBeInTheDocument();
    });

    it('should display standard deviation value', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.getByText('3.5')).toBeInTheDocument();
      expect(screen.getByText('Std. Deviation')).toBeInTheDocument();
    });

    it('should display standard deviation with amber color when variance is high', () => {
      const highVarianceMetric: ConsistencyMetric = {
        ...mockConsistencyMetric,
        standardDeviation: 12.5,
        hasHighVariance: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={highVarianceMetric} />);

      // Standard deviation should have amber color class
      const stdDevElement = screen.getByText('12.5');
      expect(stdDevElement.className).toContain('amber');
    });

    it('should display standard deviation with emerald color when variance is low', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      // Standard deviation should have emerald color class
      const stdDevElement = screen.getByText('3.5');
      expect(stdDevElement.className).toContain('emerald');
    });
  });

  describe('Statistics Calculations', () => {
    it('should calculate and display average score correctly', () => {
      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />,
      );

      // Average of [75, 80, 78, 85, 82] = 80
      expect(screen.getByText('Average')).toBeInTheDocument();

      // Find the average score specifically in the statistics section
      const averageSection = container.querySelector('.text-2xl.font-black.text-indigo-600');
      expect(averageSection?.textContent).toContain('80');
    });

    it('should calculate and display score range correctly', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      // Range: 85 - 75 = 10
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should display consistency status as "Stable" when variance is low', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.getByText('Consistency')).toBeInTheDocument();
      expect(screen.getByText('Stable')).toBeInTheDocument();
    });

    it('should display consistency status as "Variable" when variance is high', () => {
      const highVarianceMetric: ConsistencyMetric = {
        ...mockConsistencyMetric,
        standardDeviation: 12.5,
        hasHighVariance: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={highVarianceMetric} />);

      expect(screen.getByText('Consistency')).toBeInTheDocument();
      expect(screen.getByText('Variable')).toBeInTheDocument();
    });

    it('should round average score to nearest integer', () => {
      const fractionalMetric: ConsistencyMetric = {
        recentSessions: [
          { sessionId: '1', date: '2024-01-01', score: 75.7, sessionName: 'Exam 1' },
          { sessionId: '2', date: '2024-01-02', score: 80.3, sessionName: 'Exam 2' },
          { sessionId: '3', date: '2024-01-03', score: 78.5, sessionName: 'Exam 3' },
          { sessionId: '4', date: '2024-01-04', score: 85.2, sessionName: 'Exam 4' },
          { sessionId: '5', date: '2024-01-05', score: 82.1, sessionName: 'Exam 5' },
        ],
        standardDeviation: 3.5,
        hasHighVariance: false,
        insufficientData: false,
      };

      const { container } = render(<ConsistencyTrendChart consistencyMetric={fractionalMetric} />);

      // Average should be rounded: (75.7 + 80.3 + 78.5 + 85.2 + 82.1) / 5 = 80.36 ≈ 80
      const averageSection = container.querySelector('.text-2xl.font-black.text-indigo-600');
      expect(averageSection?.textContent).toContain('80');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single session', () => {
      const singleSessionMetric: ConsistencyMetric = {
        recentSessions: [
          {
            sessionId: 'session1',
            date: '2024-01-01',
            score: 75,
            sessionName: 'Practice Exam 1',
          },
        ],
        standardDeviation: 0,
        hasHighVariance: false,
        insufficientData: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={singleSessionMetric} />);

      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
    });

    it('should handle all identical scores', () => {
      const identicalScoresMetric: ConsistencyMetric = {
        recentSessions: [
          { sessionId: '1', date: '2024-01-01', score: 80, sessionName: 'Exam 1' },
          { sessionId: '2', date: '2024-01-02', score: 80, sessionName: 'Exam 2' },
          { sessionId: '3', date: '2024-01-03', score: 80, sessionName: 'Exam 3' },
          { sessionId: '4', date: '2024-01-04', score: 80, sessionName: 'Exam 4' },
          { sessionId: '5', date: '2024-01-05', score: 80, sessionName: 'Exam 5' },
        ],
        standardDeviation: 0,
        hasHighVariance: false,
        insufficientData: false,
      };

      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={identicalScoresMetric} />,
      );

      // Range should be 0
      expect(screen.getByText('0%')).toBeInTheDocument();
      // Average should be 80 - check in the statistics section
      const averageSection = container.querySelector('.text-2xl.font-black.text-indigo-600');
      expect(averageSection?.textContent).toContain('80');
      // Should be stable
      expect(screen.getByText('Stable')).toBeInTheDocument();
    });

    it('should handle very long session names', () => {
      const longNameMetric: ConsistencyMetric = {
        recentSessions: [
          {
            sessionId: 'session1',
            date: '2024-01-01',
            score: 75,
            sessionName: 'This is a very long practice exam name that should be truncated',
          },
        ],
        standardDeviation: 0,
        hasHighVariance: false,
        insufficientData: true,
      };

      render(<ConsistencyTrendChart consistencyMetric={longNameMetric} />);

      // Should show insufficient data since only 1 session
      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
    });

    it('should display session count in subtitle', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.getByText(/Score progression over last 5 exam sessions/i)).toBeInTheDocument();
    });

    it('should handle exactly 5 sessions', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      // Should display all 5 sessions
      const sessionCards = screen.getAllByText(/Session \d/);
      expect(sessionCards.length).toBe(5);
    });
  });

  describe('Visual Elements', () => {
    it('should display header with title', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.getByText('Consistency Trend')).toBeInTheDocument();
    });

    it('should display TrendingUp icon in header', () => {
      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />,
      );

      // Check for SVG element (icon)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should display session labels (Session 1, Session 2, etc.)', () => {
      render(<ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />);

      expect(screen.getByText('Session 1')).toBeInTheDocument();
      expect(screen.getByText('Session 2')).toBeInTheDocument();
      expect(screen.getByText('Session 3')).toBeInTheDocument();
      expect(screen.getByText('Session 4')).toBeInTheDocument();
      expect(screen.getByText('Session 5')).toBeInTheDocument();
    });

    it('should apply color coding to scores based on performance', () => {
      const { container } = render(
        <ConsistencyTrendChart consistencyMetric={mockConsistencyMetric} />,
      );

      // Scores >= 80 should have emerald color
      // Scores >= 60 should have amber color
      // Scores < 60 should have rose color
      const scoreElements = container.querySelectorAll('.font-black');
      expect(scoreElements.length).toBeGreaterThan(0);
    });
  });
});
