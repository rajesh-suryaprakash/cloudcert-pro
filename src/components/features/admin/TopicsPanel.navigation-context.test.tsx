/**
 * Unit Tests for TopicsPanel - Navigation Context Building
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 2.1, 7.1
 *
 * Tests:
 * - Context building with exam (certId) filters
 * - Context building with search terms (title match, description match)
 * - Context building edge cases (single match, all IDs included across pages)
 *
 * Strategy: The navigation context is built by `buildNavigationContextAndNavigate`
 * inside TopicsPanel, which calls `onSelectTopic(topic, openEdit, ids)` where
 * `ids` is derived from the `filtered` array. We render the component with mocked
 * data and verify the IDs passed to `onSelectTopic` match the expected filtered set.
 *
 * Note: In TopicsPanel, `search` is local component state (not a URL param),
 * while `certId` is a URL param. Tests use userEvent to type into the search box.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TopicsPanel from './TopicsPanel';
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

const awsTopics = [
  {
    id: 'topic-aws-1',
    title: 'Identity & Access Management',
    description: 'IAM users, roles, and policies',
    orderIndex: 1,
    weightPercentage: 20,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'topic-aws-2',
    title: 'Compute Services',
    description: 'EC2, Lambda, and container services',
    orderIndex: 2,
    weightPercentage: 25,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'topic-aws-3',
    title: 'Storage Solutions',
    description: 'S3, EBS, and EFS storage options',
    orderIndex: 3,
    weightPercentage: 15,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
];

const gcpTopics = [
  {
    id: 'topic-gcp-1',
    title: 'Cloud Identity',
    description: 'GCP identity and access management',
    orderIndex: 1,
    weightPercentage: 20,
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-gcp',
  },
  {
    id: 'topic-gcp-2',
    title: 'Compute Engine',
    description: 'Virtual machines and compute resources',
    orderIndex: 2,
    weightPercentage: 30,
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-gcp',
  },
];

const azureTopics = [
  {
    id: 'topic-azure-1',
    title: 'Azure Active Directory',
    description: 'Azure AD identity services',
    orderIndex: 1,
    weightPercentage: 25,
    _certTitle: 'Azure Solutions Architect',
    _certId: 'cert-azure',
  },
];

const allTopics = [...awsTopics, ...gcpTopics, ...azureTopics];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupApiMocks() {
  (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(allCertifications);

  (apiClient.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/certifications/cert-aws/topics'))
      return Promise.resolve(awsTopics.map((t) => ({ ...t })));
    if (url.includes('/certifications/cert-gcp/topics'))
      return Promise.resolve(gcpTopics.map((t) => ({ ...t })));
    if (url.includes('/certifications/cert-azure/topics'))
      return Promise.resolve(azureTopics.map((t) => ({ ...t })));
    return Promise.resolve([]);
  });
}

function setUrlParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

function renderPanel(onSelectTopic = vi.fn()) {
  return render(
    <MemoryRouter>
      <TopicsPanel onSelectTopic={onSelectTopic} />
    </MemoryRouter>,
  );
}

async function waitForTopicText(text: string) {
  await waitFor(
    () => {
      expect(screen.getByText(text)).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
}

async function waitForNoTopics() {
  await waitFor(
    () => {
      expect(screen.getByText('No topics found.')).toBeInTheDocument();
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
// 1. Context building with exam (certId) filters
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with exam filters', () => {
  it('passes all topic IDs when no certId filter is applied', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const firstTopic = screen.getByText('Identity & Access Management');
    fireEvent.click(firstTopic);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(allTopics.map((t) => t.id));
  });

  it('passes only AWS topic IDs when certId filter is set to cert-aws', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-aws' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const topic = screen.getByText('Identity & Access Management');
    fireEvent.click(topic);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(['topic-aws-1', 'topic-aws-2', 'topic-aws-3']);
  });

  it('passes only GCP topic IDs when certId filter is set to cert-gcp', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Cloud Identity');

    const topic = screen.getByText('Cloud Identity');
    fireEvent.click(topic);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(['topic-gcp-1', 'topic-gcp-2']);
  });

  it('passes only Azure topic IDs when certId filter is set to cert-azure', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-azure' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Azure Active Directory');

    const topic = screen.getByText('Azure Active Directory');
    fireEvent.click(topic);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(['topic-azure-1']);
  });

  it('context IDs exclude topics from other certifications when certId filter is active', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-aws' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const topic = screen.getByText('Identity & Access Management');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    const gcpIds = gcpTopics.map((t) => t.id);
    const azureIds = azureTopics.map((t) => t.id);

    gcpIds.forEach((id) => expect(ids).not.toContain(id));
    azureIds.forEach((id) => expect(ids).not.toContain(id));
  });

  it('the clicked topic ID is always present in the navigation context', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Compute Engine');

    const topic = screen.getByText('Compute Engine');
    fireEvent.click(topic);

    const [clickedTopic, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toContain(clickedTopic.id);
    expect(clickedTopic.id).toBe('topic-gcp-2');
  });

  it('passes correct IDs when edit button is clicked (openEdit=true)', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Cloud Identity');

    // Edit buttons are square icon buttons with bg-indigo-50 and rounded-lg
    const allButtons = screen.getAllByRole('button');
    const editButtons = allButtons.filter(
      (btn) =>
        btn.className.includes('bg-indigo-50') &&
        btn.className.includes('text-indigo-600') &&
        btn.className.includes('rounded-lg'),
    );
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [, openEdit, ids] = onSelectTopic.mock.calls[0];
    expect(openEdit).toBe(true);
    expect(ids).toEqual(['topic-gcp-1', 'topic-gcp-2']);
  });
});

// ---------------------------------------------------------------------------
// 2. Context building with search terms
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with search terms', () => {
  it('passes only title-matching IDs when search term matches topic titles', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    // Type "compute" into the search box — matches "Compute Services" (aws-2) and "Compute Engine" (gcp-2)
    // No other topic title or description contains "compute"
    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'compute');

    await waitForTopicText('Compute Services');

    const topic = screen.getByText('Compute Services');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toContain('topic-aws-2'); // "Compute Services"
    expect(ids).toContain('topic-gcp-2'); // "Compute Engine"
    expect(ids).not.toContain('topic-aws-1');
    expect(ids).not.toContain('topic-aws-3');
    expect(ids).not.toContain('topic-gcp-1');
    expect(ids).not.toContain('topic-azure-1');
  });

  it('passes only description-matching IDs when search term matches descriptions', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    // "virtual machines" only matches topic-gcp-2 description
    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'virtual machines');

    await waitForTopicText('Compute Engine');

    const topic = screen.getByText('Compute Engine');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(['topic-gcp-2']);
  });

  it('search is case-insensitive for title matching', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    // "COMPUTE" (uppercase) should match "Compute Services" and "Compute Engine"
    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'COMPUTE');

    await waitForTopicText('Compute Services');

    const topic = screen.getByText('Compute Services');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toContain('topic-aws-2'); // "Compute Services"
    expect(ids).toContain('topic-gcp-2'); // "Compute Engine"
    expect(ids).not.toContain('topic-aws-1');
    expect(ids).not.toContain('topic-aws-3');
    expect(ids).not.toContain('topic-gcp-1');
    expect(ids).not.toContain('topic-azure-1');
  });

  it('search is case-insensitive for description matching', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    // "IAM" (uppercase) matches "IAM users, roles, and policies" description of topic-aws-1
    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'IAM');

    await waitForTopicText('Identity & Access Management');

    const topic = screen.getByText('Identity & Access Management');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toContain('topic-aws-1');
    expect(ids).not.toContain('topic-aws-2');
    expect(ids).not.toContain('topic-gcp-1');
  });

  it('context contains only IDs matching the search term, not all IDs', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    // "S3" only matches "S3, EBS, and EFS storage options" description of topic-aws-3
    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'S3');

    await waitForTopicText('Storage Solutions');

    const topic = screen.getByText('Storage Solutions');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(['topic-aws-3']);
    expect(ids.length).toBe(1);
  });

  it('passes empty context when search term matches no topics', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'nonexistentterm12345');

    await waitForNoTopics();

    expect(screen.getByText('No topics found.')).toBeInTheDocument();
    expect(onSelectTopic).not.toHaveBeenCalled();
  });

  it('combines search and certId filter correctly', async () => {
    setupApiMocks();
    // certId="cert-aws" + search="storage" → only topic-aws-3 matches
    setUrlParams({ certId: 'cert-aws' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const searchInput = screen.getByPlaceholderText('Search topics...');
    await userEvent.type(searchInput, 'storage');

    await waitForTopicText('Storage Solutions');

    const topic = screen.getByText('Storage Solutions');
    fireEvent.click(topic);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(['topic-aws-3']);
  });

  it('context IDs are unique (no duplicates)', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const topic = screen.getByText('Identity & Access Management');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('preserves the order of topics as returned by the API', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Identity & Access Management');

    const topic = screen.getByText('Identity & Access Management');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toEqual(allTopics.map((t) => t.id));
  });
});

// ---------------------------------------------------------------------------
// 3. Context building edge cases
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building edge cases', () => {
  it('passes a single-element ID array when only one topic matches filters', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-azure' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Azure Active Directory');

    const topic = screen.getByText('Azure Active Directory');
    fireEvent.click(topic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('topic-azure-1');
  });

  it('context IDs include all filtered topics across all pages', async () => {
    // Create 15 topics for a single cert to test pagination
    const manyTopics = Array.from({ length: 15 }, (_, i) => ({
      id: `topic-aws-many-${i + 1}`,
      title: `AWS Topic ${i + 1}`,
      description: `Description for topic ${i + 1}`,
      orderIndex: i + 1,
      weightPercentage: 5,
      _certTitle: 'AWS Solutions Architect',
      _certId: 'cert-aws',
    }));

    (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(allCertifications);
    (apiClient.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/certifications/cert-aws/topics')) return Promise.resolve(manyTopics);
      if (url.includes('/certifications/cert-gcp/topics')) return Promise.resolve([]);
      if (url.includes('/certifications/cert-azure/topics')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    setUrlParams({ certId: 'cert-aws' });
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('AWS Topic 1');

    // Click the first topic (on page 1)
    const firstTopic = screen.getByText('AWS Topic 1');
    fireEvent.click(firstTopic);

    const [, , ids] = onSelectTopic.mock.calls[0];
    // All 15 IDs should be in the context, not just the current page
    expect(ids).toHaveLength(15);
    manyTopics.forEach((t) => expect(ids).toContain(t.id));
  });

  it('passes the correct topic object as the first argument to onSelectTopic', async () => {
    setupApiMocks();
    const onSelectTopic = vi.fn();
    renderPanel(onSelectTopic);

    await waitForTopicText('Compute Engine');

    const topic = screen.getByText('Compute Engine');
    fireEvent.click(topic);

    expect(onSelectTopic).toHaveBeenCalledOnce();
    const [clickedTopic] = onSelectTopic.mock.calls[0];
    expect(clickedTopic.id).toBe('topic-gcp-2');
    expect(clickedTopic.title).toBe('Compute Engine');
    expect(clickedTopic._certId).toBe('cert-gcp');
  });
});
