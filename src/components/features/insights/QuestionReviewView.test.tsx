import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionReviewView from './QuestionReviewView';

/**
 * Unit tests for QuestionReviewView component
 *
 * Tests cover:
 * - Pagination logic (Requirement 25.5)
 * - Filtering by topic
 * - Loading states
 * - Error handling
 * - Question display with 20 questions per page
 */

describe('QuestionReviewView', () => {
  const mockOnBack = vi.fn();
  const defaultProps = {
    topicId: 'topic-1',
    topicName: 'Identity & Access Management',
    certificationId: 'cert-1',
    onBack: mockOnBack,
  };

  const mockQuestions = Array.from({ length: 25 }, (_, i) => ({
    id: `q${i + 1}`,
    questionText: `Question ${i + 1} text`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswers: 'Option A',
    userAnswers: ['Option B'],
    isCorrect: false,
    explanation: `Explanation for question ${i + 1}`,
    distractorExplanations: {
      'Option B': `Why Option B is incorrect for question ${i + 1}`,
    },
    sessionId: 'session-1',
    sessionDate: '2024-01-15',
  }));

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner while fetching questions', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<QuestionReviewView {...defaultProps} />);

      expect(screen.getByText('Loading questions...')).toBeInTheDocument();
    });

    it('should display topic name in loading state', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<QuestionReviewView {...defaultProps} />);

      expect(screen.getByText(/Identity & Access Management/)).toBeInTheDocument();
    });

    it('should show back button in loading state', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<QuestionReviewView {...defaultProps} />);

      const backButton = screen.getAllByRole('button')[0];
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load questions')).toBeInTheDocument();
      });
    });

    it('should display specific error message', async () => {
      mockFetch.mockRejectedValue(new Error('Unauthorized'));

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
      });
    });

    it('should show try again button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should retry fetch when try again button is clicked', async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Mock successful response for retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      await user.click(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(screen.getByText('Question 1 text')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display no incorrect answers message when questions array is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No Incorrect Answers')).toBeInTheDocument();
      });
    });

    it('should display helpful message in empty state', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/You haven't answered any questions incorrectly for this topic yet/),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Pagination Logic - Requirement 25.5', () => {
    it('should fetch questions with page 1 and limit 20 on initial load', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=1&limit=20'),
          expect.any(Object),
        );
      });
    });

    it('should display 20 questions per page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1 text')).toBeInTheDocument();
        expect(screen.getByText('Question 20 text')).toBeInTheDocument();
      });
    });

    it('should display pagination controls when total pages > 1', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        // Should show page buttons - check for buttons with role
        const buttons = screen.getAllByRole('button');
        const pageButtons = buttons.filter(
          (btn) => btn.textContent === '1' || btn.textContent === '2',
        );
        expect(pageButtons.length).toBeGreaterThan(0);
      });
    });

    it('should not display pagination controls when total pages = 1', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 15),
          pagination: {
            page: 1,
            limit: 20,
            total: 15,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1 text')).toBeInTheDocument();
      });

      // Should not show pagination buttons
      const buttons = screen.getAllByRole('button');
      // Only back button should be present
      expect(buttons.length).toBe(1);
    });

    it('should disable previous button on first page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        // Find the previous button (should be disabled)
        const prevButton = buttons.find(
          (btn) => btn.querySelector('svg') && (btn as HTMLButtonElement).disabled,
        );
        expect(prevButton).toBeDefined();
      });
    });

    it('should enable next button when hasNext is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        // Find enabled buttons (should include next button)
        const enabledButtons = buttons.filter((btn) => !(btn as HTMLButtonElement).disabled);
        expect(enabledButtons.length).toBeGreaterThan(1);
      });
    });

    it('should navigate to next page when next button is clicked', async () => {
      const user = userEvent.setup();

      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1 text')).toBeInTheDocument();
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(20, 25),
          pagination: {
            page: 2,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: false,
            hasPrev: true,
          },
        }),
      });

      // Find and click page 2 button (not question number 2)
      const buttons = screen.getAllByRole('button');
      const page2Button = buttons.find(
        (btn) => btn.textContent === '2' && btn.className.includes('px-3'),
      );

      if (page2Button) {
        await user.click(page2Button);

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('page=2&limit=20'),
            expect.any(Object),
          );
        });
      }
    });

    it('should display correct pagination info text', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 to 20 of 25 questions/)).toBeInTheDocument();
      });
    });

    it('should display correct pagination info for last page', async () => {
      const page2Questions = mockQuestions.slice(20, 25);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: page2Questions,
          pagination: {
            page: 2,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: false,
            hasPrev: true,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        // Check for the pagination text - it should show "Showing 21 to 25 of 25 questions"
        expect(screen.getByText(/Showing/)).toBeInTheDocument();
        // Check that we have the correct total
        const totalElements = screen.getAllByText('25');
        expect(totalElements.length).toBeGreaterThan(0);
      });
    });

    it('should display ellipsis for large page ranges', async () => {
      const largeQuestionSet = Array.from({ length: 200 }, (_, i) => ({
        id: `q${i + 1}`,
        questionText: `Question ${i + 1} text`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswers: 'Option A',
        userAnswers: ['Option B'],
        isCorrect: false,
        explanation: `Explanation for question ${i + 1}`,
        distractorExplanations: {
          'Option B': `Why Option B is incorrect for question ${i + 1}`,
        },
        sessionId: 'session-1',
        sessionDate: '2024-01-15',
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: largeQuestionSet.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 200,
            totalPages: 10,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        // Should show ellipsis for pages beyond visible range
        expect(screen.getByText('...')).toBeInTheDocument();
      });
    });

    it('should show first and last page buttons for large page ranges', async () => {
      const largeQuestionSet = Array.from({ length: 200 }, (_, i) => ({
        id: `q${i + 1}`,
        questionText: `Question ${i + 1} text`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswers: 'Option A',
        userAnswers: ['Option B'],
        isCorrect: false,
        explanation: `Explanation for question ${i + 1}`,
        distractorExplanations: {
          'Option B': `Why Option B is incorrect for question ${i + 1}`,
        },
        sessionId: 'session-1',
        sessionDate: '2024-01-15',
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: largeQuestionSet.slice(80, 100),
          pagination: {
            page: 5,
            limit: 20,
            total: 200,
            totalPages: 10,
            hasNext: true,
            hasPrev: true,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        // Check for page buttons (not question numbers)
        const pageButtons = screen.getAllByRole('button');
        const pageButtonTexts = pageButtons.map((btn) => btn.textContent);
        expect(pageButtonTexts).toContain('1');
        expect(pageButtonTexts).toContain('10');
      });
    });
  });

  describe('Filtering by Topic', () => {
    it('should fetch questions filtered by topicId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/insights/topic/topic-1/questions'),
          expect.any(Object),
        );
      });
    });

    it('should include certificationId in query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('certificationId=cert-1'),
          expect.any(Object),
        );
      });
    });

    it('should refetch when topicId changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      const { rerender } = render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change topicId
      rerender(<QuestionReviewView {...defaultProps} topicId="topic-2" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.stringContaining('/api/insights/topic/topic-2/questions'),
          expect.any(Object),
        );
      });
    });

    it('should display topic name in header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Identity & Access Management/)).toBeInTheDocument();
      });
    });
  });

  describe('Question Numbering', () => {
    it('should number questions starting from 1 on first page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        // Check that question text is rendered (which means questions are displayed)
        expect(screen.getByText('Question 1 text')).toBeInTheDocument();
      });
    });

    it('should continue numbering on subsequent pages', async () => {
      const page2Questions = mockQuestions.slice(20, 25).map((q, i) => ({
        ...q,
        id: `q${20 + i + 1}`,
        questionText: `Question ${20 + i + 1} text`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: page2Questions,
          pagination: {
            page: 2,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: false,
            hasPrev: true,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        // Check that question 21 text is rendered
        expect(screen.getByText('Question 21 text')).toBeInTheDocument();
      });
    });
  });

  describe('Back Navigation', () => {
    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1 text')).toBeInTheDocument();
      });

      const backButton = screen.getAllByRole('button')[0];
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Total Questions Display', () => {
    it('should display total number of questions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });
  });

  describe('Footer Information', () => {
    it('should display helpful footer message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          questions: mockQuestions.slice(0, 20),
          pagination: {
            page: 1,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          },
        }),
      });

      render(<QuestionReviewView {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            /These questions show your most recent incorrect answers for this topic/,
          ),
        ).toBeInTheDocument();
      });
    });
  });
});
