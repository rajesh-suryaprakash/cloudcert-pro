/**
 * Unit Tests for ExamsPanel - Navigation Context Building
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 2.1, 7.1
 *
 * Tests:
 * - Context building with certification filters (certId filter)
 * - Context building with search terms (name match, description match)
 * - Context building with status filters
 * - Context building with combined filters
 * - Context building edge cases (single match, all IDs included across pages)
 *
 * Strategy: The navigation context is built by `buildNavigationContextAndNavigate`
 * inside ExamsPanel, which calls `onSelectExam(exam, openEdit, ids)` where
 * `ids` is derived from the `filtered` array. We render the component with mocked
 * data and verify the IDs passed to `onSelectExam` match the expected filtered set.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExamsPanel from './ExamsPanel';
import * as certApi from '../../../api/certifications';
import * as apiClient from '../../../api/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../api/certifications', () => ({
  fetchCertifications: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
}));

const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const allCertifications = [
  { id: 'cert-aws', title: 'AWS Solutions Architect', vendor: 'Amazon' },
  { id: 'cert-gcp', title: 'GCP Professional Cloud Architect', vendor: 'Google' },
  { id: 'cert-azure', title: 'Azure Solutions Architect', vendor: 'Microsoft' },
];

const awsExams = [
  {
    id: 'exam-aws-1',
    name: 'AWS Full Mock Exam',
    description: 'Comprehensive AWS practice exam',
    duration: 130,
    totalQuestions: 65,
    passingScore: 70,
    questionSelectionStrategy: 'random',
    isActive: true,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'exam-aws-2',
    name: 'AWS Quick Practice',
    description: 'Short AWS practice session',
    duration: 60,
    totalQuestions: 30,
    passingScore: 70,
    questionSelectionStrategy: 'difficulty_balanced',
    isActive: false,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
];

const gcpExams = [
  {
    id: 'exam-gcp-1',
    name: 'GCP Architect Mock',
    description: 'Full GCP architect practice exam',
    duration: 120,
    totalQuestions: 50,
    passingScore: 70,
    questionSelectionStrategy: 'random',
    isActive: true,
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-gcp',
  },
  {
    id: 'exam-gcp-2',
    name: 'GCP Topic Practice',
    description: 'Topic-based GCP practice',
    duration: 90,
    totalQuestions: 40,
    passingScore: 70,
    questionSelectionStrategy: 'topic_based',
    isActive: true,
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-gcp',
  },
];

const azureExams = [
  {
    id: 'exam-azure-1',
    name: 'Azure Solutions Mock',
    description: 'Azure architect practice exam',
    duration: 150,
    totalQuestions: 60,
    passingScore: 70,
    questionSelectionStrategy: 'random',
    isActive: true,
    _certTitle: 'Azure Solutions Architect',
    _certId: 'cert-azure',
  },
];

const allExams = [...awsExams, ...gcpExams, ...azureExams];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupApiMocks() {
  (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(allCertifications);

  (apiClient.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    // Component fetches: /certifications/${certId}/exams?all=true
    if (url.includes('/certifications/cert-aws/exams'))
      return Promise.resolve(awsExams.map((e) => ({ ...e })));
    if (url.includes('/certifications/cert-gcp/exams'))
      return Promise.resolve(gcpExams.map((e) => ({ ...e })));
    if (url.includes('/certifications/cert-azure/exams'))
      return Promise.resolve(azureExams.map((e) => ({ ...e })));
    return Promise.resolve([]);
  });
}

function setUrlParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

function renderPanel(onSelectExam = vi.fn()) {
  return render(
    <MemoryRouter>
      <ExamsPanel onSelectExam={onSelectExam} />
    </MemoryRouter>,
  );
}

/**
 * Wait for a specific exam name to appear in the DOM.
 * This is more reliable than waiting for the loading spinner because the component
 * loads certs first, then exams — the loading state may not be visible between the two fetches.
 */
async function waitForExamText(text: string) {
  await waitFor(
    () => {
      expect(screen.getByText(text)).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
}

async function waitForNoExams() {
  await waitFor(
    () => {
      expect(screen.getByText('No exams found.')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockSetSearchParams.mockClear();
});

// ---------------------------------------------------------------------------
// 1. Context building with certification filters
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with certification filters', () => {
  it('passes all exam IDs when no filters are applied', async () => {
    setupApiMocks();
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const firstExam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(firstExam);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(allExams.map((e) => e.id));
  });

  it('passes only AWS exam IDs when certId filter is set to cert-aws', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-aws' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-aws-1', 'exam-aws-2']);
  });

  it('passes only GCP exam IDs when certId filter is set to cert-gcp', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('GCP Architect Mock');

    const exam = screen.getByText('GCP Architect Mock');
    fireEvent.click(exam);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-gcp-1', 'exam-gcp-2']);
  });

  it('passes only Azure exam IDs when certId filter is set to cert-azure', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-azure' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('Azure Solutions Mock');

    const exam = screen.getByText('Azure Solutions Mock');
    fireEvent.click(exam);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-azure-1']);
  });

  it('context IDs exclude exams from other certifications when certId filter is active', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-aws' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    const gcpIds = gcpExams.map((e) => e.id);
    const azureIds = azureExams.map((e) => e.id);

    gcpIds.forEach((id) => expect(ids).not.toContain(id));
    azureIds.forEach((id) => expect(ids).not.toContain(id));
  });

  it('the clicked exam ID is always present in the navigation context', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('GCP Topic Practice');

    const exam = screen.getByText('GCP Topic Practice');
    fireEvent.click(exam);

    const [clickedExam, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toContain(clickedExam.id);
    expect(clickedExam.id).toBe('exam-gcp-2');
  });
});

// ---------------------------------------------------------------------------
// 2. Context building with search terms
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with search terms', () => {
  it('passes only name-matching IDs when search term matches exam names', async () => {
    setupApiMocks();
    // "mock" matches: AWS Full Mock Exam, GCP Architect Mock, Azure Solutions Mock
    setUrlParams({ search: 'mock' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toContain('exam-aws-1');
    expect(ids).toContain('exam-gcp-1');
    expect(ids).toContain('exam-azure-1');
    expect(ids).not.toContain('exam-aws-2');
    expect(ids).not.toContain('exam-gcp-2');
  });

  it('passes only description-matching IDs when search term matches descriptions', async () => {
    setupApiMocks();
    // "short" matches only "Short AWS practice session" (exam-aws-2 description)
    setUrlParams({ search: 'short' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Quick Practice');

    const exam = screen.getByText('AWS Quick Practice');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-aws-2']);
  });

  it('search is case-insensitive for name matching', async () => {
    setupApiMocks();
    // "AWS" (uppercase) should match "AWS Full Mock Exam" and "AWS Quick Practice"
    setUrlParams({ search: 'AWS' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toContain('exam-aws-1');
    expect(ids).toContain('exam-aws-2');
    expect(ids).not.toContain('exam-gcp-1');
    expect(ids).not.toContain('exam-gcp-2');
    expect(ids).not.toContain('exam-azure-1');
  });

  it('search is case-insensitive for description matching', async () => {
    setupApiMocks();
    // "GCP" (uppercase) should match names/descriptions containing "GCP"
    setUrlParams({ search: 'GCP' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('GCP Architect Mock');

    const exam = screen.getByText('GCP Architect Mock');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toContain('exam-gcp-1');
    expect(ids).toContain('exam-gcp-2');
    expect(ids).not.toContain('exam-aws-1');
    expect(ids).not.toContain('exam-azure-1');
  });

  it('context contains only IDs matching the search term, not all IDs', async () => {
    setupApiMocks();
    // "topic" only matches "GCP Topic Practice" (name) and "Topic-based GCP practice" (description)
    setUrlParams({ search: 'topic' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('GCP Topic Practice');

    const exam = screen.getByText('GCP Topic Practice');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-gcp-2']);
    expect(ids.length).toBe(1);
  });

  it('context length equals the number of search-matching exams', async () => {
    setupApiMocks();
    // "practice" matches all exams (name or description contains "practice")
    setUrlParams({ search: 'practice' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    // All exams match "practice" in name or description
    expect(ids.length).toBe(allExams.length);
  });

  it('passes empty context when search term matches no exams', async () => {
    setupApiMocks();
    setUrlParams({ search: 'nonexistentterm12345' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForNoExams();

    expect(screen.getByText('No exams found.')).toBeInTheDocument();
    expect(onSelectExam).not.toHaveBeenCalled();
  });

  it('combines search and certId filter correctly', async () => {
    setupApiMocks();
    // search="mock" + certId="cert-aws" → only exam-aws-1 matches
    setUrlParams({ search: 'mock', certId: 'cert-aws' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-aws-1']);
  });
});

// ---------------------------------------------------------------------------
// 3. Context building with status filters
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with status filters', () => {
  it('passes only active exam IDs when status filter is set to active', async () => {
    setupApiMocks();
    setUrlParams({ status: 'active' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    const activeExamIds = allExams.filter((e) => e.isActive).map((e) => e.id);
    expect(ids).toEqual(activeExamIds);
    expect(ids).not.toContain('exam-aws-2'); // inactive exam excluded
  });

  it('passes only inactive exam IDs when status filter is set to inactive', async () => {
    setupApiMocks();
    setUrlParams({ status: 'inactive' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Quick Practice');

    const exam = screen.getByText('AWS Quick Practice');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-aws-2']);
  });

  it('combines status and certId filter correctly', async () => {
    setupApiMocks();
    // status="active" + certId="cert-aws" → only exam-aws-1 (exam-aws-2 is inactive)
    setUrlParams({ status: 'active', certId: 'cert-aws' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(['exam-aws-1']);
  });
});

// ---------------------------------------------------------------------------
// 4. Context building edge cases
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building edge cases', () => {
  it('passes a single-element ID array when only one exam matches filters', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-azure' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('Azure Solutions Mock');

    const exam = screen.getByText('Azure Solutions Mock');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('exam-azure-1');
  });

  it('passes correct IDs when edit button is clicked (openEdit=true)', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('GCP Architect Mock');

    // The edit button (pencil icon) is a small square button with p-2 and bg-indigo-50
    // It's inside an exam row, distinct from the cert badge button (which has px-2 py-0.5)
    const allButtons = screen.getAllByRole('button');
    // Edit buttons have p-2 class (square icon buttons), cert badge has px-2 py-0.5
    const editButtons = allButtons.filter(
      (btn) =>
        btn.className.includes('bg-indigo-50') &&
        btn.className.includes('text-indigo-600') &&
        btn.className.includes('rounded-lg'), // pencil buttons have rounded-lg, badge has rounded
    );
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [, openEdit, ids] = onSelectExam.mock.calls[0];
    expect(openEdit).toBe(true);
    expect(ids).toEqual(['exam-gcp-1', 'exam-gcp-2']);
  });

  it('context IDs include all filtered exams across all pages', async () => {
    // Create 15 exams for a single cert to test pagination
    const manyExams = Array.from({ length: 15 }, (_, i) => ({
      id: `exam-aws-many-${i + 1}`,
      name: `AWS Exam ${i + 1}`,
      description: `Description ${i + 1}`,
      duration: 120,
      totalQuestions: 50,
      passingScore: 70,
      questionSelectionStrategy: 'random',
      isActive: true,
      _certTitle: 'AWS Solutions Architect',
      _certId: 'cert-aws',
    }));

    (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(allCertifications);
    (apiClient.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/certifications/cert-aws/exams')) return Promise.resolve(manyExams);
      if (url.includes('/certifications/cert-gcp/exams')) return Promise.resolve([]);
      if (url.includes('/certifications/cert-azure/exams')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    setUrlParams({ certId: 'cert-aws' });
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Exam 1');

    // Click the first exam (on page 1)
    const firstExam = screen.getByText('AWS Exam 1');
    fireEvent.click(firstExam);

    const [, , ids] = onSelectExam.mock.calls[0];
    // All 15 IDs should be in the context, not just the current page
    expect(ids).toHaveLength(15);
    manyExams.forEach((e) => expect(ids).toContain(e.id));
  });

  it('passes the correct exam object as the first argument to onSelectExam', async () => {
    setupApiMocks();
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('GCP Architect Mock');

    const exam = screen.getByText('GCP Architect Mock');
    fireEvent.click(exam);

    expect(onSelectExam).toHaveBeenCalledOnce();
    const [clickedExam] = onSelectExam.mock.calls[0];
    expect(clickedExam.id).toBe('exam-gcp-1');
    expect(clickedExam.name).toBe('GCP Architect Mock');
    expect(clickedExam._certId).toBe('cert-gcp');
  });

  it('context IDs are unique (no duplicates)', async () => {
    setupApiMocks();
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const exam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(exam);

    const [, , ids] = onSelectExam.mock.calls[0];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('preserves the order of exams as returned by the API', async () => {
    setupApiMocks();
    const onSelectExam = vi.fn();
    renderPanel(onSelectExam);

    await waitForExamText('AWS Full Mock Exam');

    const firstExam = screen.getByText('AWS Full Mock Exam');
    fireEvent.click(firstExam);

    const [, , ids] = onSelectExam.mock.calls[0];
    expect(ids).toEqual(allExams.map((e) => e.id));
  });
});
