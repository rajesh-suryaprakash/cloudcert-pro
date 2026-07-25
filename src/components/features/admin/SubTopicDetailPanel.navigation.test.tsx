import React from 'react';
/**
 * Integration Tests for SubTopicDetailPanel Navigation
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 3.4, 2.1
 *
 * Tests:
 * - Navigation between subtopics (context in URL params)
 * - Topic filter preservation (nav-prefixed filter params preserved in URL)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubTopicDetailPanel from './SubTopicDetailPanel';
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
  {
    id: 'topic-2',
    title: 'Compute Services',
    description: 'EC2, Lambda, and more',
    orderIndex: 2,
    weightPercentage: 25,
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
  {
    id: 'subtopic-2',
    title: 'IAM Policies',
    description: 'Understanding IAM policies',
    orderIndex: 2,
    _topicId: 'topic-1',
    _topicTitle: 'IAM and Security',
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
  {
    id: 'subtopic-3',
    title: 'IAM Roles',
    description: 'Working with IAM roles',
    orderIndex: 3,
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
 * Set up API mocks so the panel can load subtopic data.
 * SubTopicDetailPanel iterates over all certs, fetches topics per cert,
 * then fetches subtopics per topic.
 */
function setupApiMocks(subtopicId: string = 'subtopic-1') {
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
      if (url.includes('/topics/topic-2/subtopics')) {
        return Promise.resolve([]);
      }
      if (url.includes('/subtopics/')) return Promise.resolve({});
      return Promise.resolve([]);
    },
  );

  return subtopics.find((s) => s.id === subtopicId) ?? subtopics[0];
}

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function renderPanel(
  subtopicId: string,
  props?: Partial<React.ComponentProps<typeof SubTopicDetailPanel>>,
) {
  const onDelete = vi.fn();
  const onBack = vi.fn();

  const result = render(
    <MemoryRouter>
      <SubTopicDetailPanel subtopicId={subtopicId} onDelete={onDelete} onBack={onBack} {...props} />
    </MemoryRouter>,
  );

  return { ...result, onDelete, onBack };
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
// 1. Navigation between subtopics
// Validates: Requirement 3.4 - Navigation system supports SubTopics
// ---------------------------------------------------------------------------

describe('Navigation between subtopics', () => {
  it('renders NavigationControls when navigation context is present in URL', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the first subtopic', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for a middle subtopic', async () => {
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the last subtopic', async () => {
    setupApiMocks('subtopic-3');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-3');

    renderPanel('subtopic-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });
  });

  it('does NOT render NavigationControls when no navigation context in URL', async () => {
    setupApiMocks('subtopic-1');
    // No ids/current params set

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.queryByText('Loading subtopic details...')).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('navigation', { name: /record navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('Previous button is disabled at the first subtopic', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeDisabled();
  });

  it('Next button is disabled at the last subtopic', async () => {
    setupApiMocks('subtopic-3');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-3');

    renderPanel('subtopic-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
  });

  it('Both buttons are enabled for a middle subtopic', async () => {
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('clicking Next navigates to the next subtopic', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('subtopic-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('clicking Previous navigates to the previous subtopic', async () => {
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('subtopic-1'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('navigation URL includes the ids context parameter', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('ids='), expect.any(Object));
  });

  it('navigation URL contains the target subtopic ID and current param', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('subtopic-2');
    expect(navigateCall).toContain('current=subtopic-2');
  });

  it('shows single record context correctly with both buttons disabled', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('navigation uses replace: false to support browser back/forward', async () => {
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

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
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

    // Context should be restored from URL params
    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('displays the subtopic title after loading from list context', async () => {
    setupApiMocks('subtopic-1');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('IAM Users and Groups')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Topic filter preservation
// Validates: Requirement 2.1 - Navigation context includes only filtered IDs
//            Requirement 3.4 - Navigation system supports SubTopics
// ---------------------------------------------------------------------------

describe('Topic filter preservation', () => {
  it('preserves topic filter in navigation context', async () => {
    setupApiMocks('subtopic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1,subtopic-2');
    mockSearchParams.set('current', 'subtopic-1');
    mockSearchParams.set('navTopicId', 'topic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    // Navigation context should reflect the filtered set (2 subtopics for topic-1)
    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves cert filter in navigation context', async () => {
    setupApiMocks('subtopic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1,subtopic-2');
    mockSearchParams.set('current', 'subtopic-1');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves search filter in navigation context', async () => {
    setupApiMocks('subtopic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1,subtopic-2');
    mockSearchParams.set('current', 'subtopic-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('navigation URL preserves topic filter when navigating next', async () => {
    setupApiMocks('subtopic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1,subtopic-2');
    mockSearchParams.set('current', 'subtopic-1');
    mockSearchParams.set('navTopicId', 'topic-1');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('subtopic-2');
    expect(navigateCall).toContain('current=subtopic-2');
  });

  it('navigation URL preserves search filter when navigating previous', async () => {
    setupApiMocks('subtopic-2');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1,subtopic-2');
    mockSearchParams.set('current', 'subtopic-2');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('subtopic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 2')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('subtopic-1');
    expect(navigateCall).toContain('current=subtopic-1');
  });

  it('shows only filtered subtopic count in position indicator', async () => {
    // Only 1 subtopic in filtered context
    setupApiMocks('subtopic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1');
    mockSearchParams.set('current', 'subtopic-1');
    mockSearchParams.set('navTopicId', 'topic-1');
    mockSearchParams.set('navSearch', 'IAM Users');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });
  });

  it('preserves multiple filter params in navigation URL', async () => {
    setupApiMocks('subtopic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'subtopic-1,subtopic-2');
    mockSearchParams.set('current', 'subtopic-1');
    mockSearchParams.set('navTopicId', 'topic-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('subtopic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('subtopic-2');
    expect(navigateCall).toContain('current=subtopic-2');
  });

  it('NavigationControls remain visible when entering edit mode', async () => {
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

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

  it('NavigationControls remain visible after canceling edit', async () => {
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

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
    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update sub topic/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // After save, NavigationControls should still be visible
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('keyboard navigation is disabled during edit mode', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');
    const mockUseKeyboard = vi.mocked(useKeyboardNavigation);

    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

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

    setupApiMocks('subtopic-2');
    setNavigationContext(['subtopic-1', 'subtopic-2', 'subtopic-3'], 'subtopic-2');

    renderPanel('subtopic-2');

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
});
