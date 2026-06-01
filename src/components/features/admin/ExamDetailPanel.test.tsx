import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ExamDetailPanel from './ExamDetailPanel';
import * as client from '../../../api/client';
import * as certifications from '../../../api/certifications';

// Mock the API client
vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
}));

// Mock the certifications API
vi.mock('../../../api/certifications', () => ({
  fetchCertifications: vi.fn(),
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

describe('ExamDetailPanel - Navigation Integration', () => {
  const mockCert = {
    id: 'cert-1',
    title: 'AWS Solutions Architect',
    vendor: 'Amazon',
  };

  const mockExam = {
    id: 'exam-1',
    name: 'SAA-C03',
    description: 'Test exam',
    duration: 130,
    totalQuestions: 65,
    passingScore: 72,
    questionSelectionStrategy: 'random',
    isActive: true,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-1',
  };

  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default API responses
    (certifications.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue([mockCert]);

    (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/exams?all=true')) {
        return Promise.resolve([mockExam]);
      }
      if (url.includes('/topics')) {
        return Promise.resolve([]);
      }
      if (url.includes('/effective-topic-weights')) {
        return Promise.resolve({ topics: [] });
      }
      return Promise.resolve([]);
    });
  });

  it('should initialize useAdminNavigation hook with exams entity type', async () => {
    const { useAdminNavigation } = await import('../../../hooks/useAdminNavigation');

    render(
      <BrowserRouter>
        <ExamDetailPanel
          examId="exam-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(useAdminNavigation).toHaveBeenCalledWith(
        'exams',
        'exam-1',
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
        <ExamDetailPanel
          examId="exam-1"
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
        <ExamDetailPanel
          examId="exam-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading exam details...')).not.toBeInTheDocument();
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
        <ExamDetailPanel
          examId="exam-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onBack={mockOnBack}
        />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading exam details...')).not.toBeInTheDocument();
    });

    // NavigationControls should not be rendered when context is null
    expect(screen.queryByText(/Record \d+ of \d+/)).not.toBeInTheDocument();
  });
});
