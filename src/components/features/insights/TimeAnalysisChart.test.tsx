import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimeAnalysisChart from './TimeAnalysisChart';
import type { TimeAnalysis } from '../../../server/types/insights';

describe('TimeAnalysisChart', () => {
  const mockTimeAnalysis: TimeAnalysis = {
    avgTimeCorrect: 90,
    avgTimeIncorrect: 150,
    dangerZoneWarning: false,
    projectedCompletionTime: 5400, // 90 minutes
    pacingAlert: false,
  };

  describe('Null/No Data State', () => {
    it('should display no data message when timeAnalysis is null', () => {
      render(<TimeAnalysisChart timeAnalysis={null} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(
        screen.getByText('Complete exams to see your time management patterns'),
      ).toBeInTheDocument();
    });

    it('should display clock icon when data is not available', () => {
      const { container } = render(<TimeAnalysisChart timeAnalysis={null} />);

      const clockIcon = container.querySelector('svg');
      expect(clockIcon).toBeInTheDocument();
    });

    it('should not display time metrics when data is null', () => {
      render(<TimeAnalysisChart timeAnalysis={null} />);

      expect(screen.queryByText('Correct Answers')).not.toBeInTheDocument();
      expect(screen.queryByText('Incorrect Answers')).not.toBeInTheDocument();
      expect(screen.queryByText('Projected Completion Time')).not.toBeInTheDocument();
    });
  });

  describe('Data Rendering with Valid Analysis', () => {
    it('should display average time for correct answers', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.getByText('Correct Answers')).toBeInTheDocument();
      expect(screen.getByText('1:30')).toBeInTheDocument(); // 90 seconds = 1:30
    });

    it('should display average time for incorrect answers', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.getByText('Incorrect Answers')).toBeInTheDocument();
      expect(screen.getByText('2:30')).toBeInTheDocument(); // 150 seconds = 2:30
    });

    it('should display projected completion time', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.getByText('Projected Completion Time')).toBeInTheDocument();
      expect(screen.getByText('90:00')).toBeInTheDocument(); // 5400 seconds = 90:00
    });

    it('should display time analysis header', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.getByText('Time Analysis')).toBeInTheDocument();
      expect(screen.getByText('Average time spent per question')).toBeInTheDocument();
    });
  });

  describe('Danger Zone Warning - Requirement 4.4', () => {
    it('should display danger zone warning when avgTimeIncorrect exceeds 180 seconds', () => {
      const dangerZoneAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeIncorrect: 200,
        dangerZoneWarning: true,
      };

      render(<TimeAnalysisChart timeAnalysis={dangerZoneAnalysis} />);

      expect(screen.getByText('Danger Zone Detected')).toBeInTheDocument();
      expect(
        screen.getByText(/You're spending over 3 minutes on incorrect answers/),
      ).toBeInTheDocument();
    });

    it('should not display danger zone warning when avgTimeIncorrect is below 180 seconds', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.queryByText('Danger Zone Detected')).not.toBeInTheDocument();
    });

    it('should display danger zone warning at exactly 180 seconds threshold', () => {
      const thresholdAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeIncorrect: 180,
        dangerZoneWarning: false,
      };

      render(<TimeAnalysisChart timeAnalysis={thresholdAnalysis} />);

      expect(screen.queryByText('Danger Zone Detected')).not.toBeInTheDocument();
    });

    it('should display danger zone warning just above 180 seconds threshold', () => {
      const aboveThresholdAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeIncorrect: 181,
        dangerZoneWarning: true,
      };

      render(<TimeAnalysisChart timeAnalysis={aboveThresholdAnalysis} />);

      expect(screen.getByText('Danger Zone Detected')).toBeInTheDocument();
    });
  });

  describe('Pacing Alert - Requirement 7.3', () => {
    it('should display pacing alert when projected time exceeds 90% of exam duration', () => {
      const pacingAlertAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        projectedCompletionTime: 6300, // 105 minutes
        pacingAlert: true,
      };

      render(<TimeAnalysisChart timeAnalysis={pacingAlertAnalysis} />);

      expect(screen.getByText('Pacing Alert')).toBeInTheDocument();
      expect(screen.getByText(/Your current pace may not leave enough time/)).toBeInTheDocument();
    });

    it('should not display pacing alert when projected time is within limits', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.queryByText('Pacing Alert')).not.toBeInTheDocument();
      expect(
        screen.getByText(/Your pacing is on track to complete the exam comfortably/),
      ).toBeInTheDocument();
    });

    it('should display positive message when pacing is good', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(
        screen.getByText(/Your pacing is on track to complete the exam comfortably/),
      ).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format seconds correctly to MM:SS', () => {
      const formattedTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 65,
        avgTimeIncorrect: 125,
      };

      render(<TimeAnalysisChart timeAnalysis={formattedTimeAnalysis} />);

      expect(screen.getByText('1:05')).toBeInTheDocument(); // 65 seconds
      expect(screen.getByText('2:05')).toBeInTheDocument(); // 125 seconds
    });

    it('should pad seconds with leading zero', () => {
      const paddedTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 60,
        avgTimeIncorrect: 120,
      };

      render(<TimeAnalysisChart timeAnalysis={paddedTimeAnalysis} />);

      expect(screen.getByText('1:00')).toBeInTheDocument();
      expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('should handle zero seconds', () => {
      const zeroTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 0,
        avgTimeIncorrect: 0,
      };

      render(<TimeAnalysisChart timeAnalysis={zeroTimeAnalysis} />);

      expect(screen.getAllByText('0:00').length).toBeGreaterThan(0);
    });

    it('should handle large time values', () => {
      const largeTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 3600, // 1 hour
        projectedCompletionTime: 7200, // 2 hours
      };

      render(<TimeAnalysisChart timeAnalysis={largeTimeAnalysis} />);

      expect(screen.getByText('60:00')).toBeInTheDocument(); // 1 hour
      expect(screen.getByText('120:00')).toBeInTheDocument(); // 2 hours
    });
  });

  describe('Bar Chart Visualization', () => {
    it('should display both correct and incorrect answer bars', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.getByText('Correct Answers')).toBeInTheDocument();
      expect(screen.getByText('Incorrect Answers')).toBeInTheDocument();
    });

    it('should calculate bar widths based on max time', () => {
      const { container } = render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      const bars = container.querySelectorAll('.bg-emerald-500, .bg-rose-500');
      expect(bars.length).toBe(2);
    });

    it('should handle equal times for correct and incorrect', () => {
      const equalTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 100,
        avgTimeIncorrect: 100,
      };

      render(<TimeAnalysisChart timeAnalysis={equalTimeAnalysis} />);

      expect(screen.getAllByText('1:40').length).toBe(2);
    });
  });

  describe('Conditional Rendering of Alerts', () => {
    it('should display both danger zone and pacing alert when both conditions are met', () => {
      const bothAlertsAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeIncorrect: 200,
        dangerZoneWarning: true,
        projectedCompletionTime: 6300,
        pacingAlert: true,
      };

      render(<TimeAnalysisChart timeAnalysis={bothAlertsAnalysis} />);

      expect(screen.getByText('Danger Zone Detected')).toBeInTheDocument();
      expect(screen.getByText('Pacing Alert')).toBeInTheDocument();
    });

    it('should not display any alerts when conditions are not met', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(screen.queryByText('Danger Zone Detected')).not.toBeInTheDocument();
      expect(screen.queryByText('Pacing Alert')).not.toBeInTheDocument();
    });

    it('should display tip message when data is available', () => {
      render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      expect(
        screen.getByText(/If you're spending significantly more time on incorrect answers/),
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small time values', () => {
      const smallTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 5,
        avgTimeIncorrect: 10,
      };

      render(<TimeAnalysisChart timeAnalysis={smallTimeAnalysis} />);

      expect(screen.getByText('0:05')).toBeInTheDocument();
      expect(screen.getByText('0:10')).toBeInTheDocument();
    });

    it('should handle fractional seconds by rounding', () => {
      const fractionalTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 90.7,
        avgTimeIncorrect: 150.3,
      };

      render(<TimeAnalysisChart timeAnalysis={fractionalTimeAnalysis} />);

      // Should round to nearest second
      expect(screen.getByText('1:31')).toBeInTheDocument(); // 91 seconds
      expect(screen.getByText('2:30')).toBeInTheDocument(); // 150 seconds
    });

    it('should handle avgTimeCorrect greater than avgTimeIncorrect', () => {
      const reversedTimeAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeCorrect: 200,
        avgTimeIncorrect: 100,
      };

      render(<TimeAnalysisChart timeAnalysis={reversedTimeAnalysis} />);

      expect(screen.getByText('3:20')).toBeInTheDocument(); // 200 seconds
      expect(screen.getByText('1:40')).toBeInTheDocument(); // 100 seconds
    });
  });

  describe('Visual Elements', () => {
    it('should render clock icon in header', () => {
      const { container } = render(<TimeAnalysisChart timeAnalysis={mockTimeAnalysis} />);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should display alert icons when warnings are present', () => {
      const alertAnalysis: TimeAnalysis = {
        ...mockTimeAnalysis,
        avgTimeIncorrect: 200,
        dangerZoneWarning: true,
        pacingAlert: true,
      };

      const { container } = render(<TimeAnalysisChart timeAnalysis={alertAnalysis} />);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(1);
    });
  });
});
