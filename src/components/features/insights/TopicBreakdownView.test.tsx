import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicBreakdownView from './TopicBreakdownView';
import type { TopicProficiency } from '../../../server/types/insights';

describe('TopicBreakdownView', () => {
  const mockTopics: TopicProficiency[] = [
    {
      topicId: 'topic1',
      topicName: 'IAM Roles',
      domainId: 'domain1',
      proficiencyScore: 80,
      questionsAttempted: 15,
      questionsCorrect: 12,
    },
    {
      topicId: 'topic2',
      topicName: 'VPC Configuration',
      domainId: 'domain1',
      proficiencyScore: 65,
      questionsAttempted: 20,
      questionsCorrect: 13,
    },
    {
      topicId: 'topic3',
      topicName: 'S3 Bucket Policies',
      domainId: 'domain1',
      proficiencyScore: 90,
      questionsAttempted: 10,
      questionsCorrect: 9,
    },
  ];

  const domainName = 'Security & Compliance';

  describe('Empty/No Data State', () => {
    it('should display no topics message when topics array is empty', () => {
      render(<TopicBreakdownView domainName={domainName} topics={[]} />);

      expect(screen.getByText('No Topics Available')).toBeInTheDocument();
      expect(screen.getByText('No topic data found for this domain')).toBeInTheDocument();
    });

    it('should display no topics message when topics is null', () => {
      render(<TopicBreakdownView domainName={domainName} topics={null as unknown as []} />);

      expect(screen.getByText('No Topics Available')).toBeInTheDocument();
    });

    it('should display domain name in header when no data', () => {
      render(<TopicBreakdownView domainName={domainName} topics={[]} />);

      expect(screen.getByText(domainName)).toBeInTheDocument();
    });

    it('should not display topic data when empty', () => {
      render(<TopicBreakdownView domainName={domainName} topics={[]} />);

      expect(screen.queryByText('IAM Roles')).not.toBeInTheDocument();
      expect(screen.queryByText('Questions')).not.toBeInTheDocument();
    });
  });

  describe('Data Transformation for Chart Libraries', () => {
    it('should sort topics by proficiency score (lowest first)', () => {
      const { container } = render(
        <TopicBreakdownView domainName={domainName} topics={mockTopics} />,
      );

      const topicElements = container.querySelectorAll('h5');
      const topicNames = Array.from(topicElements).map((el) => el.textContent);

      // Should be sorted: VPC Configuration (65%), IAM Roles (80%), S3 Bucket Policies (90%)
      expect(topicNames[0]).toBe('VPC Configuration');
      expect(topicNames[1]).toBe('IAM Roles');
      expect(topicNames[2]).toBe('S3 Bucket Policies');
    });

    it('should display proficiency scores as percentages', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.getByText('80')).toBeInTheDocument();
      expect(screen.getByText('65')).toBeInTheDocument();
      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('should display questions attempted count', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should display questions correct count', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('13')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('should calculate and display incorrect count', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      // IAM Roles: 15 - 12 = 3
      const iamRoles = screen.getByText('IAM Roles').closest('.bg-slate-50');
      expect(iamRoles?.textContent).toContain('Incorrect');
      expect(iamRoles?.textContent).toContain('3');

      // VPC Configuration: 20 - 13 = 7
      const vpcConfig = screen.getByText('VPC Configuration').closest('.bg-slate-50');
      expect(vpcConfig?.textContent).toContain('Incorrect');
      expect(vpcConfig?.textContent).toContain('7');

      // S3 Bucket Policies: 10 - 9 = 1
      const s3Policies = screen.getByText('S3 Bucket Policies').closest('.bg-slate-50');
      expect(s3Policies?.textContent).toContain('Incorrect');
      expect(s3Policies?.textContent).toContain('1');
    });

    it('should round fractional proficiency scores', () => {
      const fractionalTopics: TopicProficiency[] = [
        {
          ...mockTopics[0],
          proficiencyScore: 79.6,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={fractionalTopics} />);

      expect(screen.getByText('80')).toBeInTheDocument();
    });
  });

  describe('Drill-Down Navigation', () => {
    it('should call onTopicClick when topic is clicked', async () => {
      const user = userEvent.setup();
      const onTopicClick = vi.fn();

      render(
        <TopicBreakdownView
          domainName={domainName}
          topics={mockTopics}
          onTopicClick={onTopicClick}
        />,
      );

      const topicElement = screen.getByText('IAM Roles');
      await user.click(topicElement);

      expect(onTopicClick).toHaveBeenCalledWith('topic1');
      expect(onTopicClick).toHaveBeenCalledTimes(1);
    });

    it('should call onTopicClick with correct topicId for each topic', async () => {
      const user = userEvent.setup();
      const onTopicClick = vi.fn();

      render(
        <TopicBreakdownView
          domainName={domainName}
          topics={mockTopics}
          onTopicClick={onTopicClick}
        />,
      );

      await user.click(screen.getByText('IAM Roles'));
      expect(onTopicClick).toHaveBeenCalledWith('topic1');

      await user.click(screen.getByText('VPC Configuration'));
      expect(onTopicClick).toHaveBeenCalledWith('topic2');

      await user.click(screen.getByText('S3 Bucket Policies'));
      expect(onTopicClick).toHaveBeenCalledWith('topic3');
    });

    it('should display chevron icon when onTopicClick is provided', () => {
      const onTopicClick = vi.fn();
      const { container } = render(
        <TopicBreakdownView
          domainName={domainName}
          topics={mockTopics}
          onTopicClick={onTopicClick}
        />,
      );

      const chevrons = container.querySelectorAll('svg');
      const hasChevron = Array.from(chevrons).some(
        (svg) =>
          svg.classList.contains('lucide-chevron-right') ||
          svg.getAttribute('class')?.includes('lucide'),
      );

      expect(hasChevron).toBe(true);
    });

    it('should apply hover styles when clickable', () => {
      const onTopicClick = vi.fn();
      const { container } = render(
        <TopicBreakdownView
          domainName={domainName}
          topics={mockTopics}
          onTopicClick={onTopicClick}
        />,
      );

      const clickableElements = container.querySelectorAll('.cursor-pointer');
      expect(clickableElements.length).toBeGreaterThan(0);
    });

    it('should not apply cursor-pointer when onTopicClick is not provided', () => {
      const { container } = render(
        <TopicBreakdownView domainName={domainName} topics={mockTopics} />,
      );

      const topicCards = container.querySelectorAll('.bg-slate-50.rounded-xl');
      topicCards.forEach((card) => {
        expect(card.classList.contains('cursor-pointer')).toBe(false);
      });
    });

    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} onBack={onBack} />);

      const backButton = screen.getByRole('button');
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should not display back button when onBack is not provided', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Insufficient Data Handling', () => {
    it('should handle topic with zero questions attempted', () => {
      const zeroQuestionsTopics: TopicProficiency[] = [
        {
          topicId: 'topic1',
          topicName: 'Empty Topic',
          domainId: 'domain1',
          proficiencyScore: 0,
          questionsAttempted: 0,
          questionsCorrect: 0,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={zeroQuestionsTopics} />);

      expect(screen.getByText('Empty Topic')).toBeInTheDocument();
      const topicCard = screen.getByText('Empty Topic').closest('.bg-slate-50');
      expect(topicCard?.textContent).toContain('Questions');
      expect(topicCard?.textContent).toContain('0');
    });

    it('should handle topic with 1 question attempted', () => {
      const oneQuestionTopics: TopicProficiency[] = [
        {
          topicId: 'topic1',
          topicName: 'Minimal Topic',
          domainId: 'domain1',
          proficiencyScore: 100,
          questionsAttempted: 1,
          questionsCorrect: 1,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={oneQuestionTopics} />);

      expect(screen.getByText('Minimal Topic')).toBeInTheDocument();
      const topicCard = screen.getByText('Minimal Topic').closest('.bg-slate-50');
      expect(topicCard?.textContent).toContain('Questions');
      expect(topicCard?.textContent).toContain('1');
    });

    it('should handle topic with 2 questions attempted', () => {
      const twoQuestionsTopics: TopicProficiency[] = [
        {
          topicId: 'topic1',
          topicName: 'Low Data Topic',
          domainId: 'domain1',
          proficiencyScore: 50,
          questionsAttempted: 2,
          questionsCorrect: 1,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={twoQuestionsTopics} />);

      expect(screen.getByText('Low Data Topic')).toBeInTheDocument();
      const topicCard = screen.getByText('Low Data Topic').closest('.bg-slate-50');
      expect(topicCard?.textContent).toContain('Questions');
      expect(topicCard?.textContent).toContain('2');
    });
  });

  describe('Visual Elements', () => {
    it('should display header with title', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.getByText('Topic Breakdown')).toBeInTheDocument();
    });

    it('should display domain name in subtitle', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.getByText(domainName)).toBeInTheDocument();
    });

    it('should display total topics count', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(screen.getByText('Total Topics')).toBeInTheDocument();
      const totalTopicsElement = screen.getByText('Total Topics').nextElementSibling;
      expect(totalTopicsElement?.textContent).toBe('3');
    });

    it('should display info note about drilling down', () => {
      render(<TopicBreakdownView domainName={domainName} topics={mockTopics} />);

      expect(
        screen.getByText(
          'Click on any topic to see subtopic-level breakdown and identify specific areas for improvement',
        ),
      ).toBeInTheDocument();
    });

    it('should display progress bars for each topic', () => {
      const { container } = render(
        <TopicBreakdownView domainName={domainName} topics={mockTopics} />,
      );

      const progressBars = container.querySelectorAll('.bg-slate-200.rounded-full');
      expect(progressBars.length).toBe(3);
    });

    it('should display circular score indicators', () => {
      const { container } = render(
        <TopicBreakdownView domainName={domainName} topics={mockTopics} />,
      );

      const circles = container.querySelectorAll('.rounded-full.ring-4');
      expect(circles.length).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% proficiency score', () => {
      const zeroScoreTopics: TopicProficiency[] = [
        {
          topicId: 'topic1',
          topicName: 'Weak Topic',
          domainId: 'domain1',
          proficiencyScore: 0,
          questionsAttempted: 10,
          questionsCorrect: 0,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={zeroScoreTopics} />);

      const weakTopic = screen.getByText('Weak Topic').closest('.bg-slate-50');
      const scoreCircle = weakTopic?.querySelector('.text-xl.font-black');
      expect(scoreCircle?.textContent).toBe('0');
    });

    it('should handle 100% proficiency score', () => {
      const perfectScoreTopics: TopicProficiency[] = [
        {
          topicId: 'topic1',
          topicName: 'Perfect Topic',
          domainId: 'domain1',
          proficiencyScore: 100,
          questionsAttempted: 10,
          questionsCorrect: 10,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={perfectScoreTopics} />);

      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should handle very long topic names', () => {
      const longNameTopics: TopicProficiency[] = [
        {
          topicId: 'topic1',
          topicName:
            'Very Long Topic Name That Should Still Display Correctly Without Breaking Layout',
          domainId: 'domain1',
          proficiencyScore: 75,
          questionsAttempted: 20,
          questionsCorrect: 15,
        },
      ];

      render(<TopicBreakdownView domainName={domainName} topics={longNameTopics} />);

      expect(
        screen.getByText(
          'Very Long Topic Name That Should Still Display Correctly Without Breaking Layout',
        ),
      ).toBeInTheDocument();
    });

    it('should handle single topic', () => {
      const singleTopic: TopicProficiency[] = [mockTopics[0]];

      render(<TopicBreakdownView domainName={domainName} topics={singleTopic} />);

      expect(screen.getByText('IAM Roles')).toBeInTheDocument();
      const totalTopicsElement = screen.getByText('Total Topics').nextElementSibling;
      expect(totalTopicsElement?.textContent).toBe('1');
    });

    it('should handle many topics', () => {
      const manyTopics: TopicProficiency[] = Array.from({ length: 20 }, (_, i) => ({
        topicId: `topic${i}`,
        topicName: `Topic ${i}`,
        domainId: 'domain1',
        proficiencyScore: 50 + i * 2,
        questionsAttempted: 10,
        questionsCorrect: 5 + i,
      }));

      render(<TopicBreakdownView domainName={domainName} topics={manyTopics} />);

      expect(screen.getByText('Topic 0')).toBeInTheDocument();
      expect(screen.getByText('Topic 19')).toBeInTheDocument();
      const totalTopicsElement = screen.getByText('Total Topics').nextElementSibling;
      expect(totalTopicsElement?.textContent).toBe('20');
    });
  });
});
