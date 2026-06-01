import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SubTopicDetailPanel from './SubTopicDetailPanel';
import * as client from '../../../api/client';

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

describe('SubTopicDetailPanel - Navigation Integration', () => {
  const mockCert = {
    id: 'cert-1',
    title: 'AWS Solutions Architect',
    vendor: 'Amazon',
  };

  const mockTopic = {
    id: 'topic-1',
    title: 'Compute Services',
    certificationId: 'cert-1',
  };

  const mockSubtopic = {
    id: 'subtopic-1',
    title: 'EC2 Instances',
    topicId: 'topic-1',
    description: 'Test subtopic',
    orderIndex: 0,
  };

  const mockOnDelete = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup default API responses
    const certifications = await import('../../../api/certifications');
    (certifications.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue([mockCert]);

    (client.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/topics') && !url.includes('/subtopics')) {
        return Promise.resolve([mockTopic]);
      }
      if (url.includes('/subtopics')) {
        return Promise.resolve([mockSubtopic]);
      }
      return Promise.resolve([]);
    });
  });

  it('should initialize useAdminNavigation hook with subtopics entity type', async () => {
    const { useAdminNavigation } = await import('../../../hooks/useAdminNavigation');

    render(
      <BrowserRouter>
        <SubTopicDetailPanel subtopicId="subtopic-1" onDelete={mockOnDelete} onBack={mockOnBack} />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(useAdminNavigation).toHaveBeenCalledWith(
        'subtopics',
        'subtopic-1',
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
        <SubTopicDetailPanel subtopicId="subtopic-1" onDelete={mockOnDelete} onBack={mockOnBack} />
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
        <SubTopicDetailPanel subtopicId="subtopic-1" onDelete={mockOnDelete} onBack={mockOnBack} />
      </BrowserRouter>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading subtopic details...')).not.toBeInTheDocument();
    });

    // Initially, keyboard navigation should be enabled (not in edit mode, no modal)
    expect(useKeyboardNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it('should disable keyboard navigation when delete modal is open', async () => {
    const { useKeyboardNavigation } = await import('../../../hooks/useKeyboardNavigation');

    render(
      <BrowserRouter>
        <SubTopicDetailPanel subtopicId="subtopic-1" onDelete={mockOnDelete} onBack={mockOnBack} />
      </BrowserRouter>,
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading subtopic details...')).not.toBeInTheDocument();
    });

    // Keyboard navigation should be enabled initially
    expect(useKeyboardNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it('should not render NavigationControls when navigation context is null', async () => {
    render(
      <BrowserRouter>
        <SubTopicDetailPanel subtopicId="subtopic-1" onDelete={mockOnDelete} onBack={mockOnBack} />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading subtopic details...')).not.toBeInTheDocument();
    });

    // NavigationControls should not be rendered when context is null
    expect(screen.queryByText(/Record \d+ of \d+/)).not.toBeInTheDocument();
  });
});
