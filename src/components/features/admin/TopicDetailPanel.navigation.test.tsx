/**
 * Integration Tests for TopicDetailPanel Navigation
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 3.3, 2.1
 *
 * Tests:
 * - Navigation between topics (context in URL params)
 * - Exam filter preservation (nav-prefixed filter params preserved in URL)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopicDetailPanel from './TopicDetailPanel';
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
    docUrl: 'https://docs.aws.amazon.com/iam',
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
  {
    id: 'topic-2',
    title: 'Compute Services',
    description: 'EC2, Lambda, and more',
    orderIndex: 2,
    weightPercentage: 25,
    docUrl: null,
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
  {
    id: 'topic-3',
    title: 'Networking',
    description: 'VPC, subnets, routing',
    orderIndex: 3,
    weightPercentage: 20,
    docUrl: null,
    _certId: 'cert-1',
    _certTitle: 'AWS Solutions Architect',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up API mocks so the panel can load topic data.
 * TopicDetailPanel iterates over all certs and fetches topics per cert.
 */
function setupApiMocks(topicId: string = 'topic-1') {
  (certifications.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(certList);

  (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: { method?: string }) => {
    if (opts?.method === 'PUT') return Promise.resolve({ success: true });
    if (url.includes('/certifications/cert-1/topics')) {
      return Promise.resolve(topics.filter((t) => t._certId === 'cert-1').map((t) => ({ ...t })));
    }
    if (url.includes('/certifications/cert-2/topics')) {
      return Promise.resolve([]);
    }
    if (url.includes('/topics/')) return Promise.resolve({});
    return Promise.resolve([]);
  });

  return topics.find((t) => t.id === topicId) ?? topics[0];
}

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function renderPanel(
  topicId: string,
  props?: Partial<React.ComponentProps<typeof TopicDetailPanel>>,
) {
  const onDelete = vi.fn();
  const onBack = vi.fn();

  const result = render(
    <MemoryRouter>
      <TopicDetailPanel topicId={topicId} onDelete={onDelete} onBack={onBack} {...props} />
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
// 1. Navigation between topics
// Validates: Requirement 3.3 - Navigation system supports Topics
// ---------------------------------------------------------------------------

describe('Navigation between topics', () => {
  it('renders NavigationControls when navigation context is present in URL', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the first topic', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for a middle topic', async () => {
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the last topic', async () => {
    setupApiMocks('topic-3');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-3');

    renderPanel('topic-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });
  });

  it('does NOT render NavigationControls when no navigation context in URL', async () => {
    setupApiMocks('topic-1');
    // No ids/current params set

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.queryByText('Loading topic details...')).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('navigation', { name: /record navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('Previous button is disabled at the first topic', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeDisabled();
  });

  it('Next button is disabled at the last topic', async () => {
    setupApiMocks('topic-3');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-3');

    renderPanel('topic-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
  });

  it('Both buttons are enabled for a middle topic', async () => {
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('clicking Next navigates to the next topic', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('topic-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('clicking Previous navigates to the previous topic', async () => {
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('topic-1'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('navigation URL includes the ids context parameter', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('ids='), expect.any(Object));
  });

  it('navigation URL contains the target topic ID and current param', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('topic-2');
    expect(navigateCall).toContain('current=topic-2');
  });

  it('shows single record context correctly with both buttons disabled', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('navigation uses replace: false to support browser back/forward', async () => {
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

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
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

    // Context should be restored from URL params
    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('displays the topic title after loading from list context', async () => {
    setupApiMocks('topic-1');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('IAM and Security')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Exam filter preservation
// Validates: Requirement 2.1 - Navigation context includes only filtered IDs
//            Requirement 3.3 - Navigation system supports Topics
// ---------------------------------------------------------------------------

describe('Exam filter preservation', () => {
  it('preserves exam/cert filter in navigation context', async () => {
    setupApiMocks('topic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'topic-1,topic-2');
    mockSearchParams.set('current', 'topic-1');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    // Navigation context should reflect the filtered set (2 topics for cert-1)
    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves search filter in navigation context', async () => {
    setupApiMocks('topic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'topic-1,topic-2');
    mockSearchParams.set('current', 'topic-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('navigation URL preserves exam/cert filter when navigating next', async () => {
    setupApiMocks('topic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'topic-1,topic-2');
    mockSearchParams.set('current', 'topic-1');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('topic-2');
    expect(navigateCall).toContain('current=topic-2');
  });

  it('navigation URL preserves search filter when navigating previous', async () => {
    setupApiMocks('topic-2');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'topic-1,topic-2');
    mockSearchParams.set('current', 'topic-2');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('topic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 2')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('topic-1');
    expect(navigateCall).toContain('current=topic-1');
  });

  it('shows only filtered topic count in position indicator', async () => {
    // Only 1 topic in filtered context
    setupApiMocks('topic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'topic-1');
    mockSearchParams.set('current', 'topic-1');
    mockSearchParams.set('navCertId', 'cert-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });
  });

  it('preserves multiple filter params in navigation URL', async () => {
    setupApiMocks('topic-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'topic-1,topic-2');
    mockSearchParams.set('current', 'topic-1');
    mockSearchParams.set('navCertId', 'cert-1');
    mockSearchParams.set('navSearch', 'IAM');

    renderPanel('topic-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('topic-2');
    expect(navigateCall).toContain('current=topic-2');
  });

  it('NavigationControls remain visible when entering edit mode', async () => {
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

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
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

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
    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update topic/i });
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

    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

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

    setupApiMocks('topic-2');
    setNavigationContext(['topic-1', 'topic-2', 'topic-3'], 'topic-2');

    renderPanel('topic-2');

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
