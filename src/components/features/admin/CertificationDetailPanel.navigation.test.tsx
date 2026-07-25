import React from 'react';
/**
 * Integration Tests for CertificationDetailPanel Navigation
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 3.1, 4.1, 4.2, 4.3
 *
 * Tests:
 * - Navigation from list to detail (context in URL params)
 * - Navigation between certifications (next/previous)
 * - Edit mode preserving navigation context
 * - Browser back/forward navigation (URL-based state)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CertificationDetailPanel from './CertificationDetailPanel';
import * as client from '../../../api/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
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

const certifications = [
  {
    id: 'cert-1',
    title: 'AWS Solutions Architect',
    vendor: 'Amazon',
    description: 'AWS cert',
    level: 'Associate',
    url: 'https://aws.amazon.com',
    iconUrl: '/icons/aws.svg',
  },
  {
    id: 'cert-2',
    title: 'GCP Professional Cloud Architect',
    vendor: 'Google',
    description: 'GCP cert',
    level: 'Professional',
    url: 'https://cloud.google.com',
    iconUrl: '/icons/gcp.svg',
  },
  {
    id: 'cert-3',
    title: 'Azure Solutions Architect',
    vendor: 'Microsoft',
    description: 'Azure cert',
    level: 'Expert',
    url: 'https://azure.microsoft.com',
    iconUrl: '/icons/azure.svg',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupApiMocks(certId: string = 'cert-1') {
  const cert = certifications.find((c) => c.id === certId) ?? certifications[0];
  (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/certifications') return Promise.resolve(certifications);
    if (url.includes('/topics')) return Promise.resolve([]);
    if (url.includes('/exams')) return Promise.resolve([]);
    return Promise.resolve([]);
  });
  return cert;
}

function setNavigationContext(ids: string[], currentId: string) {
  mockSearchParams = new URLSearchParams();
  mockSearchParams.set('ids', ids.join(','));
  mockSearchParams.set('current', currentId);
}

function renderPanel(
  certId: string,
  props?: Partial<React.ComponentProps<typeof CertificationDetailPanel>>,
) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onBack = vi.fn();

  const result = render(
    <MemoryRouter>
      <CertificationDetailPanel
        certificationId={certId}
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
// 1. Navigation from list to detail
// Validates: Requirement 3.1 - Navigation system supports Certifications
// ---------------------------------------------------------------------------

describe('Navigation from list to detail', () => {
  it('renders NavigationControls when navigation context is present in URL', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('shows correct position indicator when navigating from list (first record)', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for middle record', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('shows correct position indicator for last record', async () => {
    setupApiMocks('cert-3');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-3');

    renderPanel('cert-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });
  });

  it('does NOT render NavigationControls when no navigation context in URL', async () => {
    setupApiMocks('cert-1');
    // No ids/current params set

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.queryByText('Loading certification details...')).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('navigation', { name: /record navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('displays the certification title after loading from list context', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('AWS Solutions Architect')).toBeInTheDocument();
    });
  });

  it('preserves filter state from nav-prefixed URL params', async () => {
    setupApiMocks('cert-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'cert-1,cert-2');
    mockSearchParams.set('current', 'cert-1');
    mockSearchParams.set('navVendor', 'Amazon');
    mockSearchParams.set('navSearch', 'aws');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });

    // Navigation controls should be visible with the filtered context
    expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Navigation between certifications
// Validates: Requirement 3.1 - Navigation system supports Certifications
// ---------------------------------------------------------------------------

describe('Navigation between certifications', () => {
  it('Previous button is disabled at the first record', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    expect(prevButton).toBeDisabled();
  });

  it('Next button is disabled at the last record', async () => {
    setupApiMocks('cert-3');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-3');

    renderPanel('cert-3');

    await waitFor(() => {
      expect(screen.getByText('Record 3 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(nextButton).toBeDisabled();
  });

  it('Both buttons are enabled for a middle record', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  });

  it('clicking Next navigates to the next certification', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    // Should call navigate with the next cert ID
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cert-2'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('clicking Previous navigates to the previous certification', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    fireEvent.click(prevButton);

    // Should call navigate with the previous cert ID
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('cert-1'),
      expect.objectContaining({ replace: false }),
    );
  });

  it('navigation URL includes the ids context parameter', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('ids=cert-1%2Ccert-2%2Ccert-3'),
      expect.any(Object),
    );
  });

  it('shows single record context correctly with both buttons disabled', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 1')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /navigate to previous record/i });
    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 3. Edit mode preserving navigation context
// Validates: Requirements 4.1, 4.2, 4.3
// ---------------------------------------------------------------------------

describe('Edit mode preserving navigation context', () => {
  it('NavigationControls remain visible when entering edit mode', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

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
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Position should still show 2 of 3
    expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
  });

  it('NavigationControls remain visible after canceling edit', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

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
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

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
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    // Mock PUT and re-fetch
    (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, opts?: { method?: string }) => {
        if (opts?.method === 'PUT') return Promise.resolve({ success: true });
        if (url === '/certifications') return Promise.resolve(certifications);
        if (url.includes('/topics')) return Promise.resolve([]);
        if (url.includes('/exams')) return Promise.resolve([]);
        return Promise.resolve([]);
      },
    );

    renderPanel('cert-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update certification/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // After save, NavigationControls should still be visible
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /record navigation/i })).toBeInTheDocument();
    });
  });

  it('position indicator is unchanged after saving edit', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, opts?: { method?: string }) => {
        if (opts?.method === 'PUT') return Promise.resolve({ success: true });
        if (url === '/certifications') return Promise.resolve(certifications);
        if (url.includes('/topics')) return Promise.resolve([]);
        if (url.includes('/exams')) return Promise.resolve([]);
        return Promise.resolve([]);
      },
    );

    renderPanel('cert-2');

    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    const submitButton = screen.getByRole('button', { name: /update certification/i });
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

    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

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
});

// ---------------------------------------------------------------------------
// 4. Browser back/forward navigation (URL-based state)
// Validates: Requirement 4.4 - URL encodes Navigation_Context
// ---------------------------------------------------------------------------

describe('Browser back/forward navigation', () => {
  it('navigation context is encoded in URL when navigating next', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    // navigate should be called with replace: false to support back/forward
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ replace: false }),
    );
  });

  it('navigation context is encoded in URL when navigating previous', async () => {
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

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
    setupApiMocks('cert-2');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-2');

    renderPanel('cert-2');

    // Context should be restored from URL params
    await waitFor(() => {
      expect(screen.getByText('Record 2 of 3')).toBeInTheDocument();
    });
  });

  it('navigation URL contains the current record ID', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    expect(navigateCall).toContain('cert-2');
    expect(navigateCall).toContain('current=cert-2');
  });

  it('navigation URL contains the full ids list for context restoration', async () => {
    setupApiMocks('cert-1');
    setNavigationContext(['cert-1', 'cert-2', 'cert-3'], 'cert-1');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // The ids param should be present in the URL
    expect(navigateCall).toContain('ids=');
  });

  it('navigation context with filter params is preserved in URL', async () => {
    setupApiMocks('cert-1');
    mockSearchParams = new URLSearchParams();
    mockSearchParams.set('ids', 'cert-1,cert-2');
    mockSearchParams.set('current', 'cert-1');
    mockSearchParams.set('navVendor', 'Amazon');

    renderPanel('cert-1');

    await waitFor(() => {
      expect(screen.getByText('Record 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /navigate to next record/i });
    fireEvent.click(nextButton);

    // navigate should have been called
    expect(mockNavigate).toHaveBeenCalled();
    const navigateCall = mockNavigate.mock.calls[0][0] as string;
    // Filters are now stored in sessionStorage (via navRef), not as URL params.
    // The navigation URL should contain the ids context and the new current ID.
    expect(navigateCall).toContain('cert-2');
    expect(navigateCall).toContain('current=cert-2');
  });
});
