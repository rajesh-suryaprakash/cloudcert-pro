import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ROIStudyRecommendations from './ROIStudyRecommendations';
import type { ROIScore } from '../../../server/types/insights';

describe('ROIStudyRecommendations', () => {
  describe('ROI Ranking Logic', () => {
    it('should display top 5 recommendations when more than 5 are provided', () => {
      const recommendations: ROIScore[] = Array.from({ length: 8 }, (_, i) => ({
        topicId: `topic-${i}`,
        topicName: `Topic ${i + 1}`,
        domainId: `domain-${i}`,
        currentProficiency: 50 - i * 5,
        domainWeight: 20,
        availableQuestions: 30,
        roiScore: 0.8 - i * 0.1,
        estimatedScoreIncrease: 12 - i,
      }));

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      // Should only show first 5
      expect(screen.getByText('Topic 1')).toBeInTheDocument();
      expect(screen.getByText('Topic 5')).toBeInTheDocument();
      expect(screen.queryByText('Topic 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Topic 8')).not.toBeInTheDocument();
    });

    it('should mark the first recommendation as top priority', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'High Priority Topic',
          domainId: 'domain-1',
          currentProficiency: 45,
          domainWeight: 25,
          availableQuestions: 40,
          roiScore: 0.95,
          estimatedScoreIncrease: 15,
        },
        {
          topicId: 'topic-2',
          topicName: 'Lower Priority Topic',
          domainId: 'domain-2',
          currentProficiency: 60,
          domainWeight: 15,
          availableQuestions: 25,
          roiScore: 0.65,
          estimatedScoreIncrease: 10,
        },
      ];

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      // First item should have "Top Pick" badge
      expect(screen.getByText('Top Pick')).toBeInTheDocument();

      // Should have rank badges
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });

    it('should display recommendations in the order provided', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-a',
          topicName: 'First Topic',
          domainId: 'domain-1',
          currentProficiency: 30,
          domainWeight: 30,
          availableQuestions: 50,
          roiScore: 1.2,
          estimatedScoreIncrease: 18,
        },
        {
          topicId: 'topic-b',
          topicName: 'Second Topic',
          domainId: 'domain-2',
          currentProficiency: 50,
          domainWeight: 20,
          availableQuestions: 35,
          roiScore: 0.8,
          estimatedScoreIncrease: 12,
        },
        {
          topicId: 'topic-c',
          topicName: 'Third Topic',
          domainId: 'domain-3',
          currentProficiency: 65,
          domainWeight: 15,
          availableQuestions: 20,
          roiScore: 0.5,
          estimatedScoreIncrease: 8,
        },
      ];

      const { container } = render(
        <ROIStudyRecommendations roiRecommendations={recommendations} />,
      );

      const topicElements = container.querySelectorAll('h5');
      expect(topicElements[0]).toHaveTextContent('First Topic');
      expect(topicElements[1]).toHaveTextContent('Second Topic');
      expect(topicElements[2]).toHaveTextContent('Third Topic');
    });
  });

  describe('Metric Display', () => {
    it('should display current proficiency, target proficiency, and estimated gain', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          domainId: 'domain-1',
          currentProficiency: 55,
          domainWeight: 20,
          availableQuestions: 30,
          roiScore: 0.75,
          estimatedScoreIncrease: 12,
        },
      ];

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      // Current proficiency (rounded)
      expect(screen.getByText('55%')).toBeInTheDocument();

      // Target proficiency (always 85%)
      expect(screen.getByText('85%')).toBeInTheDocument();

      // Estimated gain
      expect(screen.getByText('+12')).toBeInTheDocument();
    });

    it('should display domain weight percentage', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          domainId: 'domain-1',
          currentProficiency: 60,
          domainWeight: 22.5,
          availableQuestions: 30,
          roiScore: 0.7,
          estimatedScoreIncrease: 10,
        },
      ];

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      // Domain weight should be rounded
      expect(screen.getByText(/23%/)).toBeInTheDocument();
    });

    it('should display ROI score and available questions', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          domainId: 'domain-1',
          currentProficiency: 50,
          domainWeight: 25,
          availableQuestions: 42,
          roiScore: 0.8567,
          estimatedScoreIncrease: 13,
        },
      ];

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      // ROI score with 2 decimal places
      expect(screen.getByText('0.86')).toBeInTheDocument();

      // Available questions
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should calculate and display progress to target correctly', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          domainId: 'domain-1',
          currentProficiency: 68, // 68/85 = 80%
          domainWeight: 20,
          availableQuestions: 30,
          roiScore: 0.6,
          estimatedScoreIncrease: 9,
        },
      ];

      const { container } = render(
        <ROIStudyRecommendations roiRecommendations={recommendations} />,
      );

      // Progress percentage: (68/85) * 100 = 80%
      expect(screen.getByText('80%')).toBeInTheDocument();

      // Progress bar should have correct width
      const progressBar = container.querySelector('.bg-gradient-to-r');
      expect(progressBar).toHaveStyle({ width: '80%' });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no recommendations provided', () => {
      render(<ROIStudyRecommendations roiRecommendations={[]} />);

      expect(screen.getByText('No Recommendations Available')).toBeInTheDocument();
      expect(screen.getByText(/Complete more exams/)).toBeInTheDocument();
    });

    it('should display empty state when recommendations is undefined', () => {
      render(<ROIStudyRecommendations roiRecommendations={undefined as unknown as []} />);

      expect(screen.getByText('No Recommendations Available')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render Start Studying button for each recommendation', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Topic 1',
          domainId: 'domain-1',
          currentProficiency: 50,
          domainWeight: 20,
          availableQuestions: 30,
          roiScore: 0.8,
          estimatedScoreIncrease: 12,
        },
        {
          topicId: 'topic-2',
          topicName: 'Topic 2',
          domainId: 'domain-2',
          currentProficiency: 60,
          domainWeight: 15,
          availableQuestions: 25,
          roiScore: 0.6,
          estimatedScoreIncrease: 9,
        },
      ];

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      const buttons = screen.getAllByRole('button', { name: /Start Studying/i });
      expect(buttons).toHaveLength(2);
    });
  });

  describe('Visual Styling', () => {
    it('should apply special styling to top priority recommendation', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Top Priority',
          domainId: 'domain-1',
          currentProficiency: 40,
          domainWeight: 30,
          availableQuestions: 50,
          roiScore: 1.0,
          estimatedScoreIncrease: 15,
        },
        {
          topicId: 'topic-2',
          topicName: 'Lower Priority',
          domainId: 'domain-2',
          currentProficiency: 70,
          domainWeight: 10,
          availableQuestions: 20,
          roiScore: 0.4,
          estimatedScoreIncrease: 6,
        },
      ];

      const { container } = render(
        <ROIStudyRecommendations roiRecommendations={recommendations} />,
      );

      const cards = container.querySelectorAll('.rounded-xl.p-5');

      // First card should have gradient background
      expect(cards[0]).toHaveClass('bg-gradient-to-br', 'from-indigo-50', 'to-purple-50');

      // Second card should have slate background
      expect(cards[1]).toHaveClass('bg-slate-50');
    });
  });

  describe('Rounding Behavior', () => {
    it('should round proficiency scores correctly', () => {
      const recommendations: ROIScore[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          domainId: 'domain-1',
          currentProficiency: 67.8,
          domainWeight: 22.3,
          availableQuestions: 30,
          roiScore: 0.7,
          estimatedScoreIncrease: 10.7,
        },
      ];

      render(<ROIStudyRecommendations roiRecommendations={recommendations} />);

      // Current proficiency should round to 68
      expect(screen.getByText('68%')).toBeInTheDocument();

      // Domain weight should round to 22
      expect(screen.getByText(/22%/)).toBeInTheDocument();

      // Estimated increase should round to 11
      expect(screen.getByText('+11')).toBeInTheDocument();
    });
  });
});
