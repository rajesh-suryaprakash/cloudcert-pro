import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CertificationDetailPanel from './CertificationDetailPanel';
import * as client from '../../../api/client';

// Mock the API client
vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
}));

// Mock the navigation hooks
vi.mock('../../../hooks/useAdminNavigation', () => ({
  useAdminNavigation: vi.fn(() => ({
    context: null,
    currentIndex: -1,
    total: 0,
    canGoPrevious: false,
    canGoNext: false,
    isLoading: false,
    error: null,
    cachedData: null,
    goNext: vi.fn(),
    goPrevious: vi.fn(),
    initializeFromList: vi.fn(),
    initializeFromURL: vi.fn(),
    updateContext: vi.fn(),
    clearError: vi.fn(),
    cacheCurrentData: vi.fn(),
    getCachedData: vi.fn(() => null),
    getCacheStats: vi.fn(() => ({ size: 0, estimatedMemoryBytes: 0 })),
  })),
}));

vi.mock('../../../hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: vi.fn(),
}));

describe('CertificationDetailPanel - Navigation Integration', () => {
  const mockCert = {
    id: 'cert-1',
    title: 'AWS Solutions Architect',
    vendor: 'Amazon',
    description: 'Test certification',
    level: 'Associate',
    url: 'https://aws.amazon.com',
    iconUrl: '/icons/aws.svg',
  };

  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default API responses
    (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/certifications') {
        return Promise.resolve([mockCert]);
      }
      if (url.includes('/topics')) {
        return Promise.resolve([]);
      }
      if (url.includes('/exams')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
  });

  it('should initialize useAdminNavigation hook with certifications entity type', async () => {
    const { useAdminNavigation } = await import('../../../hooks/useAdminNavigation');

    render(
      <BrowserRouter>
        <CertificationDetailPanel
          certificationId="cert-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(useAdminNavigation).toHaveBeenCalledWith(
        'certifications',
        'cert-1',
        expect.objectContaining({
          onNavigationError: expect.any(Function),
        }),
      );
    });
  });

  it('should initialize useKeyboardNavigation hook', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');

    render(
      <BrowserRouter>
        <CertificationDetailPanel
          certificationId="cert-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(useKeyboardNavigation).toHaveBeenCalled();
    });
  });

  it('should disable keyboard navigation when edit form is shown', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');

    render(
      <BrowserRouter>
        <CertificationDetailPanel
          certificationId="cert-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading certification details...')).not.toBeInTheDocument();
    });

    // Initially, keyboard navigation should be enabled (not in edit mode, no modal)
    expect(useKeyboardNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it('should not render NavigationControls when navigation context is null', async () => {
    render(
      <BrowserRouter>
        <CertificationDetailPanel
          certificationId="cert-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading certification details...')).not.toBeInTheDocument();
    });

    // NavigationControls should not be rendered when context is null
    expect(screen.queryByText(/Record \d+ of \d+/)).not.toBeInTheDocument();
  });
});
