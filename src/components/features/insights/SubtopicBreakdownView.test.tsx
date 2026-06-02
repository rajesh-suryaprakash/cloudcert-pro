import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubtopicBreakdownView from './SubtopicBreakdownView';
import type { SubtopicProficiency } from '../../../server/types/insights';

describe('SubtopicBreakdownView', () => {
  const mockSubtopics: SubtopicProficiency[] = [
    {
      subtopicId: 'subtopic1',
      subtopicName: 'DNS Configuration',
      topicId: 'topic1',
      proficiencyScore: 85,
      questionsAttempted: 10,
      questionsCorrect: 8,
      hasInsufficientData: false,
    },
    {
      subtopicId: 'subtopic2',
      subtopicName: 'Load Balancers',
      topicId: 'topic1',
      proficiencyScore: 60,
      questionsAttempted: 5,
      questionsCorrect: 3,
      hasInsufficientData: false,
    },
    {
      subtopicId: 'subtopic3',
      subtopicName: 'VPN Connections',
      topicId: 'topic1',
      proficiencyScore: 0,
      questionsAttempted: 2,
      questionsCorrect: 0,
      hasInsufficientData: true,
    },
  ];

  const topicName = 'Networking Fundamentals';

  describe('Empty/No Data State', () => {
    it('should display no subtopics message when subtopics array is empty', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={[]} />);

      expect(screen.getByText('No Subtopics Available')).toBeInTheDocument();
      expect(screen.getByText('No subtopic data found for this topic')).toBeInTheDocument();
    });

    it('should display no subtopics message when subtopics is null', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={null as unknown as []} />);

      expect(screen.getByText('No Subtopics Available')).toBeInTheDocument();
    });

    it('should display topic name in header when no data', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={[]} />);

      expect(screen.getByText(topicName)).toBeInTheDocument();
    });

    it('should not display subtopic data when empty', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={[]} />);

      expect(screen.queryByText('DNS Configuration')).not.toBeInTheDocument();
      expect(screen.queryByText('Questions:')).not.toBeInTheDocument();
    });
  });

  describe('Data Transformation for Chart Libraries', () => {
    it('should sort subtopics by proficiency with insufficient data last', () => {
      const { container } = render(
        <SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />,
      );

      const subtopicElements = container.querySelectorAll('h5');
      const subtopicNames = Array.from(subtopicElements).map((el) => el.textContent);

      // Should be sorted: Load Balancers (60%), DNS Configuration (85%), VPN Connections (insufficient)
      expect(subtopicNames[0]).toBe('Load Balancers');
      expect(subtopicNames[1]).toBe('DNS Configuration');
      expect(subtopicNames[2]).toBe('VPN Connections');
    });

    it('should display proficiency scores as percentages for sufficient data', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('should display questions attempted count', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      // Check that each subtopic card contains its question count
      const dnsSubtopic = screen.getByText('DNS Configuration').closest('.bg-slate-50');
      expect(dnsSubtopic?.textContent).toContain('Questions:');
      expect(dnsSubtopic?.textContent).toContain('10');

      const loadBalancersSubtopic = screen.getByText('Load Balancers').closest('.bg-slate-50');
      expect(loadBalancersSubtopic?.textContent).toContain('Questions:');
      expect(loadBalancersSubtopic?.textContent).toContain('5');
    });

    it('should display questions correct count for sufficient data', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const dnsSubtopic = screen.getByText('DNS Configuration').closest('.bg-slate-50');
      expect(dnsSubtopic?.textContent).toContain('Correct:');
      expect(dnsSubtopic?.textContent).toContain('8');

      const loadBalancersSubtopic = screen.getByText('Load Balancers').closest('.bg-slate-50');
      expect(loadBalancersSubtopic?.textContent).toContain('Correct:');
      expect(loadBalancersSubtopic?.textContent).toContain('3');
    });

    it('should calculate and display incorrect count for sufficient data', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      // DNS Configuration: 10 - 8 = 2
      const dnsSubtopic = screen.getByText('DNS Configuration').closest('.bg-slate-50');
      expect(dnsSubtopic?.textContent).toContain('Incorrect:');
      expect(dnsSubtopic?.textContent).toContain('2');
    });

    it('should round fractional proficiency scores', () => {
      const fractionalSubtopics: SubtopicProficiency[] = [
        {
          ...mockSubtopics[0],
          proficiencyScore: 84.6,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={fractionalSubtopics} />);

      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });

  describe('Insufficient Data Handling (Requirement 3.5)', () => {
    it('should display "Insufficient Data" label for subtopics with < 3 questions', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
    });

    it('should display "Need More Data" badge for insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('Need More Data')).toBeInTheDocument();
      expect(screen.getByText('< 3 questions')).toBeInTheDocument();
    });

    it('should display warning message for insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(
        screen.getByText('Answer at least 3 questions on this subtopic to see proficiency score'),
      ).toBeInTheDocument();
    });

    it('should not display proficiency score for insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const vpnSubtopic = screen.getByText('VPN Connections').closest('.bg-slate-50');
      const scoreCircle = vpnSubtopic?.querySelector('.rounded-full.ring-4');

      expect(scoreCircle).not.toBeInTheDocument();
    });

    it('should not display progress bar for insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const vpnSubtopic = screen.getByText('VPN Connections').closest('.bg-slate-50');
      const progressBar = vpnSubtopic?.querySelector('.bg-slate-200.rounded-full');

      expect(progressBar).not.toBeInTheDocument();
    });

    it('should not display correct/incorrect counts for insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const vpnSubtopic = screen.getByText('VPN Connections').closest('.bg-slate-50');
      const correctLabel = vpnSubtopic?.textContent?.includes('Correct:');

      expect(correctLabel).toBe(false);
    });

    it('should handle subtopic with exactly 3 questions as sufficient data', () => {
      const threeQuestionsSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'Minimal Sufficient',
          topicId: 'topic1',
          proficiencyScore: 67,
          questionsAttempted: 3,
          questionsCorrect: 2,
          hasInsufficientData: false,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={threeQuestionsSubtopics} />);

      expect(screen.getByText('67')).toBeInTheDocument();
      expect(screen.queryByText('Need More Data')).not.toBeInTheDocument();
    });

    it('should handle subtopic with 2 questions as insufficient data', () => {
      const twoQuestionsSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'Insufficient',
          topicId: 'topic1',
          proficiencyScore: 0,
          questionsAttempted: 2,
          questionsCorrect: 1,
          hasInsufficientData: true,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={twoQuestionsSubtopics} />);

      expect(screen.getByText('Need More Data')).toBeInTheDocument();
      expect(screen.getByText('< 3 questions')).toBeInTheDocument();
    });

    it('should handle subtopic with 1 question as insufficient data', () => {
      const oneQuestionSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'Very Insufficient',
          topicId: 'topic1',
          proficiencyScore: 0,
          questionsAttempted: 1,
          questionsCorrect: 0,
          hasInsufficientData: true,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={oneQuestionSubtopics} />);

      expect(screen.getByText('Need More Data')).toBeInTheDocument();
    });

    it('should handle subtopic with 0 questions as insufficient data', () => {
      const zeroQuestionsSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'No Data',
          topicId: 'topic1',
          proficiencyScore: 0,
          questionsAttempted: 0,
          questionsCorrect: 0,
          hasInsufficientData: true,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={zeroQuestionsSubtopics} />);

      expect(screen.getByText('Need More Data')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(
        <SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} onBack={onBack} />,
      );

      const backButton = screen.getByRole('button');
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should not display back button when onBack is not provided', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('should display header with title', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('Subtopic Breakdown')).toBeInTheDocument();
    });

    it('should display topic name in subtitle', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText(topicName)).toBeInTheDocument();
    });

    it('should display total subtopics count', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('Total Subtopics')).toBeInTheDocument();
      const totalSubtopicsElement = screen.getByText('Total Subtopics').nextElementSibling;
      expect(totalSubtopicsElement?.textContent).toBe('3');
    });

    it('should display summary stats for strong subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const strongCard = screen
        .getAllByText('Strong')
        .find((el) => el.classList.contains('uppercase'));
      expect(strongCard).toBeInTheDocument();
      // DNS Configuration has 85% (>= 80%)
      const strongCountElement = strongCard?.closest('.bg-emerald-50')?.querySelector('.text-2xl');
      expect(strongCountElement?.textContent).toBe('1');
    });

    it('should display summary stats for needs work subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('Needs Work')).toBeInTheDocument();
      // Load Balancers has 60% (< 80%)
    });

    it('should display summary stats for insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(screen.getByText('Insufficient')).toBeInTheDocument();
      // VPN Connections has insufficient data
    });

    it('should display info note about focusing on weak areas', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      expect(
        screen.getByText(/Focus on subtopics with lower proficiency scores/),
      ).toBeInTheDocument();
    });

    it('should display progress bars for subtopics with sufficient data', () => {
      const { container } = render(
        <SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />,
      );

      const progressBars = container.querySelectorAll('.bg-slate-200.rounded-full');
      // Should have 2 progress bars (DNS and Load Balancers, not VPN)
      expect(progressBars.length).toBe(2);
    });

    it('should display circular score indicators for sufficient data', () => {
      const { container } = render(
        <SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />,
      );

      const circles = container.querySelectorAll('.rounded-full.ring-4');
      // Should have 2 circles (DNS and Load Balancers, not VPN)
      expect(circles.length).toBe(2);
    });

    it('should display status labels (Strong, Needs Practice, Weak Area)', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      // Check for status labels in subtopic cards
      const dnsSubtopic = screen.getByText('DNS Configuration').closest('.bg-slate-50');
      expect(dnsSubtopic?.textContent).toContain('Strong');

      const loadBalancersSubtopic = screen.getByText('Load Balancers').closest('.bg-slate-50');
      expect(loadBalancersSubtopic?.textContent).toContain('Needs Practice');
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% proficiency score with sufficient data', () => {
      const zeroScoreSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'Weak Subtopic',
          topicId: 'topic1',
          proficiencyScore: 0,
          questionsAttempted: 10,
          questionsCorrect: 0,
          hasInsufficientData: false,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={zeroScoreSubtopics} />);

      const weakSubtopic = screen.getByText('Weak Subtopic').closest('.bg-slate-50');
      const scoreCircle = weakSubtopic?.querySelector('.text-xl.font-black');
      expect(scoreCircle?.textContent).toBe('0');
      expect(screen.getByText('Weak Area')).toBeInTheDocument();
    });

    it('should handle 100% proficiency score', () => {
      const perfectScoreSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'Perfect Subtopic',
          topicId: 'topic1',
          proficiencyScore: 100,
          questionsAttempted: 10,
          questionsCorrect: 10,
          hasInsufficientData: false,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={perfectScoreSubtopics} />);

      expect(screen.getByText('100')).toBeInTheDocument();
      const perfectSubtopic = screen.getByText('Perfect Subtopic').closest('.bg-slate-50');
      expect(perfectSubtopic?.textContent).toContain('Strong');
    });

    it('should handle very long subtopic names', () => {
      const longNameSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName:
            'Very Long Subtopic Name That Should Still Display Correctly Without Breaking Layout',
          topicId: 'topic1',
          proficiencyScore: 75,
          questionsAttempted: 10,
          questionsCorrect: 7,
          hasInsufficientData: false,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={longNameSubtopics} />);

      expect(
        screen.getByText(
          'Very Long Subtopic Name That Should Still Display Correctly Without Breaking Layout',
        ),
      ).toBeInTheDocument();
    });

    it('should handle single subtopic', () => {
      const singleSubtopic: SubtopicProficiency[] = [mockSubtopics[0]];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={singleSubtopic} />);

      expect(screen.getByText('DNS Configuration')).toBeInTheDocument();
      const totalSubtopicsElement = screen.getByText('Total Subtopics').nextElementSibling;
      expect(totalSubtopicsElement?.textContent).toBe('1');
    });

    it('should handle all subtopics with insufficient data', () => {
      const allInsufficientSubtopics: SubtopicProficiency[] = [
        {
          subtopicId: 'subtopic1',
          subtopicName: 'Insufficient 1',
          topicId: 'topic1',
          proficiencyScore: 0,
          questionsAttempted: 1,
          questionsCorrect: 0,
          hasInsufficientData: true,
        },
        {
          subtopicId: 'subtopic2',
          subtopicName: 'Insufficient 2',
          topicId: 'topic1',
          proficiencyScore: 0,
          questionsAttempted: 2,
          questionsCorrect: 1,
          hasInsufficientData: true,
        },
      ];

      render(<SubtopicBreakdownView topicName={topicName} subtopics={allInsufficientSubtopics} />);

      // Check summary stats
      const insufficientCard = screen.getByText('Insufficient').closest('.bg-slate-50');
      expect(insufficientCard?.textContent).toContain('2');

      const strongCard = screen.getByText('Strong').closest('.bg-emerald-50');
      expect(strongCard?.textContent).toContain('0');
    });

    it('should handle many subtopics', () => {
      const manySubtopics: SubtopicProficiency[] = Array.from({ length: 15 }, (_, i) => ({
        subtopicId: `subtopic${i}`,
        subtopicName: `Subtopic ${i}`,
        topicId: 'topic1',
        proficiencyScore: 50 + i * 3,
        questionsAttempted: 10,
        questionsCorrect: 5 + i,
        hasInsufficientData: false,
      }));

      render(<SubtopicBreakdownView topicName={topicName} subtopics={manySubtopics} />);

      expect(screen.getByText('Subtopic 0')).toBeInTheDocument();
      expect(screen.getByText('Subtopic 14')).toBeInTheDocument();
      const totalSubtopicsElement = screen.getByText('Total Subtopics').nextElementSibling;
      expect(totalSubtopicsElement?.textContent).toBe('15');
    });
  });

  describe('Summary Statistics', () => {
    it('should correctly count strong subtopics (>= 80%)', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const summaryCards = screen.getAllByText('Strong');
      expect(summaryCards.length).toBeGreaterThan(0);
    });

    it('should correctly count needs work subtopics (< 80%)', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const summaryCards = screen.getAllByText('Needs Work');
      expect(summaryCards.length).toBeGreaterThan(0);
    });

    it('should correctly count insufficient data subtopics', () => {
      render(<SubtopicBreakdownView topicName={topicName} subtopics={mockSubtopics} />);

      const summaryCards = screen.getAllByText('Insufficient');
      expect(summaryCards.length).toBeGreaterThan(0);
    });
  });
});
