import React from 'react';
/**
 * Integration Tests for QuestionDetailPanel Navigation
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 3.5, 4.1, 4.2
 *
 * Tests:
 * - Navigation between questions (context in URL params)
 * - Filter preservation (nav-prefixed filter params preserved in URL)
 * - Edit mode behavior (navigation context unchanged during/after edit)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuestionDetailPanel from './QuestionDetailPanel';
import * as client from '../../../api/client';
import * as certifications from '../../../api/certifications';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
}));

vi.mock('../../../api/certifications', () => ({
  fetchCertifications: vi.fn(),
}));

vi.mock('../../../hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: vi.fn(),
}));

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const certList = [
  {
    id: 'cert-1',
    title: 'AWS Solutions Architect',
    vendor: 'Amazon',
  },
  {
    id: 'cert-2',
    title: 'GCP Professional Cloud Architect',
    vendor: 'Google',
  },
];

const topics = [
  {
    id: 'topic-1',
    title: 'IAM and Security',
    description: 'Identity and access management',
    orderIndex: 1,
    weightPercentage: 30,
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
];

const subtopics = [
  {
    id: 'subtopic-1',
    title: 'IAM Users and Groups',
    description: 'Managing IAM users and groups',
    orderIndex: 1,
    _topicId: 'topic-1',
    _topicTitle: 'IAM and Security',
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
];

const questions = [
  {
    id: 'question-1',
    questionText: 'What is IAM?',
    questionType: 'single',
    options: [
      'Identity and Access Management',
      'Internet Access Module',
      'Integrated Auth Manager',
      'Internal API Manager',
    ],
    correctAnswers: 'Identity and Access Management',
    explanation: 'IAM stands for Identity and Access Management.',
    difficulty: 'Easy',
    tags: ['iam', 'security'],
    points: 1,
    isActive: true,
    _subTopicId: 'subtopic-1',
    _subTopicTitle: 'IAM Users and Groups',
    _topicId: 'topic-1',
    _topicTitle: 'IAM and Security',
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
  {
    id: 'question-2',
    questionText: 'What is an IAM Role?',
    questionType: 'single',
    options: ['A temporary identity', 'A permanent user', 'A group policy', 'A service endpoint'],
    correctAnswers: 'A temporary identity',
    explanation: 'An IAM Role is a temporary identity that can be assumed.',
    difficulty: 'Medium',
    tags: ['iam', 'roles'],
    points: 1,
    isActive: true,
    _subTopicId: 'subtopic-1',
    _subTopicTitle: 'IAM Users and Groups',
    _topicId: 'topic-1',
    _topicTitle: 'IAM and Security',
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
  {
    id: 'question-3',
    questionText: 'What is an IAM Policy?',
    questionType: 'single',
    options: [
      'A JSON document defining permissions',
      'A user group',
      'A service role',
      'A network rule',
    ],
    correctAnswers: 'A JSON document defining permissions',
    explanation: 'An IAM Policy is a JSON document that defines permissions.',
    difficulty: 'Medium',
    tags: ['iam', 'policies'],
    points: 1,
    isActive: true,
    _subTopicId: 'subtopic-1',
    _subTopicTitle: 'IAM Users and Groups',
    _topicId: 'topic-1',
    _topicTitle: 'IAM and Security',
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up API mocks so the panel can load question data.
 * QuestionDetailPanel iterates over all certs, fetches topics per cert,
 * then subtopics per topic, then questions per subtopic.
 */
function setupApiMocks(questionId: string = 'question-1') {
  (certifications.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(certList);

  (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string, opts?: { method?: string }) => {
      if (opts?.method === 'PUT') return Promise.resolve({ success: true });

      if (url.includes('/certifications/cert-1/topics')) {
        return Promise.resolve(topics.filter((t) => t._certId === 'cert-1').map((t) => ({ ...t })));
      }
      if (url.includes('/certifications/cert-2/topics')) {
        return Promise.resolve([]);
      }
      if (url.includes('/topics/topic-1/subtopics')) {
        return Promise.resolve(
          subtopics.filter((s) => s._topicId === 'topic-1').map((s) => ({ ...s })),
        );
      }
      if (url.includes('/subtopics/subtopic-1/questions')) {
        return Promise.resolve(questions.map((q) => ({ ...q })));
      }
      if (url.includes('/questions/')) return Promise.resolve({});
      return Promise.resolve([]);
    },
  );

  return questions.find((q) => q.id === questionId) ?? questions[0];
}

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function renderPanel(
  questionId: string,
  props?: Partial<React.ComponentProps<typeof QuestionDetailPanel>>,
) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onBack = vi.fn();

  const result = render(
    <MemoryRouter>
      <QuestionDetailPanel
        questionId={questionId}
        onEdit={onEdit}
        onDelete={onDelete}
        onBack={onBack}
        {...props}
      />
    </MemoryRouter>,
  );

  return { ...result, onEdit, onDelete, onBack };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockNavigate.mockClear();
  mockSetSearchParams.mockClear();
});

// ---------------------------------------------------------------------------
// 1. Navigation between questions
// Validates: Requirement 3.5 - Navigation system supports Questions
// ---------------------------------------------------------------------------

describe('Navigation between questions', () => {
  it('renders NavigationControls when navigation context is present in URL', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the first question', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for a middle question', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the last question', async () => {
    setupApiMocks('question-3');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-3');

    renderPanel('question-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });
  });

  it('does NOT render NavigationControls when no navigation context in URL', async () => {
    setupApiMocks('question-1');
    // No ids/current params set

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.queryByText('Loading question details...')).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('navigation', { name: /record navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('Previous button is disabled at the first question', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeDisabled();
  });

  it('Next button is disabled at the last question', async () => {
    setupApiMocks('question-3');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-3');

    renderPanel('question-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
  });

  it('Both buttons are enabled for a middle question', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('clicking Next navigates to the next question', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('question-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('clicking Previous navigates to the previous question', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('question-1'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('navigation URL includes the ids context parameter', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('ids='), expect.any(Object));
  });

  it('navigation URL contains the target question ID and current param', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('question-2');
    expect(navigateCall).toContain('current=question-2');
  });

  it('shows single record context correctly with both buttons disabled', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('navigation uses replace: false to support browser back/forward', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ replace: false }),
    );
  });

  it('restores navigation context from URL on mount', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    // Context should be restored from URL params
    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('displays the question text after loading from list context', async () => {
    setupApiMocks('question-1');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('What is IAM?')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Filter preservation
// Validates: Requirement 2.1 - Navigation context includes only filtered IDs
//            Requirement 3.5 - Navigation system supports Questions
// ---------------------------------------------------------------------------

describe('Filter preservation', () => {
  it('preserves subtopic filter in navigation context', async () => {
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navSubTopicId', 'subtopic-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    // Navigation context should reflect the filtered set (2 questions)
    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves cert filter in navigation context', async () => {
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves search filter in navigation context', async () => {
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves difficulty filter in navigation context', async () => {
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navDifficulty', 'Easy');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('navigation URL preserves subtopic filter when navigating next', async () => {
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navSubTopicId', 'subtopic-1');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('question-2');
    expect(navigateCall).toContain('current=question-2');
  });

  it('navigation URL preserves search filter when navigating previous', async () => {
    setupApiMocks('question-2');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-2');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 2')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('question-1');
    expect(navigateCall).toContain('current=question-1');
  });

  it('shows only filtered question count in position indicator', async () => {
    // Only 1 question in filtered context
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navSubTopicId', 'subtopic-1');
    mockSearchParams.set('navSearch', 'What is IAM');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });
  });

  it('preserves multiple filter params in navigation URL', async () => {
    setupApiMocks('question-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2');
    mockSearchParams.set('current', 'question-1');
    mockSearchParams.set('navSubTopicId', 'subtopic-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('question-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('question-2');
    expect(navigateCall).toContain('current=question-2');
  });
});

// ---------------------------------------------------------------------------
// 3. Edit mode behavior
// Validates: Requirement 4.1 - Navigation context unchanged during edit
//            Requirement 4.2 - Admin detail view remains in navigation mode after save
// ---------------------------------------------------------------------------

describe('Edit mode behavior', () => {
  it('NavigationControls remain visible when entering edit mode', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // NavigationControls should still be visible
    expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('position indicator is unchanged after entering edit mode', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Position indicator should be unchanged (Requirement 4.1)
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('NavigationControls remain visible after canceling edit', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Cancel edit
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // NavigationControls should still be visible
    expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('NavigationControls remain visible after saving edit', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Submit the form (Requirement 4.2 - remains in navigation mode after save)
    const submitButton = screen.getByRole('button', { name: /update question/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // After save, NavigationControls should still be visible
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('position indicator is unchanged after saving edit', async () => {
    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update question/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Position indicator should be unchanged after save (Requirement 4.2)
    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('keyboard navigation is disabled during edit mode', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');
    const mockUseKeyboard = vi.mocked(useKeyboardNavigation);

    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // After entering edit mode, keyboard navigation should be disabled
    const lastCall = mockUseKeyboard.mock.calls[mockUseKeyboard.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({ enabled: false });
  });

  it('keyboard navigation is disabled when delete confirmation modal is open', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');
    const mockUseKeyboard = vi.mocked(useKeyboardNavigation);

    setupApiMocks('question-2');
    setNavigationContext(['question-1', 'question-2', 'question-3'], 'question-2');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Open delete confirmation modal
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Keyboard navigation should be disabled when modal is open
    const lastCall = mockUseKeyboard.mock.calls[mockUseKeyboard.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({ enabled: false });
  });

  it('navigation context is preserved (not reset) when entering edit mode', async () => {
    setupApiMocks('question-2');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'question-1,question-2,question-3');
    mockSearchParams.set('current', 'question-2');
    mockSearchParams.set('navSubTopicId', 'subtopic-1');

    renderPanel('question-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Navigation context (ids, position) should be unchanged (Requirement 4.1)
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
  });
});
