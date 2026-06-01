import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HesitationAnalysisCard from './HesitationAnalysisCard';
import type { HesitationAnalysis } from '../../../server/types/insights';

describe('HesitationAnalysisCard', () => {
  const mockHesitationAnalysis: HesitationAnalysis = {
    totalChanges: 15,
    correctToIncorrectPct: 10,
    incorrectToCorrectPct: 30,
    confidenceWarning: false,
  };

  describe('Null/No Data State', () => {
    it('should display no data message when hesitationAnalysis is null', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={null} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(
        screen.getByText('Answer changes will be tracked as you take exams'),
      ).toBeInTheDocument();
    });

    it('should display git branch icon when data is not available', () => {
      const { container } = render(<HesitationAnalysisCard hesitationAnalysis={null} />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should not display metrics when data is null', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={null} />);

      expect(screen.queryByText('Total Answer Changes')).not.toBeInTheDocument();
      expect(screen.queryByText('Correct → Incorrect')).not.toBeInTheDocument();
      expect(screen.queryByText('Incorrect → Correct')).not.toBeInTheDocument();
    });
  });

  describe('Data Rendering with Valid Analysis', () => {
    it('should display total answer changes', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Total Answer Changes')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should display correct to incorrect percentage', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Correct → Incorrect')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should display incorrect to correct percentage', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Incorrect → Correct')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('should display hesitation analysis header', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Hesitation Analysis')).toBeInTheDocument();
      expect(screen.getByText('Impact of changing your answers')).toBeInTheDocument();
    });
  });

  describe('Confidence Warning - Requirement 5.5', () => {
    it('should display confidence warning when correctToIncorrect exceeds 20%', () => {
      const warningAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 25,
        confidenceWarning: true,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={warningAnalysis} />);

      expect(screen.getByText('Confidence Warning')).toBeInTheDocument();
      expect(
        screen.getByText(/You're changing from correct to incorrect answers more than 20%/),
      ).toBeInTheDocument();
    });

    it('should not display confidence warning when correctToIncorrect is below 20%', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.queryByText('Confidence Warning')).not.toBeInTheDocument();
    });

    it('should not display confidence warning at exactly 20% threshold', () => {
      const thresholdAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 20,
        confidenceWarning: false,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={thresholdAnalysis} />);

      expect(screen.queryByText('Confidence Warning')).not.toBeInTheDocument();
    });

    it('should display confidence warning just above 20% threshold', () => {
      const aboveThresholdAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 21,
        confidenceWarning: true,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={aboveThresholdAnalysis} />);

      expect(screen.getByText('Confidence Warning')).toBeInTheDocument();
    });

    it('should display high rate message in correct to incorrect box when warning is active', () => {
      const warningAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 25,
        confidenceWarning: true,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={warningAnalysis} />);

      expect(screen.getByText('High rate - trust your first instinct')).toBeInTheDocument();
    });
  });

  describe('Percentage Rounding', () => {
    it('should round percentages to nearest integer', () => {
      const fractionalAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 15.7,
        incorrectToCorrectPct: 28.3,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={fractionalAnalysis} />);

      expect(screen.getByText('16%')).toBeInTheDocument();
      expect(screen.getByText('28%')).toBeInTheDocument();
    });

    it('should handle zero percentages', () => {
      const zeroAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 0,
        incorrectToCorrectPct: 0,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={zeroAnalysis} />);

      expect(screen.getAllByText('0%').length).toBe(2);
    });

    it('should handle 100% values', () => {
      const maxAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 100,
        incorrectToCorrectPct: 100,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={maxAnalysis} />);

      expect(screen.getAllByText('100%').length).toBe(2);
    });
  });

  describe('Conditional Rendering of Messages', () => {
    it('should display good news message when no warning and changes exist', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Good news:')).toBeInTheDocument();
      expect(
        screen.getByText(/Your answer changes are helping more than hurting/),
      ).toBeInTheDocument();
    });

    it('should not display good news message when confidence warning is active', () => {
      const warningAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 25,
        confidenceWarning: true,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={warningAnalysis} />);

      expect(screen.queryByText('Good news:')).not.toBeInTheDocument();
    });

    it('should display no changes message when totalChanges is zero', () => {
      const noChangesAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        totalChanges: 0,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={noChangesAnalysis} />);

      expect(screen.getByText(/You haven't changed any answers yet/)).toBeInTheDocument();
    });

    it('should not display good news message when totalChanges is zero', () => {
      const noChangesAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        totalChanges: 0,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={noChangesAnalysis} />);

      expect(screen.queryByText('Good news:')).not.toBeInTheDocument();
    });

    it('should not display no changes message when totalChanges is greater than zero', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.queryByText(/You haven't changed any answers yet/)).not.toBeInTheDocument();
    });
  });

  describe('Change Breakdown Display', () => {
    it('should display both change direction boxes', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Correct → Incorrect')).toBeInTheDocument();
      expect(screen.getByText('Incorrect → Correct')).toBeInTheDocument();
    });

    it('should display good catch rate message for incorrect to correct', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Good catch rate')).toBeInTheDocument();
    });

    it('should use different styling for correct to incorrect when warning is active', () => {
      const warningAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 25,
        confidenceWarning: true,
      };

      const { container } = render(<HesitationAnalysisCard hesitationAnalysis={warningAnalysis} />);

      const warningBox = container.querySelector('.bg-rose-50');
      expect(warningBox).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high total changes', () => {
      const highChangesAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        totalChanges: 999,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={highChangesAnalysis} />);

      expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('should handle single answer change', () => {
      const singleChangeAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        totalChanges: 1,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={singleChangeAnalysis} />);

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle all changes being correct to incorrect', () => {
      const allBadAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 100,
        incorrectToCorrectPct: 0,
        confidenceWarning: true,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={allBadAnalysis} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Confidence Warning')).toBeInTheDocument();
    });

    it('should handle all changes being incorrect to correct', () => {
      const allGoodAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 0,
        incorrectToCorrectPct: 100,
        confidenceWarning: false,
      };

      render(<HesitationAnalysisCard hesitationAnalysis={allGoodAnalysis} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.queryByText('Confidence Warning')).not.toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('should render git branch icon in header', () => {
      const { container } = render(
        <HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />,
      );

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should display trending icons for change directions', () => {
      const { container } = render(
        <HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />,
      );

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(2); // Header icon + 2 trend icons
    });

    it('should display alert icon when confidence warning is present', () => {
      const warningAnalysis: HesitationAnalysis = {
        ...mockHesitationAnalysis,
        correctToIncorrectPct: 25,
        confidenceWarning: true,
      };

      const { container } = render(<HesitationAnalysisCard hesitationAnalysis={warningAnalysis} />);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(3); // Additional alert icon
    });
  });

  describe('Accessibility and Layout', () => {
    it('should display metrics in a grid layout', () => {
      const { container } = render(
        <HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />,
      );

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<HesitationAnalysisCard hesitationAnalysis={mockHesitationAnalysis} />);

      expect(screen.getByText('Hesitation Analysis')).toBeInTheDocument();
    });
  });
});
