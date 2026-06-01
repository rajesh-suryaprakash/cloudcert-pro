import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FatigueFactorChart from './FatigueFactorChart';
import type { FatigueAnalysis, QuartileData } from '../../../server/types/insights';

describe('FatigueFactorChart', () => {
  const mockQuartiles: QuartileData[] = [
    { quartile: 1, accuracyPct: 85, questionsAnswered: 10 },
    { quartile: 2, accuracyPct: 82, questionsAnswered: 10 },
    { quartile: 3, accuracyPct: 78, questionsAnswered: 10 },
    { quartile: 4, accuracyPct: 75, questionsAnswered: 10 },
  ];

  const mockFatigueAnalysis: FatigueAnalysis = {
    quartiles: mockQuartiles,
    fatigueDetected: false,
    recommendation: null,
  };

  describe('Null/No Data State', () => {
    it('should display no data message when fatigueAnalysis is null', () => {
      render(<FatigueFactorChart fatigueAnalysis={null} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(
        screen.getByText('Complete exams to see your performance over time'),
      ).toBeInTheDocument();
    });

    it('should display activity icon when data is not available', () => {
      const { container } = render(<FatigueFactorChart fatigueAnalysis={null} />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should not display quartile data when analysis is null', () => {
      render(<FatigueFactorChart fatigueAnalysis={null} />);

      expect(screen.queryByText('Q1')).not.toBeInTheDocument();
      expect(screen.queryByText('Q2')).not.toBeInTheDocument();
      expect(screen.queryByText('Q3')).not.toBeInTheDocument();
      expect(screen.queryByText('Q4')).not.toBeInTheDocument();
    });
  });

  describe('Data Rendering with Valid Analysis', () => {
    it('should display all four quartiles', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getByText('Q2')).toBeInTheDocument();
      expect(screen.getByText('Q3')).toBeInTheDocument();
      expect(screen.getByText('Q4')).toBeInTheDocument();
    });

    it('should display accuracy percentages for each quartile', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('82%')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
      // 75% appears in both y-axis and quartile data
      expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    });

    it('should display questions answered for each quartile', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.getAllByText('10 qs').length).toBe(4);
    });

    it('should display fatigue factor header', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.getByText('Fatigue Factor')).toBeInTheDocument();
      expect(screen.getByText('Accuracy by exam quartile')).toBeInTheDocument();
    });
  });

  describe('Fatigue Detection - Requirement 15.4', () => {
    it('should display fatigue warning when accuracy drops more than 15%', () => {
      const fatigueDetectedAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 90, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 85, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 78, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 70, questionsAnswered: 10 },
        ],
        fatigueDetected: true,
        recommendation: 'Practice full-length timed exams to build endurance',
      };

      render(<FatigueFactorChart fatigueAnalysis={fatigueDetectedAnalysis} />);

      expect(screen.getByText('Fatigue Warning')).toBeInTheDocument();
      expect(screen.getByText(/Your accuracy dropped by more than 15%/)).toBeInTheDocument();
    });

    it('should not display fatigue warning when drop is below 15%', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.queryByText('Fatigue Warning')).not.toBeInTheDocument();
    });

    it('should display fatigue detected badge when fatigue is detected', () => {
      const fatigueDetectedAnalysis: FatigueAnalysis = {
        ...mockFatigueAnalysis,
        fatigueDetected: true,
        recommendation: 'Practice full-length timed exams',
      };

      render(<FatigueFactorChart fatigueAnalysis={fatigueDetectedAnalysis} />);

      expect(screen.getByText('Fatigue Detected')).toBeInTheDocument();
    });

    it('should not display fatigue detected badge when no fatigue', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.queryByText('Fatigue Detected')).not.toBeInTheDocument();
    });

    it('should display recommendation when fatigue is detected', () => {
      const fatigueWithRecommendation: FatigueAnalysis = {
        ...mockFatigueAnalysis,
        fatigueDetected: true,
        recommendation: 'Practice full-length timed exams to build endurance',
      };

      render(<FatigueFactorChart fatigueAnalysis={fatigueWithRecommendation} />);

      expect(
        screen.getByText('Practice full-length timed exams to build endurance'),
      ).toBeInTheDocument();
    });

    it('should not display recommendation when fatigue is not detected', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.queryByText(/Practice full-length timed exams/)).not.toBeInTheDocument();
    });
  });

  describe('Accuracy Drop Calculation', () => {
    it('should calculate and display accuracy drop correctly', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.getByText('Accuracy Drop (Q1 → Q4)')).toBeInTheDocument();
      // 85 - 75 = 10% drop
      expect(screen.getByText('-10%')).toBeInTheDocument();
    });

    it('should display positive change when accuracy improves', () => {
      const improvingAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 70, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 75, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 80, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 85, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={improvingAnalysis} />);

      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('should handle zero accuracy drop', () => {
      const stableAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 80, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 80, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 80, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 80, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={stableAnalysis} />);

      expect(screen.getByText('+0%')).toBeInTheDocument();
    });

    it('should round accuracy drop to nearest integer', () => {
      const fractionalDropAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 85.7, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 82.3, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 78.9, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 75.2, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={fractionalDropAnalysis} />);

      // 85.7 - 75.2 = 10.5, rounded to 11
      expect(screen.getByText('-11%')).toBeInTheDocument();
    });
  });

  describe('Positive Feedback Messages', () => {
    it('should display great endurance message when no fatigue detected', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(screen.getByText('Great endurance!')).toBeInTheDocument();
      expect(
        screen.getByText(/Your accuracy remains consistent throughout the exam/),
      ).toBeInTheDocument();
    });

    it('should not display great endurance message when fatigue is detected', () => {
      const fatigueDetectedAnalysis: FatigueAnalysis = {
        ...mockFatigueAnalysis,
        fatigueDetected: true,
        recommendation: 'Practice more',
      };

      render(<FatigueFactorChart fatigueAnalysis={fatigueDetectedAnalysis} />);

      expect(screen.queryByText('Great endurance!')).not.toBeInTheDocument();
    });

    it('should always display tip message', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      expect(
        screen.getByText(/If you notice fatigue patterns, practice full-length timed exams/),
      ).toBeInTheDocument();
    });
  });

  describe('Quartile Data Formatting', () => {
    it('should round accuracy percentages to nearest integer', () => {
      const fractionalAccuracyAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 85.7, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 82.3, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 78.9, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 75.2, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={fractionalAccuracyAnalysis} />);

      expect(screen.getByText('86%')).toBeInTheDocument();
      expect(screen.getByText('82%')).toBeInTheDocument();
      expect(screen.getByText('79%')).toBeInTheDocument();
      // 75% appears in both y-axis and quartile data, so use getAllByText
      expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    });

    it('should handle varying questions answered per quartile', () => {
      const varyingQuestionsAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 85, questionsAnswered: 8 },
          { quartile: 2, accuracyPct: 82, questionsAnswered: 12 },
          { quartile: 3, accuracyPct: 78, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 75, questionsAnswered: 15 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={varyingQuestionsAnalysis} />);

      expect(screen.getByText('8 qs')).toBeInTheDocument();
      expect(screen.getByText('12 qs')).toBeInTheDocument();
      expect(screen.getByText('10 qs')).toBeInTheDocument();
      expect(screen.getByText('15 qs')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle perfect accuracy across all quartiles', () => {
      const perfectAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 100, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 100, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 100, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 100, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={perfectAnalysis} />);

      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    });

    it('should handle zero accuracy', () => {
      const zeroAccuracyAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 0, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 0, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 0, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 0, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={zeroAccuracyAnalysis} />);

      expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
    });

    it('should handle single quartile data', () => {
      const singleQuartileAnalysis: FatigueAnalysis = {
        quartiles: [{ quartile: 1, accuracyPct: 85, questionsAnswered: 40 }],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={singleQuartileAnalysis} />);

      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should handle two quartiles data', () => {
      const twoQuartilesAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 85, questionsAnswered: 20 },
          { quartile: 2, accuracyPct: 80, questionsAnswered: 20 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={twoQuartilesAnalysis} />);

      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getByText('Q2')).toBeInTheDocument();
      expect(screen.queryByText('Q3')).not.toBeInTheDocument();
      expect(screen.queryByText('Q4')).not.toBeInTheDocument();
    });

    it('should handle extreme accuracy drop', () => {
      const extremeDropAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 100, questionsAnswered: 10 },
          { quartile: 2, accuracyPct: 80, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 50, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 20, questionsAnswered: 10 },
        ],
        fatigueDetected: true,
        recommendation: 'Take breaks during practice exams',
      };

      render(<FatigueFactorChart fatigueAnalysis={extremeDropAnalysis} />);

      expect(screen.getByText('-80%')).toBeInTheDocument();
      expect(screen.getByText('Fatigue Warning')).toBeInTheDocument();
    });

    it('should handle zero questions answered in a quartile', () => {
      const zeroQuestionsAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 85, questionsAnswered: 0 },
          { quartile: 2, accuracyPct: 82, questionsAnswered: 10 },
          { quartile: 3, accuracyPct: 78, questionsAnswered: 10 },
          { quartile: 4, accuracyPct: 75, questionsAnswered: 10 },
        ],
        fatigueDetected: false,
        recommendation: null,
      };

      render(<FatigueFactorChart fatigueAnalysis={zeroQuestionsAnalysis} />);

      expect(screen.getByText('0 qs')).toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('should render activity icon in header', () => {
      const { container } = render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should display chart with bars for each quartile', () => {
      const { container } = render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      const bars = container.querySelectorAll('.bg-slate-100');
      expect(bars.length).toBeGreaterThan(0);
    });

    it('should display grid lines for chart', () => {
      const { container } = render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      const gridLines = container.querySelectorAll('.border-t');
      expect(gridLines.length).toBeGreaterThan(0);
    });

    it('should display y-axis labels', () => {
      render(<FatigueFactorChart fatigueAnalysis={mockFatigueAnalysis} />);

      // Y-axis labels may appear multiple times (in axis and data), so check they exist
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
      expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
      expect(screen.getAllByText('25%').length).toBeGreaterThan(0);
      expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
    });
  });

  describe('Conditional Styling', () => {
    it('should apply different colors based on accuracy levels', () => {
      const mixedAccuracyAnalysis: FatigueAnalysis = {
        quartiles: [
          { quartile: 1, accuracyPct: 90, questionsAnswered: 10 }, // High - emerald
          { quartile: 2, accuracyPct: 70, questionsAnswered: 10 }, // Medium - amber
          { quartile: 3, accuracyPct: 50, questionsAnswered: 10 }, // Low - rose
          { quartile: 4, accuracyPct: 30, questionsAnswered: 10 }, // Low - rose
        ],
        fatigueDetected: true,
        recommendation: 'Build endurance',
      };

      render(<FatigueFactorChart fatigueAnalysis={mixedAccuracyAnalysis} />);

      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
      // 50% appears in both y-axis and quartile data
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });
});
