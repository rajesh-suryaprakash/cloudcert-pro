import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommunityBenchmarkComparison from './CommunityBenchmarkComparison';
import type { CommunityBenchmark } from '../../../server/types/insights';

/**
 * Unit tests for CommunityBenchmarkComparison component
 *
 * Tests cover:
 * - Benchmark comparison calculations (Requirement 10.3)
 * - Percentage point difference display
 * - Highlighting topics below community average
 * - Percentile ranking display
 */
describe('CommunityBenchmarkComparison', () => {
  const mockCommunityBenchmarks: CommunityBenchmark[] = [
    {
      domainId: 'domain1',
      name: 'Security & Compliance',
      communityAverage: 82,
      userScore: 75,
      difference: -7,
      needsImprovement: true,
      typicalPassingThreshold: 80,
    },
    {
      domainId: 'domain2',
      name: 'Networking',
      communityAverage: 78,
      userScore: 85,
      difference: 7,
      needsImprovement: false,
      typicalPassingThreshold: 75,
    },
    {
      topicId: 'topic1',
      name: 'VPC Configuration',
      communityAverage: 80,
      userScore: 72,
      difference: -8,
      needsImprovement: true,
      typicalPassingThreshold: 78,
    },
  ];

  describe('Empty/No Data State', () => {
    it('should display no data message when communityBenchmarks is empty array', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={[]} />);

      expect(screen.getByText('No Benchmark Data Available')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Community benchmarks will be available once sufficient users report passing the real exam',
        ),
      ).toBeInTheDocument();
    });

    it('should display no data message when communityBenchmarks is null', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={null as unknown as []} />);

      expect(screen.getByText('No Benchmark Data Available')).toBeInTheDocument();
    });

    it('should display Users icon when no data available', () => {
      const { container } = render(<CommunityBenchmarkComparison communityBenchmarks={[]} />);

      // Check for SVG element (icon)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Benchmark Comparison Calculations - Requirement 10.3', () => {
    it('should display user score for each benchmark', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      // Scores appear multiple times (user score and threshold), so check they exist
      const scores = screen.getAllByText(/\d+%/);
      expect(scores.length).toBeGreaterThan(0);

      // Verify "Your Score" label exists for each benchmark
      const yourScoreLabels = screen.getAllByText('Your Score');
      expect(yourScoreLabels.length).toBe(mockCommunityBenchmarks.length);
    });

    it('should display community average for each benchmark', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      // Scores appear multiple times, so check they exist
      const scores = screen.getAllByText(/\d+%/);
      expect(scores.length).toBeGreaterThan(0);

      // Verify "Community Avg" label exists for each benchmark
      const communityAvgLabels = screen.getAllByText('Community Avg');
      expect(communityAvgLabels.length).toBe(mockCommunityBenchmarks.length);
    });

    it('should calculate and display percentage point difference correctly', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      // Negative differences
      expect(screen.getByText('-7%')).toBeInTheDocument();
      expect(screen.getByText('-8%')).toBeInTheDocument();

      // Positive difference
      expect(screen.getByText('+7%')).toBeInTheDocument();
    });

    it('should display positive differences with + prefix', () => {
      const positiveDiffBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 70,
          userScore: 85,
          difference: 15,
          needsImprovement: false,
          typicalPassingThreshold: 75,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={positiveDiffBenchmark} />);

      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('should display negative differences without extra prefix', () => {
      const negativeDiffBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 85,
          userScore: 70,
          difference: -15,
          needsImprovement: true,
          typicalPassingThreshold: 80,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={negativeDiffBenchmark} />);

      expect(screen.getByText('-15%')).toBeInTheDocument();
    });

    it('should round fractional scores to nearest integer', () => {
      const fractionalBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 82.7,
          userScore: 75.3,
          difference: -7.4,
          needsImprovement: true,
          typicalPassingThreshold: 80.5,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={fractionalBenchmark} />);

      // Should round to nearest integer
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('83%')).toBeInTheDocument();
      expect(screen.getByText('-7%')).toBeInTheDocument();
      expect(screen.getByText('81%')).toBeInTheDocument();
    });
  });

  describe('Highlighting Topics Below Community Average', () => {
    it('should highlight benchmarks where needsImprovement is true', () => {
      const { container } = render(
        <CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />,
      );

      // Benchmarks needing improvement should have rose background
      const improvementCards = container.querySelectorAll('.bg-rose-50');
      expect(improvementCards.length).toBeGreaterThan(0);
    });

    it('should display "Below Avg" indicator for benchmarks needing improvement', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      const belowAvgIndicators = screen.getAllByText('Below Avg');
      expect(belowAvgIndicators.length).toBe(2); // Two benchmarks need improvement
    });

    it('should display "Above Avg" indicator for benchmarks above community average', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      const aboveAvgIndicators = screen.getAllByText('Above Avg');
      expect(aboveAvgIndicators.length).toBe(1); // One benchmark is above average
    });

    it('should display improvement alert for benchmarks needing improvement', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      const alerts = screen.getAllByText(
        /Focus area: Your score is below the community average for users who passed/i,
      );
      expect(alerts.length).toBe(2); // Two benchmarks need improvement
    });

    it('should not display improvement alert for benchmarks above average', () => {
      const aboveAverageBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 70,
          userScore: 85,
          difference: 15,
          needsImprovement: false,
          typicalPassingThreshold: 75,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={aboveAverageBenchmark} />);

      expect(
        screen.queryByText(/Focus area: Your score is below the community average/i),
      ).not.toBeInTheDocument();
    });

    it('should sort benchmarks by difference (lowest first)', () => {
      render(
        <CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />,
      );

      // Get all benchmark names in order
      const benchmarkNames = screen.getAllByRole('heading', { level: 6 });
      const names = benchmarkNames.map((el) => el.textContent);

      // VPC Configuration has difference -8 (lowest)
      // Security & Compliance has difference -7
      // Networking has difference +7 (highest)
      expect(names[0]).toBe('VPC Configuration');
      expect(names[1]).toBe('Security & Compliance');
      expect(names[2]).toBe('Networking');
    });
  });

  describe('Percentile Ranking Display', () => {
    it('should display percentile ranking when provided', () => {
      render(
        <CommunityBenchmarkComparison
          communityBenchmarks={mockCommunityBenchmarks}
          userPercentile={75}
        />,
      );

      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText('percentile')).toBeInTheDocument();
    });

    it('should display percentile ranking header', () => {
      render(
        <CommunityBenchmarkComparison
          communityBenchmarks={mockCommunityBenchmarks}
          userPercentile={75}
        />,
      );

      expect(screen.getByText('Your Percentile Ranking')).toBeInTheDocument();
      expect(
        screen.getByText('Compared to all users who took this certification'),
      ).toBeInTheDocument();
    });

    it('should not display percentile section when userPercentile is undefined', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(screen.queryByText('Your Percentile Ranking')).not.toBeInTheDocument();
      expect(screen.queryByText('percentile')).not.toBeInTheDocument();
    });

    it('should round percentile to nearest integer', () => {
      render(
        <CommunityBenchmarkComparison
          communityBenchmarks={mockCommunityBenchmarks}
          userPercentile={75.7}
        />,
      );

      expect(screen.getByText('76')).toBeInTheDocument();
    });

    it('should handle 0th percentile', () => {
      render(
        <CommunityBenchmarkComparison
          communityBenchmarks={mockCommunityBenchmarks}
          userPercentile={0}
        />,
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle 100th percentile', () => {
      render(
        <CommunityBenchmarkComparison
          communityBenchmarks={mockCommunityBenchmarks}
          userPercentile={100}
        />,
      );

      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  describe('Summary Statistics', () => {
    it('should display total count of domains/topics', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(screen.getByText('Total Domains/Topics')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display count of benchmarks below average', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(screen.getByText('Below Average')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display 0 for below average when all benchmarks are above', () => {
      const allAboveBenchmarks: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Domain 1',
          communityAverage: 70,
          userScore: 85,
          difference: 15,
          needsImprovement: false,
          typicalPassingThreshold: 75,
        },
        {
          domainId: 'domain2',
          name: 'Domain 2',
          communityAverage: 75,
          userScore: 80,
          difference: 5,
          needsImprovement: false,
          typicalPassingThreshold: 75,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={allAboveBenchmarks} />);

      expect(screen.getByText('Below Average')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should apply emerald styling when no benchmarks need improvement', () => {
      const allAboveBenchmarks: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Domain 1',
          communityAverage: 70,
          userScore: 85,
          difference: 15,
          needsImprovement: false,
          typicalPassingThreshold: 75,
        },
      ];

      const { container } = render(
        <CommunityBenchmarkComparison communityBenchmarks={allAboveBenchmarks} />,
      );

      // Should have emerald background for below average card
      const emeraldCards = container.querySelectorAll('.bg-emerald-50');
      expect(emeraldCards.length).toBeGreaterThan(0);
    });

    it('should apply amber styling when some benchmarks need improvement', () => {
      const { container } = render(
        <CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />,
      );

      // Should have amber background for below average card
      const amberCards = container.querySelectorAll('.bg-amber-50');
      expect(amberCards.length).toBeGreaterThan(0);
    });
  });

  describe('Visual Elements', () => {
    it('should display header with title', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(screen.getByText('Community Benchmark Comparison')).toBeInTheDocument();
    });

    it('should display subtitle with description', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(
        screen.getByText('Compare your performance to users who passed the real exam'),
      ).toBeInTheDocument();
    });

    it('should display benchmark names', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
      expect(screen.getByText('Networking')).toBeInTheDocument();
      expect(screen.getByText('VPC Configuration')).toBeInTheDocument();
    });

    it('should display typical passing threshold for each benchmark', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      // Multiple benchmarks have thresholds, so use getAllByText
      const thresholds = screen.getAllByText(/\d+%/);
      expect(thresholds.length).toBeGreaterThan(0);

      // Check that threshold label exists
      expect(screen.getAllByText('Threshold').length).toBe(mockCommunityBenchmarks.length);
    });

    it('should display progress bars for user score, community average, and threshold', () => {
      const { container } = render(
        <CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />,
      );

      // Each benchmark should have 3 progress bars (user, community, threshold)
      const progressBars = container.querySelectorAll('.rounded-full.h-2');
      expect(progressBars.length).toBe(mockCommunityBenchmarks.length * 3);
    });

    it('should display info note about community averages', () => {
      render(<CommunityBenchmarkComparison communityBenchmarks={mockCommunityBenchmarks} />);

      expect(
        screen.getByText(
          /Community averages are calculated from users who reported passing the real certification exam/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single benchmark', () => {
      const singleBenchmark: CommunityBenchmark[] = [mockCommunityBenchmarks[0]];

      const { container } = render(
        <CommunityBenchmarkComparison communityBenchmarks={singleBenchmark} />,
      );

      expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
      expect(screen.getByText('Total Domains/Topics')).toBeInTheDocument();

      // Check for "1" in the total count section specifically
      const totalSection = container.querySelector('.text-3xl.font-black.text-slate-900');
      expect(totalSection?.textContent).toBe('1');
    });

    it('should handle benchmark with 0% user score', () => {
      const zeroScoreBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 80,
          userScore: 0,
          difference: -80,
          needsImprovement: true,
          typicalPassingThreshold: 75,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={zeroScoreBenchmark} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('-80%')).toBeInTheDocument();
    });

    it('should handle benchmark with 100% user score', () => {
      const perfectScoreBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 85,
          userScore: 100,
          difference: 15,
          needsImprovement: false,
          typicalPassingThreshold: 80,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={perfectScoreBenchmark} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('+15%')).toBeInTheDocument();
    });

    it('should handle benchmark with 0 difference', () => {
      const zeroDiffBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'Test Domain',
          communityAverage: 80,
          userScore: 80,
          difference: 0,
          needsImprovement: false,
          typicalPassingThreshold: 75,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={zeroDiffBenchmark} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle very long benchmark names', () => {
      const longNameBenchmark: CommunityBenchmark[] = [
        {
          domainId: 'domain1',
          name: 'This is a very long domain name that should be displayed properly in the UI',
          communityAverage: 80,
          userScore: 75,
          difference: -5,
          needsImprovement: true,
          typicalPassingThreshold: 78,
        },
      ];

      render(<CommunityBenchmarkComparison communityBenchmarks={longNameBenchmark} />);

      expect(
        screen.getByText(
          'This is a very long domain name that should be displayed properly in the UI',
        ),
      ).toBeInTheDocument();
    });

    it('should handle many benchmarks', () => {
      const manyBenchmarks: CommunityBenchmark[] = Array.from({ length: 10 }, (_, i) => ({
        domainId: `domain${i}`,
        name: `Domain ${i}`,
        communityAverage: 80,
        userScore: 75 + i,
        difference: -5 + i,
        needsImprovement: i < 5,
        typicalPassingThreshold: 78,
      }));

      render(<CommunityBenchmarkComparison communityBenchmarks={manyBenchmarks} />);

      expect(screen.getByText('Total Domains/Topics')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });
});
