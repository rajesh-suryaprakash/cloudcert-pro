import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DoubleDownMetricCard from './DoubleDownMetricCard';
import type { DoubleDownMetric } from '../../../server/types/insights';

describe('DoubleDownMetricCard', () => {
  const mockDoubleDownMetric: DoubleDownMetric = {
    domainId: 'domain1',
    domainName: 'Identity & Access Management',
    proficiencyScore: 65,
    domainWeight: 30,
    priorityScore: 10.5,
  };

  describe('Null/No Data State', () => {
    it('should display no data message when doubleDownMetric is null', () => {
      render(<DoubleDownMetricCard doubleDownMetric={null} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(
        screen.getByText('Complete more exams to identify your highest-priority weak area'),
      ).toBeInTheDocument();
    });

    it('should display target icon when data is not available', () => {
      const { container } = render(<DoubleDownMetricCard doubleDownMetric={null} />);

      const targetIcon = container.querySelector('svg');
      expect(targetIcon).toBeInTheDocument();
    });

    it('should not display metrics when data is null', () => {
      render(<DoubleDownMetricCard doubleDownMetric={null} />);

      expect(screen.queryByText('Proficiency')).not.toBeInTheDocument();
      expect(screen.queryByText('Exam Weight')).not.toBeInTheDocument();
      expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    });
  });

  describe('Data Rendering with Valid Metric', () => {
    it('should display domain name', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Identity & Access Management')).toBeInTheDocument();
    });

    it('should display proficiency score', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('should display domain weight', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('should display priority score', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('11')).toBeInTheDocument(); // Rounded from 10.5
    });

    it('should display improvement needed percentage', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      // Gap = 100 - 65 = 35%
      expect(screen.getByText('35%')).toBeInTheDocument();
    });

    it('should display priority focus badge', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Priority Focus')).toBeInTheDocument();
    });

    it('should display weak area indicator', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Weak Area')).toBeInTheDocument();
    });
  });

  describe('Alert and Recommendation Messages', () => {
    it('should display focus message', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Focus your study time here for maximum impact')).toBeInTheDocument();
    });

    it('should display explanation message', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(
        screen.getByText(/This domain has the lowest proficiency and highest exam weight/),
      ).toBeInTheDocument();
    });

    it('should display recommended action', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Recommended Action')).toBeInTheDocument();
      expect(
        screen.getByText(/Dedicate focused study sessions to Identity & Access Management/),
      ).toBeInTheDocument();
    });
  });

  describe('Score Calculations', () => {
    it('should correctly calculate gap for high proficiency', () => {
      const highProficiencyMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        proficiencyScore: 90,
      };

      render(<DoubleDownMetricCard doubleDownMetric={highProficiencyMetric} />);

      // Gap = 100 - 90 = 10%
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should correctly calculate gap for low proficiency', () => {
      const lowProficiencyMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        proficiencyScore: 30,
      };

      render(<DoubleDownMetricCard doubleDownMetric={lowProficiencyMetric} />);

      // Gap = 100 - 30 = 70%
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('should round proficiency score to nearest integer', () => {
      const fractionalMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        proficiencyScore: 65.7,
      };

      render(<DoubleDownMetricCard doubleDownMetric={fractionalMetric} />);

      expect(screen.getByText('66%')).toBeInTheDocument();
    });

    it('should round domain weight to nearest integer', () => {
      const fractionalWeightMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        domainWeight: 29.8,
      };

      render(<DoubleDownMetricCard doubleDownMetric={fractionalWeightMetric} />);

      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('should round priority score to nearest integer', () => {
      const fractionalPriorityMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        priorityScore: 10.4,
      };

      render(<DoubleDownMetricCard doubleDownMetric={fractionalPriorityMetric} />);

      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('should display header with title', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Double-Down Metric')).toBeInTheDocument();
    });

    it('should display metric labels', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Proficiency')).toBeInTheDocument();
      expect(screen.getByText('Exam Weight')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    it('should display improvement needed label', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Improvement Needed')).toBeInTheDocument();
    });

    it('should render target icon', () => {
      const { container } = render(
        <DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />,
      );

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% proficiency score', () => {
      const zeroProficiencyMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        proficiencyScore: 0,
      };

      render(<DoubleDownMetricCard doubleDownMetric={zeroProficiencyMetric} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument(); // Gap should be 100%
    });

    it('should handle 100% proficiency score', () => {
      const perfectProficiencyMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        proficiencyScore: 100,
      };

      render(<DoubleDownMetricCard doubleDownMetric={perfectProficiencyMetric} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument(); // Gap should be 0%
    });

    it('should handle 0% domain weight', () => {
      const zeroWeightMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        domainWeight: 0,
      };

      render(<DoubleDownMetricCard doubleDownMetric={zeroWeightMetric} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle very long domain names', () => {
      const longNameMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        domainName:
          'Very Long Domain Name That Should Still Display Correctly Without Breaking Layout',
      };

      render(<DoubleDownMetricCard doubleDownMetric={longNameMetric} />);

      expect(
        screen.getByText(
          'Very Long Domain Name That Should Still Display Correctly Without Breaking Layout',
        ),
      ).toBeInTheDocument();
    });

    it('should handle zero priority score', () => {
      const zeroPriorityMetric: DoubleDownMetric = {
        ...mockDoubleDownMetric,
        priorityScore: 0,
      };

      render(<DoubleDownMetricCard doubleDownMetric={zeroPriorityMetric} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Conditional Rendering', () => {
    it('should always display alert message when data is available', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Focus your study time here for maximum impact')).toBeInTheDocument();
    });

    it('should always display recommended action when data is available', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Recommended Action')).toBeInTheDocument();
    });

    it('should display all three metric boxes when data is available', () => {
      render(<DoubleDownMetricCard doubleDownMetric={mockDoubleDownMetric} />);

      expect(screen.getByText('Proficiency')).toBeInTheDocument();
      expect(screen.getByText('Exam Weight')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });
  });
});
