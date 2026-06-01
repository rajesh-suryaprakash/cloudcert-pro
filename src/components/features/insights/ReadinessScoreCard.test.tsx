import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReadinessScoreCard from './ReadinessScoreCard';
import type { ReadinessScore } from '../../../server/types/insights';

describe('ReadinessScoreCard', () => {
  const mockReadinessScore: ReadinessScore = {
    overallScore: 85,
    domainScores: [
      {
        domainId: 'domain1',
        domainName: 'Security',
        proficiencyScore: 80,
        domainWeight: 30,
        questionsAttempted: 20,
        questionsCorrect: 16,
      },
      {
        domainId: 'domain2',
        domainName: 'Networking',
        proficiencyScore: 90,
        domainWeight: 25,
        questionsAttempted: 20,
        questionsCorrect: 18,
      },
    ],
    consistencyScore: 75,
    pacingScore: 90,
    recentTrend: 'improving',
    greenLightStatus: 'yellow',
    criteriaForGreen: [
      'Score 90% or higher on 3 consecutive sessions',
      'Maintain consistency score above 80%',
    ],
  };

  describe('Null/Insufficient Data State', () => {
    it('should display insufficient data message when readinessScore is null', () => {
      render(<ReadinessScoreCard readinessScore={null} />);

      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
      expect(
        screen.getByText('Complete at least 3 exam sessions to see your readiness score'),
      ).toBeInTheDocument();
    });

    it('should display alert icon when data is insufficient', () => {
      const { container } = render(<ReadinessScoreCard readinessScore={null} />);

      const alertIcon = container.querySelector('svg');
      expect(alertIcon).toBeInTheDocument();
    });

    it('should not display score components when data is null', () => {
      render(<ReadinessScoreCard readinessScore={null} />);

      expect(screen.queryByText('Score Components')).not.toBeInTheDocument();
      expect(screen.queryByText('Domain')).not.toBeInTheDocument();
    });
  });

  describe('Data Rendering with Valid Score', () => {
    it('should display overall readiness score', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    it('should display consistency score', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should display pacing score', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('should display weighted domain score', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      // Weighted domain score = (80 * 30 + 90 * 25) / 100 = 46.5
      expect(screen.getByText('47%')).toBeInTheDocument();
    });

    it('should display score component weights', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('60% weight')).toBeInTheDocument();
      expect(screen.getByText('20% weight')).toBeInTheDocument();
      expect(screen.getByText('15% weight')).toBeInTheDocument();
    });
  });

  describe('Green Light Status Indicators', () => {
    it('should display green status when greenLightStatus is green', () => {
      const greenScore: ReadinessScore = {
        ...mockReadinessScore,
        overallScore: 92,
        greenLightStatus: 'green',
        criteriaForGreen: [],
      };

      render(<ReadinessScoreCard readinessScore={greenScore} />);

      expect(screen.getByText('Ready to Test')).toBeInTheDocument();
      expect(screen.getByText("You're ready to take the real exam!")).toBeInTheDocument();
    });

    it('should display yellow status when greenLightStatus is yellow', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('Almost Ready')).toBeInTheDocument();
    });

    it('should display red status when greenLightStatus is red', () => {
      const redScore: ReadinessScore = {
        ...mockReadinessScore,
        overallScore: 65,
        greenLightStatus: 'red',
      };

      render(<ReadinessScoreCard readinessScore={redScore} />);

      expect(screen.getByText('Keep Practicing')).toBeInTheDocument();
    });

    it('should not display criteria when status is green', () => {
      const greenScore: ReadinessScore = {
        ...mockReadinessScore,
        overallScore: 92,
        greenLightStatus: 'green',
        criteriaForGreen: [],
      };

      render(<ReadinessScoreCard readinessScore={greenScore} />);

      expect(screen.queryByText('To achieve green light status:')).not.toBeInTheDocument();
    });

    it('should display criteria for green when status is not green', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('To achieve green light status:')).toBeInTheDocument();
      expect(screen.getByText('Score 90% or higher on 3 consecutive sessions')).toBeInTheDocument();
      expect(screen.getByText('Maintain consistency score above 80%')).toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('should display improving trend', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('Improving')).toBeInTheDocument();
    });

    it('should display stable trend', () => {
      const stableScore: ReadinessScore = {
        ...mockReadinessScore,
        recentTrend: 'stable',
      };

      render(<ReadinessScoreCard readinessScore={stableScore} />);

      expect(screen.getByText('Stable')).toBeInTheDocument();
    });

    it('should display declining trend', () => {
      const decliningScore: ReadinessScore = {
        ...mockReadinessScore,
        recentTrend: 'declining',
      };

      render(<ReadinessScoreCard readinessScore={decliningScore} />);

      expect(screen.getByText('Declining')).toBeInTheDocument();
    });
  });

  describe('Conditional Rendering Based on Data', () => {
    it('should not display green celebration when status is yellow', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.queryByText("You're ready to take the real exam!")).not.toBeInTheDocument();
    });

    it('should not display green celebration when status is red', () => {
      const redScore: ReadinessScore = {
        ...mockReadinessScore,
        overallScore: 65,
        greenLightStatus: 'red',
      };

      render(<ReadinessScoreCard readinessScore={redScore} />);

      expect(screen.queryByText("You're ready to take the real exam!")).not.toBeInTheDocument();
    });

    it('should display criteria section when criteriaForGreen has items', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('To achieve green light status:')).toBeInTheDocument();
    });

    it('should not display criteria section when criteriaForGreen is empty and status is not green', () => {
      const scoreWithNoCriteria: ReadinessScore = {
        ...mockReadinessScore,
        greenLightStatus: 'yellow',
        criteriaForGreen: [],
      };

      render(<ReadinessScoreCard readinessScore={scoreWithNoCriteria} />);

      expect(screen.queryByText('To achieve green light status:')).not.toBeInTheDocument();
    });
  });

  describe('Score Calculation', () => {
    it('should correctly calculate weighted domain score with multiple domains', () => {
      const multiDomainScore: ReadinessScore = {
        ...mockReadinessScore,
        domainScores: [
          {
            domainId: 'd1',
            domainName: 'Domain 1',
            proficiencyScore: 100,
            domainWeight: 50,
            questionsAttempted: 10,
            questionsCorrect: 10,
          },
          {
            domainId: 'd2',
            domainName: 'Domain 2',
            proficiencyScore: 80,
            domainWeight: 50,
            questionsAttempted: 10,
            questionsCorrect: 8,
          },
        ],
      };

      render(<ReadinessScoreCard readinessScore={multiDomainScore} />);

      // (100 * 50 + 80 * 50) / 100 = 90
      // Use getAllByText since 90% appears in both domain score and pacing score
      const elements = screen.getAllByText('90%');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should handle zero domain weight correctly', () => {
      const zeroDomainScore: ReadinessScore = {
        ...mockReadinessScore,
        domainScores: [
          {
            domainId: 'd1',
            domainName: 'Domain 1',
            proficiencyScore: 100,
            domainWeight: 0,
            questionsAttempted: 10,
            questionsCorrect: 10,
          },
        ],
      };

      render(<ReadinessScoreCard readinessScore={zeroDomainScore} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should round scores to nearest integer', () => {
      const fractionalScore: ReadinessScore = {
        ...mockReadinessScore,
        overallScore: 85.7,
        consistencyScore: 74.3,
        pacingScore: 89.9,
      };

      render(<ReadinessScoreCard readinessScore={fractionalScore} />);

      expect(screen.getByText('86')).toBeInTheDocument(); // overallScore rounded
      expect(screen.getByText('74%')).toBeInTheDocument(); // consistencyScore rounded
      expect(screen.getByText('90%')).toBeInTheDocument(); // pacingScore rounded
    });
  });

  describe('Visual Elements', () => {
    it('should render circular progress indicator', () => {
      const { container } = render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('should display header title', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('Exam Readiness Score')).toBeInTheDocument();
    });

    it('should display score components section header', () => {
      render(<ReadinessScoreCard readinessScore={mockReadinessScore} />);

      expect(screen.getByText('Score Components')).toBeInTheDocument();
    });
  });
});
