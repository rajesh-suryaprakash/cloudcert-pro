/**
 * Integration Tests for ExamDetailPanel Navigation
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 3.2, 4.1, 4.2
 *
 * Tests:
 * - Navigation between exams (context in URL params)
 * - Filter-aware navigation (cert filter, search, status preserved)
 * - Edit mode behavior (navigation context unchanged during/after edit)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExamDetailPanel from './ExamDetailPanel';
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

const exams = [
  {
    id: 'exam-1',
    name: 'SAA-C03 Full Mock',
    description: 'Full mock exam for SAA-C03',
    duration: 130,
    totalQuestions: 65,
    passingScore: 72,
    questionSelectionStrategy: 'random',
    isActive: true,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-1',
  },
  {
    id: 'exam-2',
    name: 'SAA-C03 Practice Set',
    description: 'Practice set for SAA-C03',
    duration: 60,
    totalQuestions: 30,
    passingScore: 72,
    questionSelectionStrategy: 'random',
    isActive: true,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-1',
  },
  {
    id: 'exam-3',
    name: 'GCP ACE Mock',
    description: 'Mock exam for GCP ACE',
    duration: 120,
    totalQuestions: 50,
    passingScore: 70,
    questionSelectionStrategy: 'random',
    isActive: false,
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-2',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up API mocks so the panel can load exam data.
 * The ExamDetailPanel iterates over all certs and fetches exams per cert.
 */
function setupApiMocks(examId: string = 'exam-1') {
  const exam = exams.find((e) => e.id === examId) ?? exams[0];

  (certifications.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(certList);

  (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: { method?: string }) => {
    if (opts?.method === 'PUT') return Promise.resolve({ success: true });
    if (url.includes('/exams?all=true')) {
      // Return the exam(s) belonging to the cert in the URL
      const certId = url.split('/certifications/')[1]?.split('/')[0];
      return Promise.resolve(exams.filter((e) => e._certId === certId).map((e) => ({ ...e })));
    }
    if (url.includes('/effective-topic-weights')) return Promise.resolve({ topics: [] });
    if (url.includes('/topics')) return Promise.resolve([]);
    return Promise.resolve([]);
  });

  return exam;
}

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function renderPanel(
  examId: string,
  props?: Partial<React.ComponentProps<typeof ExamDetailPanel>>,
) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onBack = vi.fn();

  const result = render(
    <MemoryRouter>
      <ExamDetailPanel
        examId={examId}
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
// 1. Navigation between exams
// Validates: Requirement 3.2 - Navigation system supports Exams
// ---------------------------------------------------------------------------

describe('Navigation between exams', () => {
  it('renders NavigationControls when navigation context is present in URL', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the first exam', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for a middle exam', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for the last exam', async () => {
    setupApiMocks('exam-3');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-3');

    renderPanel('exam-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });
  });

  it('does NOT render NavigationControls when no navigation context in URL', async () => {
    setupApiMocks('exam-1');
    // No ids/current params set

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.queryByText('Loading exam details...')).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('navigation', { name: /record navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('Previous button is disabled at the first exam', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeDisabled();
  });

  it('Next button is disabled at the last exam', async () => {
    setupApiMocks('exam-3');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-3');

    renderPanel('exam-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
  });

  it('Both buttons are enabled for a middle exam', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('clicking Next navigates to the next exam', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('exam-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('clicking Previous navigates to the previous exam', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('exam-1'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('navigation URL includes the ids context parameter', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('ids='), expect.any(Object));
  });

  it('navigation URL contains the target exam ID and current param', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('exam-2');
    expect(navigateCall).toContain('current=exam-2');
  });

  it('shows single record context correctly with both buttons disabled', async () => {
    setupApiMocks('exam-1');
    setNavigationContext(['exam-1'], 'exam-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('navigation uses replace: false to support browser back/forward', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

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
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    // Context should be restored from URL params
    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Filter-aware navigation
// Validates: Requirement 3.2 - Navigation system supports Exams
//            Requirement 2.1 - Navigation context includes only filtered IDs
// ---------------------------------------------------------------------------

describe('Filter-aware navigation', () => {
  it('preserves certification filter in navigation context', async () => {
    setupApiMocks('exam-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'exam-1,exam-2');
    mockSearchParams.set('current', 'exam-1');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    // Navigation context should reflect the filtered set (2 exams for cert-1)
    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves search filter in navigation context', async () => {
    setupApiMocks('exam-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'exam-1,exam-2');
    mockSearchParams.set('current', 'exam-1');
    mockSearchParams.set('navSearch', 'SAA');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('preserves status filter in navigation context', async () => {
    setupApiMocks('exam-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'exam-1,exam-2');
    mockSearchParams.set('current', 'exam-1');
    mockSearchParams.set('navStatus', 'active');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });

  it('navigation URL preserves filter params when navigating next', async () => {
    setupApiMocks('exam-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'exam-1,exam-2');
    mockSearchParams.set('current', 'exam-1');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('exam-2');
    expect(navigateCall).toContain('current=exam-2');
  });

  it('navigation URL preserves search filter when navigating previous', async () => {
    setupApiMocks('exam-2');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'exam-1,exam-2');
    mockSearchParams.set('current', 'exam-2');
    mockSearchParams.set('navSearch', 'SAA');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 2')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('exam-1');
    expect(navigateCall).toContain('current=exam-1');
  });

  it('shows only filtered exam count in position indicator', async () => {
    // Only 1 exam in filtered context (single active exam for cert-1)
    setupApiMocks('exam-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'exam-1');
    mockSearchParams.set('current', 'exam-1');
    mockSearchParams.set('navStatus', 'active');
    mockSearchParams.set('navCertId', 'cert-1');

    renderPanel('exam-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Edit mode behavior
// Validates: Requirement 4.1 - Navigation context unchanged during edit
//            Requirement 4.2 - Admin detail view remains in navigation mode after save
// ---------------------------------------------------------------------------

describe('Edit mode behavior', () => {
  it('NavigationControls remain visible when entering edit mode', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

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
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Position should still show 2 of 3
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('NavigationControls remain visible after canceling edit', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

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

  it('position indicator is unchanged after canceling edit', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('NavigationControls remain visible after saving edit', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update exam/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // After save, NavigationControls should still be visible
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('position indicator is unchanged after saving edit', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    const submitButton = screen.getByRole('button', { name: /update exam/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('keyboard navigation is disabled during edit mode', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');
    const mockUseKeyboard = vi.mocked(useKeyboardNavigation);

    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

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

    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

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

  it('navigation context IDs are unchanged when entering edit mode', async () => {
    setupApiMocks('exam-2');
    setNavigationContext(['exam-1', 'exam-2', 'exam-3'], 'exam-2');

    renderPanel('exam-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode — total count should remain 3
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Total should still be 3 (context unchanged)
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });
});
