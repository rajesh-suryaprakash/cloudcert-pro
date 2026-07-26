import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StudyListView from './StudyListView';
import type { StudyListItem } from '../../../server/types/insights';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
delete (window as any).location;
(window as any).location = { href: '' };

describe('StudyListView', () => {
  const mockSessionId = 'session-123';
  const mockCertificationId = 'cert-456';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    window.location.href = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Study List Generation', () => {
    it('should fetch and display study list on mount', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'IAM Roles',
          subtopics: ['Role Policies', 'Trust Policies'],
          incorrectCount: 5,
          docUrl: 'https://docs.aws.amazon.com/iam',
          priority: 1,
        },
        {
          topicId: 'topic-2',
          topicName: 'VPC Networking',
          subtopics: ['Subnets', 'Route Tables'],
          incorrectCount: 3,
          docUrl: 'https://docs.aws.amazon.com/vpc',
          priority: 2,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      // Should show loading state initially
      expect(screen.getByText(/Loading study list/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('IAM Roles')).toBeInTheDocument();
      });

      expect(screen.getByText('VPC Networking')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/insights/study-list/${mockSessionId}`,
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('should sort study list by incorrect count (priority)', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Low Priority',
          subtopics: [],
          incorrectCount: 2,
          docUrl: null,
          priority: 3,
        },
        {
          topicId: 'topic-2',
          topicName: 'High Priority',
          subtopics: [],
          incorrectCount: 8,
          docUrl: null,
          priority: 1,
        },
        {
          topicId: 'topic-3',
          topicName: 'Medium Priority',
          subtopics: [],
          incorrectCount: 5,
          docUrl: null,
          priority: 2,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      const { container } = render(
        <StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />,
      );

      await waitFor(() => {
        expect(screen.getByText('High Priority')).toBeInTheDocument();
      });

      // Get all topic names in order
      const topicHeaders = container.querySelectorAll('h5');
      expect(topicHeaders[0]).toHaveTextContent('High Priority');
      expect(topicHeaders[1]).toHaveTextContent('Medium Priority');
      expect(topicHeaders[2]).toHaveTextContent('Low Priority');
    });

    it('should display incorrect count for each topic', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 7,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      const { container } = render(
        <StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />,
      );

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      // Check that the count "7" appears with "incorrect answers"
      const textContent = container.textContent || '';
      expect(textContent).toMatch(/7\s+incorrect\s+answers/i);
    });

    it('should use singular "answer" for incorrectCount of 1', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 1,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      const { container } = render(
        <StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />,
      );

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      // Check for singular "answer" (not "answers")
      const textContent = container.textContent || '';
      expect(textContent).toMatch(/1\s+incorrect\s+answer/i);
      expect(textContent).not.toMatch(/1\s+incorrect\s+answers/i);
    });

    it('should persist study list to localStorage', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      // Check localStorage
      const stored = localStorageMock.getItem(`studyList_${mockSessionId}`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored ?? '')).toEqual(mockStudyList);
    });

    it('should load from localStorage when API fails', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Cached Topic',
          subtopics: [],
          incorrectCount: 4,
          docUrl: null,
          priority: 1,
        },
      ];

      // Pre-populate localStorage
      localStorageMock.setItem(`studyList_${mockSessionId}`, JSON.stringify(mockStudyList));

      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      // Should load from cache
      await waitFor(() => {
        expect(screen.getByText('Cached Topic')).toBeInTheDocument();
      });

      // Should not show error since cache was available
      expect(screen.queryByText(/Failed to load study list/i)).not.toBeInTheDocument();
    });
  });

  describe('Retry Button Functionality', () => {
    it('should call retry API and navigate to new session', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ studyList: mockStudyList }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            newSessionId: 'new-session-789',
            questionCount: 3,
          }),
        });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', {
        name: /Retry Missed Questions/i,
      });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/insights/retry-missed/${mockSessionId}`,
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ randomizeOrder: true }),
          }),
        );
      });

      // Should navigate to new session
      await waitFor(() => {
        expect(window.location.href).toBe('/exam/new-session-789');
      });
    });

    it('should show loading state while creating retry session', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ studyList: mockStudyList }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({
                      newSessionId: 'new-session-789',
                      questionCount: 3,
                    }),
                  }),
                100,
              ),
            ),
        );

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', {
        name: /Retry Missed Questions/i,
      });
      fireEvent.click(retryButton);

      // Should show loading text
      expect(screen.getByText(/Creating Retry Session/i)).toBeInTheDocument();

      // Button should be disabled
      expect(retryButton).toBeDisabled();
    });

    it('should call onRetryMissed callback if provided', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      const onRetryMissed = vi.fn();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ studyList: mockStudyList }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            newSessionId: 'new-session-789',
            questionCount: 3,
          }),
        });

      render(
        <StudyListView
          sessionId={mockSessionId}
          certificationId={mockCertificationId}
          onRetryMissed={onRetryMissed}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', {
        name: /Retry Missed Questions/i,
      });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(window.location.href).toBe('/exam/new-session-789');
      });
    });

    it('should handle retry API failure gracefully', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ studyList: mockStudyList }),
        })
        .mockRejectedValueOnce(new Error('Failed to create retry session'));

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', {
        name: /Retry Missed Questions/i,
      });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to create retry session. Please try again.');
      });

      // Button should be enabled again
      expect(retryButton).not.toBeDisabled();

      alertSpy.mockRestore();
    });
  });

  describe('Subtopics Display', () => {
    it('should show/hide subtopics when expand button clicked', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: ['Subtopic A', 'Subtopic B', 'Subtopic C'],
          incorrectCount: 5,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      // Subtopics should not be visible initially
      expect(screen.queryByText('Subtopic A')).not.toBeInTheDocument();

      // Click expand button
      const expandButton = screen.getByRole('button', {
        name: /Show Subtopics/i,
      });
      fireEvent.click(expandButton);

      // Subtopics should now be visible
      expect(screen.getByText('Subtopic A')).toBeInTheDocument();
      expect(screen.getByText('Subtopic B')).toBeInTheDocument();
      expect(screen.getByText('Subtopic C')).toBeInTheDocument();

      // Button text should change
      expect(screen.getByRole('button', { name: /Hide Subtopics/i })).toBeInTheDocument();

      // Click collapse button
      fireEvent.click(expandButton);

      // Subtopics should be hidden again
      await waitFor(() => {
        expect(screen.queryByText('Subtopic A')).not.toBeInTheDocument();
      });
    });

    it('should not show expand button when no subtopics', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Show Subtopics/i })).not.toBeInTheDocument();
    });
  });

  describe('Documentation Links', () => {
    it('should display documentation link when docUrl provided', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: 'https://docs.example.com/topic',
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      const docLink = screen.getByTitle('View Documentation');
      expect(docLink).toHaveAttribute('href', 'https://docs.example.com/topic');
      expect(docLink).toHaveAttribute('target', '_blank');
      expect(docLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should not display documentation link when docUrl is null', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'Test Topic',
          subtopics: [],
          incorrectCount: 3,
          docUrl: null,
          priority: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
      });

      expect(screen.queryByTitle('View Documentation')).not.toBeInTheDocument();
    });
  });

  describe('Empty and Error States', () => {
    it('should display empty state when study list is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: [] }),
      });

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Perfect Score!')).toBeInTheDocument();
      });

      expect(screen.getByText(/You answered all questions correctly/i)).toBeInTheDocument();
    });

    it('should display error state when API fails and no cache available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load study list')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      mockFetch.mockImplementationOnce(
        () => new Promise(() => {}), // Never resolves
      );

      render(<StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />);

      expect(screen.getByText(/Loading study list/i)).toBeInTheDocument();
    });
  });

  describe('Priority Badges', () => {
    it('should apply correct badge colors based on priority', async () => {
      const mockStudyList: StudyListItem[] = [
        {
          topicId: 'topic-1',
          topicName: 'First Priority',
          subtopics: [],
          incorrectCount: 10,
          docUrl: null,
          priority: 1,
        },
        {
          topicId: 'topic-2',
          topicName: 'Second Priority',
          subtopics: [],
          incorrectCount: 8,
          docUrl: null,
          priority: 2,
        },
        {
          topicId: 'topic-3',
          topicName: 'Third Priority',
          subtopics: [],
          incorrectCount: 5,
          docUrl: null,
          priority: 3,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studyList: mockStudyList }),
      });

      const { container } = render(
        <StudyListView sessionId={mockSessionId} certificationId={mockCertificationId} />,
      );

      await waitFor(() => {
        expect(screen.getByText('First Priority')).toBeInTheDocument();
      });

      const badges = container.querySelectorAll('.w-8.h-8.rounded-lg');

      // First badge should be rose (highest priority)
      expect(badges[0]).toHaveClass('bg-rose-600');

      // Second badge should be orange
      expect(badges[1]).toHaveClass('bg-orange-500');

      // Third badge should be slate
      expect(badges[2]).toHaveClass('bg-slate-300');
    });
  });
});
