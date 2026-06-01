import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KnowledgeGapHeatmap from './KnowledgeGapHeatmap';
import type { DomainProficiency } from '../../../server/types/insights';

describe('KnowledgeGapHeatmap', () => {
  const mockDomainProficiency: DomainProficiency[] = [
    {
      domainId: 'domain1',
      domainName: 'Security & Compliance',
      proficiencyScore: 75,
      domainWeight: 30,
      questionsAttempted: 20,
      questionsCorrect: 15,
    },
    {
      domainId: 'domain2',
      domainName: 'Networking',
      proficiencyScore: 85,
      domainWeight: 25,
      questionsAttempted: 20,
      questionsCorrect: 17,
    },
    {
      domainId: 'domain3',
      domainName: 'Compute Services',
      proficiencyScore: 55,
      domainWeight: 20,
      questionsAttempted: 20,
      questionsCorrect: 11,
    },
  ];

  describe('Empty/No Data State', () => {
    it('should display no data message when domainProficiency is empty array', () => {
      render(<KnowledgeGapHeatmap domainProficiency={[]} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(
        screen.getByText('Complete exams to see your proficiency across domains'),
      ).toBeInTheDocument();
    });

    it('should display no data message when domainProficiency is null', () => {
      render(<KnowledgeGapHeatmap domainProficiency={null as unknown as []} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
    });

    it('should not display domain data when empty', () => {
      render(<KnowledgeGapHeatmap domainProficiency={[]} />);

      expect(screen.queryByText('Security & Compliance')).not.toBeInTheDocument();
      expect(screen.queryByText('Weight:')).not.toBeInTheDocument();
    });
  });

  describe('Data Transformation for Chart Libraries', () => {
    it('should sort domains by proficiency score (lowest first)', () => {
      const { container } = render(
        <KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />,
      );

      const domainElements = container.querySelectorAll('h5');
      const domainNames = Array.from(domainElements).map((el) => el.textContent);

      // Should be sorted: Compute Services (55%), Security (75%), Networking (85%)
      expect(domainNames[0]).toBe('Compute Services');
      expect(domainNames[1]).toBe('Security & Compliance');
      expect(domainNames[2]).toBe('Networking');
    });

    it('should display proficiency scores as percentages', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('55%')).toBeInTheDocument();
    });

    it('should display domain weights as percentages', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      const securityDomain = screen.getByText('Security & Compliance').closest('.space-y-2');
      expect(securityDomain?.textContent).toContain('Weight:');
      expect(securityDomain?.textContent).toContain('30%');

      const networkingDomain = screen.getByText('Networking').closest('.space-y-2');
      expect(networkingDomain?.textContent).toContain('Weight:');
      expect(networkingDomain?.textContent).toContain('25%');

      const computeDomain = screen.getByText('Compute Services').closest('.space-y-2');
      expect(computeDomain?.textContent).toContain('Weight:');
      expect(computeDomain?.textContent).toContain('20%');
    });

    it('should display questions attempted and correct counts', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      expect(screen.getByText('15/20')).toBeInTheDocument();
      expect(screen.getByText('17/20')).toBeInTheDocument();
      expect(screen.getByText('11/20')).toBeInTheDocument();
    });

    it('should round fractional proficiency scores', () => {
      const fractionalData: DomainProficiency[] = [
        {
          ...mockDomainProficiency[0],
          proficiencyScore: 75.7,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={fractionalData} />);

      expect(screen.getByText('76%')).toBeInTheDocument();
    });

    it('should round fractional domain weights', () => {
      const fractionalData: DomainProficiency[] = [
        {
          ...mockDomainProficiency[0],
          domainWeight: 29.4,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={fractionalData} />);

      const securityDomain = screen.getByText('Security & Compliance').closest('.space-y-2');
      expect(securityDomain?.textContent).toContain('Weight:');
      expect(securityDomain?.textContent).toContain('29%');
    });
  });

  describe('Drill-Down Navigation', () => {
    it('should call onDomainClick when domain is clicked', async () => {
      const user = userEvent.setup();
      const onDomainClick = vi.fn();

      render(
        <KnowledgeGapHeatmap
          domainProficiency={mockDomainProficiency}
          onDomainClick={onDomainClick}
        />,
      );

      const domainElement = screen.getByText('Security & Compliance');
      await user.click(domainElement);

      expect(onDomainClick).toHaveBeenCalledWith('domain1');
      expect(onDomainClick).toHaveBeenCalledTimes(1);
    });

    it('should display chevron icon when onDomainClick is provided', () => {
      const onDomainClick = vi.fn();
      const { container } = render(
        <KnowledgeGapHeatmap
          domainProficiency={mockDomainProficiency}
          onDomainClick={onDomainClick}
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

    it('should not display chevron icon when onDomainClick is not provided', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      const domainElement = screen.getByText('Security & Compliance');
      const parent = domainElement.closest('div');

      expect(parent?.classList.contains('cursor-pointer')).toBe(false);
    });

    it('should apply hover styles when clickable', () => {
      const onDomainClick = vi.fn();
      render(
        <KnowledgeGapHeatmap
          domainProficiency={mockDomainProficiency}
          onDomainClick={onDomainClick}
        />,
      );

      const domainElement = screen.getByText('Security & Compliance');
      const clickableParent = domainElement.closest('.cursor-pointer');

      expect(clickableParent).toBeInTheDocument();
    });

    it('should call onDomainClick with correct domainId for each domain', async () => {
      const user = userEvent.setup();
      const onDomainClick = vi.fn();

      render(
        <KnowledgeGapHeatmap
          domainProficiency={mockDomainProficiency}
          onDomainClick={onDomainClick}
        />,
      );

      await user.click(screen.getByText('Security & Compliance'));
      expect(onDomainClick).toHaveBeenCalledWith('domain1');

      await user.click(screen.getByText('Networking'));
      expect(onDomainClick).toHaveBeenCalledWith('domain2');

      await user.click(screen.getByText('Compute Services'));
      expect(onDomainClick).toHaveBeenCalledWith('domain3');
    });
  });

  describe('Insufficient Data Handling', () => {
    it('should handle domain with zero questions attempted', () => {
      const zeroQuestionsData: DomainProficiency[] = [
        {
          domainId: 'domain1',
          domainName: 'Empty Domain',
          proficiencyScore: 0,
          domainWeight: 10,
          questionsAttempted: 0,
          questionsCorrect: 0,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={zeroQuestionsData} />);

      expect(screen.getByText('Empty Domain')).toBeInTheDocument();
      expect(screen.getByText('0/0')).toBeInTheDocument();
    });

    it('should handle domain with 1 question attempted', () => {
      const oneQuestionData: DomainProficiency[] = [
        {
          domainId: 'domain1',
          domainName: 'Minimal Domain',
          proficiencyScore: 100,
          domainWeight: 10,
          questionsAttempted: 1,
          questionsCorrect: 1,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={oneQuestionData} />);

      expect(screen.getByText('Minimal Domain')).toBeInTheDocument();
      expect(screen.getByText('1/1')).toBeInTheDocument();
    });

    it('should handle domain with 2 questions attempted', () => {
      const twoQuestionsData: DomainProficiency[] = [
        {
          domainId: 'domain1',
          domainName: 'Low Data Domain',
          proficiencyScore: 50,
          domainWeight: 10,
          questionsAttempted: 2,
          questionsCorrect: 1,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={twoQuestionsData} />);

      expect(screen.getByText('Low Data Domain')).toBeInTheDocument();
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });
  });

  describe('Visual Elements and Color Coding', () => {
    it('should display header with title', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      expect(screen.getByText('Knowledge Gap Heatmap')).toBeInTheDocument();
    });

    it('should display subtitle with instructions', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      expect(
        screen.getByText('Proficiency across exam domains (click to drill down)'),
      ).toBeInTheDocument();
    });

    it('should display legend with color meanings', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      expect(screen.getByText('< 60% (Needs Work)')).toBeInTheDocument();
      expect(screen.getByText('60-79% (Improving)')).toBeInTheDocument();
      expect(screen.getByText('≥ 80% (Strong)')).toBeInTheDocument();
    });

    it('should display info note about focusing on weak areas', () => {
      render(<KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />);

      expect(
        screen.getByText(
          'Focus on domains with lower proficiency and higher exam weight for maximum impact',
        ),
      ).toBeInTheDocument();
    });

    it('should display progress bars for each domain', () => {
      const { container } = render(
        <KnowledgeGapHeatmap domainProficiency={mockDomainProficiency} />,
      );

      const progressBars = container.querySelectorAll('.bg-slate-100.rounded-full');
      expect(progressBars.length).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0% proficiency score', () => {
      const zeroScoreData: DomainProficiency[] = [
        {
          domainId: 'domain1',
          domainName: 'Weak Domain',
          proficiencyScore: 0,
          domainWeight: 10,
          questionsAttempted: 10,
          questionsCorrect: 0,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={zeroScoreData} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('0/10')).toBeInTheDocument();
    });

    it('should handle 100% proficiency score', () => {
      const perfectScoreData: DomainProficiency[] = [
        {
          domainId: 'domain1',
          domainName: 'Perfect Domain',
          proficiencyScore: 100,
          domainWeight: 10,
          questionsAttempted: 10,
          questionsCorrect: 10,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={perfectScoreData} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('10/10')).toBeInTheDocument();
    });

    it('should handle very long domain names', () => {
      const longNameData: DomainProficiency[] = [
        {
          domainId: 'domain1',
          domainName:
            'Very Long Domain Name That Should Still Display Correctly Without Breaking Layout',
          proficiencyScore: 75,
          domainWeight: 30,
          questionsAttempted: 20,
          questionsCorrect: 15,
        },
      ];

      render(<KnowledgeGapHeatmap domainProficiency={longNameData} />);

      expect(
        screen.getByText(
          'Very Long Domain Name That Should Still Display Correctly Without Breaking Layout',
        ),
      ).toBeInTheDocument();
    });

    it('should handle single domain', () => {
      const singleDomain: DomainProficiency[] = [mockDomainProficiency[0]];

      render(<KnowledgeGapHeatmap domainProficiency={singleDomain} />);

      expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
    });

    it('should handle many domains', () => {
      const manyDomains: DomainProficiency[] = Array.from({ length: 10 }, (_, i) => ({
        domainId: `domain${i}`,
        domainName: `Domain ${i}`,
        proficiencyScore: 50 + i * 5,
        domainWeight: 10,
        questionsAttempted: 10,
        questionsCorrect: 5 + i,
      }));

      render(<KnowledgeGapHeatmap domainProficiency={manyDomains} />);

      expect(screen.getByText('Domain 0')).toBeInTheDocument();
      expect(screen.getByText('Domain 9')).toBeInTheDocument();
    });
  });
});
