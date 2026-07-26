/**
 * Unit Tests for SubTopicsPanel - Navigation Context Building
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 2.1, 7.1
 *
 * Tests:
 * - Context building with topic filters (topicId filter)
 * - Context building with certification filters (certId filter)
 * - Context building with search terms (title match, description match)
 * - Context building with combined filters
 * - Context building edge cases (single match, all IDs included across pages)
 *
 * Strategy: The navigation context is built by `buildNavigationContextAndNavigate`
 * inside SubTopicsPanel, which calls `onSelectSubTopic(subtopic, openEdit, ids)` where
 * `ids` is derived from the `filtered` array. We render the component with mocked
 * data and verify the IDs passed to `onSelectSubTopic` match the expected filtered set.
 *
 * Note: In SubTopicsPanel, `search` is local component state (not a URL param),
 * while `certId` and `topicId` are URL params. Tests use userEvent to type into
 * the search box.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SubTopicsPanel from './SubTopicsPanel';
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
];

// Topics for AWS cert
const awsTopics = [
  {
    id: 'topic-aws-iam',
    title: 'Identity & Access Management',
    description: 'IAM users, roles, and policies',
    orderIndex: 1,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'topic-aws-compute',
    title: 'Compute Services',
    description: 'EC2, Lambda, and container services',
    orderIndex: 2,
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
];

// Topics for GCP cert
const gcpTopics = [
  {
    id: 'topic-gcp-identity',
    title: 'Cloud Identity',
    description: 'GCP identity and access management',
    orderIndex: 1,
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-gcp',
  },
];



// Subtopics under topic-aws-iam
const iamSubtopics = [
  {
    id: 'sub-iam-1',
    title: 'IAM Users',
    description: 'Managing IAM user accounts',
    orderIndex: 1,
    isActive: true,
    _topicTitle: 'Identity & Access Management',
    _topicId: 'topic-aws-iam',
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'sub-iam-2',
    title: 'IAM Roles',
    description: 'Cross-account role delegation',
    orderIndex: 2,
    isActive: true,
    _topicTitle: 'Identity & Access Management',
    _topicId: 'topic-aws-iam',
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'sub-iam-3',
    title: 'IAM Policies',
    description: 'Permission policy documents',
    orderIndex: 3,
    isActive: false,
    _topicTitle: 'Identity & Access Management',
    _topicId: 'topic-aws-iam',
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
];

// Subtopics under topic-aws-compute
const computeSubtopics = [
  {
    id: 'sub-compute-1',
    title: 'EC2 Instances',
    description: 'Virtual machine configuration and types',
    orderIndex: 1,
    isActive: true,
    _topicTitle: 'Compute Services',
    _topicId: 'topic-aws-compute',
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
  {
    id: 'sub-compute-2',
    title: 'Lambda Functions',
    description: 'Serverless compute with AWS Lambda',
    orderIndex: 2,
    isActive: true,
    _topicTitle: 'Compute Services',
    _topicId: 'topic-aws-compute',
    _certTitle: 'AWS Solutions Architect',
    _certId: 'cert-aws',
  },
];

// Subtopics under topic-gcp-identity
const gcpIdentitySubtopics = [
  {
    id: 'sub-gcp-1',
    title: 'Service Accounts',
    description: 'GCP service account management',
    orderIndex: 1,
    isActive: true,
    _topicTitle: 'Cloud Identity',
    _topicId: 'topic-gcp-identity',
    _certTitle: 'GCP Professional Cloud Architect',
    _certId: 'cert-gcp',
  },
];

const allSubtopics = [...iamSubtopics, ...computeSubtopics, ...gcpIdentitySubtopics];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupApiMocks() {
  (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(allCertifications);

  (apiClient.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    // Topics per cert
    if (url.includes('/certifications/cert-aws/topics')) {
      return Promise.resolve(awsTopics.map((t) => ({ ...t })));
    }
    if (url.includes('/certifications/cert-gcp/topics')) {
      return Promise.resolve(gcpTopics.map((t) => ({ ...t })));
    }
    // Subtopics per topic
    if (url.includes('/topics/topic-aws-iam/subtopics')) {
      return Promise.resolve(iamSubtopics.map((s) => ({ ...s })));
    }
    if (url.includes('/topics/topic-aws-compute/subtopics')) {
      return Promise.resolve(computeSubtopics.map((s) => ({ ...s })));
    }
    if (url.includes('/topics/topic-gcp-identity/subtopics')) {
      return Promise.resolve(gcpIdentitySubtopics.map((s) => ({ ...s })));
    }
    return Promise.resolve([]);
  });
}

function setUrlParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

function renderPanel(onSelectSubTopic = vi.fn()) {
  return render(
    <MemoryRouter>
      <SubTopicsPanel onSelectSubTopic={onSelectSubTopic} />
    </MemoryRouter>,
  );
}

async function waitForSubtopicText(text: string) {
  await waitFor(
    () => {
      expect(screen.getByText(text)).toBeInTheDocument();
    },
    { timeout: 10000 },
  );
}

async function waitForNoSubtopics() {
  await waitFor(
    () => {
      expect(screen.getByText('No sub topics found.')).toBeInTheDocument();
    },
    { timeout: 10000 },
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
// 1. Context building with topic filters
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with topic filters', () => {
  it('passes all subtopic IDs when no filters are applied', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const firstSubtopic = screen.getByText('IAM Users');
    fireEvent.click(firstSubtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(allSubtopics.map((s) => s.id));
  });

  it('passes only IAM subtopic IDs when topicId filter is set to topic-aws-iam', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-aws-iam' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-iam-1', 'sub-iam-2', 'sub-iam-3']);
  });

  it('passes only Compute subtopic IDs when topicId filter is set to topic-aws-compute', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-aws-compute' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('EC2 Instances');

    const subtopic = screen.getByText('EC2 Instances');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-compute-1', 'sub-compute-2']);
  });

  it('passes only GCP subtopic IDs when topicId filter is set to topic-gcp-identity', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-gcp-identity' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('Service Accounts');

    const subtopic = screen.getByText('Service Accounts');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-gcp-1']);
  });

  it('context IDs exclude subtopics from other topics when topicId filter is active', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-aws-iam' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    const computeIds = computeSubtopics.map((s) => s.id);
    const gcpIds = gcpIdentitySubtopics.map((s) => s.id);

    computeIds.forEach((id) => expect(ids).not.toContain(id));
    gcpIds.forEach((id) => expect(ids).not.toContain(id));
  });

  it('the clicked subtopic ID is always present in the navigation context', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-aws-iam' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Roles');

    const subtopic = screen.getByText('IAM Roles');
    fireEvent.click(subtopic);

    const [clickedSubtopic, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toContain(clickedSubtopic.id);
    expect(clickedSubtopic.id).toBe('sub-iam-2');
  });

  it('passes correct IDs when edit button is clicked (openEdit=true)', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-aws-iam' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const allButtons = screen.getAllByRole('button');
    const editButtons = allButtons.filter(
      (btn) =>
        btn.className.includes('bg-indigo-50') &&
        btn.className.includes('text-indigo-600') &&
        btn.className.includes('rounded-lg'),
    );
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, openEdit, ids] = onSelectSubTopic.mock.calls[0];
    expect(openEdit).toBe(true);
    expect(ids).toEqual(['sub-iam-1', 'sub-iam-2', 'sub-iam-3']);
  });
});

// ---------------------------------------------------------------------------
// 2. Context building with certification filters
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with certification filters', () => {
  it('passes only AWS subtopic IDs when certId filter is set to cert-aws', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-aws' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    const awsSubtopicIds = [...iamSubtopics, ...computeSubtopics].map((s) => s.id);
    expect(ids).toEqual(awsSubtopicIds);
  });

  it('passes only GCP subtopic IDs when certId filter is set to cert-gcp', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-gcp' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('Service Accounts');

    const subtopic = screen.getByText('Service Accounts');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-gcp-1']);
  });

  it('context IDs exclude subtopics from other certifications when certId filter is active', async () => {
    setupApiMocks();
    setUrlParams({ certId: 'cert-aws' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    gcpIdentitySubtopics.forEach((s) => expect(ids).not.toContain(s.id));
  });

  it('combines certId and topicId filters correctly', async () => {
    setupApiMocks();
    // certId="cert-aws" + topicId="topic-aws-compute" → only compute subtopics
    setUrlParams({ certId: 'cert-aws', topicId: 'topic-aws-compute' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('EC2 Instances');

    const subtopic = screen.getByText('EC2 Instances');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-compute-1', 'sub-compute-2']);
  });
});

// ---------------------------------------------------------------------------
// 3. Context building with search terms
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building with search terms', () => {
  it('passes only title-matching IDs when search term matches subtopic titles', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    // "IAM" matches IAM Users, IAM Roles, IAM Policies (all by title)
    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'IAM');

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toContain('sub-iam-1');
    expect(ids).toContain('sub-iam-2');
    expect(ids).toContain('sub-iam-3');
    expect(ids).not.toContain('sub-compute-1');
    expect(ids).not.toContain('sub-compute-2');
    expect(ids).not.toContain('sub-gcp-1');
  });

  it('passes only description-matching IDs when search term matches descriptions', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    // "serverless" only matches "Serverless compute with AWS Lambda" (sub-compute-2 description)
    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'serverless');

    await waitForSubtopicText('Lambda Functions');

    const subtopic = screen.getByText('Lambda Functions');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-compute-2']);
  });

  it('search is case-insensitive for title matching', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    // "iam" (lowercase) should match "IAM Users", "IAM Roles", "IAM Policies"
    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'iam');

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toContain('sub-iam-1');
    expect(ids).toContain('sub-iam-2');
    expect(ids).toContain('sub-iam-3');
    expect(ids).not.toContain('sub-compute-1');
    expect(ids).not.toContain('sub-gcp-1');
  });

  it('search is case-insensitive for description matching', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    // "VIRTUAL MACHINE" (uppercase) matches "Virtual machine configuration and types" (sub-compute-1)
    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'VIRTUAL MACHINE');

    await waitForSubtopicText('EC2 Instances');

    const subtopic = screen.getByText('EC2 Instances');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-compute-1']);
  });

  it('context contains only IDs matching the search term, not all IDs', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    // "service account" only matches "Service Accounts" title and "GCP service account management" description
    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'service account');

    await waitForSubtopicText('Service Accounts');

    const subtopic = screen.getByText('Service Accounts');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-gcp-1']);
    expect(ids.length).toBe(1);
  });

  it('passes empty context when search term matches no subtopics', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'nonexistentterm12345');

    await waitForNoSubtopics();

    expect(screen.getByText('No sub topics found.')).toBeInTheDocument();
    expect(onSelectSubTopic).not.toHaveBeenCalled();
  });

  it('combines search and topicId filter correctly', async () => {
    setupApiMocks();
    // topicId="topic-aws-iam" + search="roles" → only sub-iam-2 matches
    setUrlParams({ topicId: 'topic-aws-iam' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'roles');

    await waitForSubtopicText('IAM Roles');

    const subtopic = screen.getByText('IAM Roles');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-iam-2']);
  });

  it('combines search and certId filter correctly', async () => {
    setupApiMocks();
    // certId="cert-aws" + search="lambda" → only sub-compute-2 matches
    setUrlParams({ certId: 'cert-aws' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const searchInput = screen.getByPlaceholderText('Search sub topics...');
    await userEvent.type(searchInput, 'lambda');

    await waitForSubtopicText('Lambda Functions');

    const subtopic = screen.getByText('Lambda Functions');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(['sub-compute-2']);
  });
});

// ---------------------------------------------------------------------------
// 4. Context building edge cases
// Validates: Requirements 2.1, 7.1
// ---------------------------------------------------------------------------

describe('Context building edge cases', () => {
  it('passes a single-element ID array when only one subtopic matches filters', async () => {
    setupApiMocks();
    setUrlParams({ topicId: 'topic-gcp-identity' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('Service Accounts');

    const subtopic = screen.getByText('Service Accounts');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('sub-gcp-1');
  });

  it('context IDs include all filtered subtopics across all pages', async () => {
    // Create 15 subtopics for a single topic to test pagination
    const manySubtopics = Array.from({ length: 15 }, (_, i) => ({
      id: `sub-iam-many-${i + 1}`,
      title: `IAM Subtopic ${i + 1}`,
      description: `Description for subtopic ${i + 1}`,
      orderIndex: i + 1,
      isActive: true,
      _topicTitle: 'Identity & Access Management',
      _topicId: 'topic-aws-iam',
      _certTitle: 'AWS Solutions Architect',
      _certId: 'cert-aws',
    }));

    (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(allCertifications);
    (apiClient.fetchApi as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/certifications/cert-aws/topics'))
        return Promise.resolve(awsTopics.map((t) => ({ ...t })));
      if (url.includes('/certifications/cert-gcp/topics')) return Promise.resolve([]);
      if (url.includes('/topics/topic-aws-iam/subtopics')) return Promise.resolve(manySubtopics);
      if (url.includes('/topics/topic-aws-compute/subtopics')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    setUrlParams({ topicId: 'topic-aws-iam' });
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Subtopic 1');

    // Click the first subtopic (on page 1)
    const firstSubtopic = screen.getByText('IAM Subtopic 1');
    fireEvent.click(firstSubtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    // All 15 IDs should be in the context, not just the current page
    expect(ids).toHaveLength(15);
    manySubtopics.forEach((s) => expect(ids).toContain(s.id));
  });

  it('passes the correct subtopic object as the first argument to onSelectSubTopic', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('EC2 Instances');

    const subtopic = screen.getByText('EC2 Instances');
    fireEvent.click(subtopic);

    expect(onSelectSubTopic).toHaveBeenCalledOnce();
    const [clickedSubtopic] = onSelectSubTopic.mock.calls[0];
    expect(clickedSubtopic.id).toBe('sub-compute-1');
    expect(clickedSubtopic.title).toBe('EC2 Instances');
    expect(clickedSubtopic._topicId).toBe('topic-aws-compute');
    expect(clickedSubtopic._certId).toBe('cert-aws');
  });

  it('context IDs are unique (no duplicates)', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('preserves the order of subtopics as returned by the API', async () => {
    setupApiMocks();
    const onSelectSubTopic = vi.fn();
    renderPanel(onSelectSubTopic);

    await waitForSubtopicText('IAM Users');

    const subtopic = screen.getByText('IAM Users');
    fireEvent.click(subtopic);

    const [, , ids] = onSelectSubTopic.mock.calls[0];
    expect(ids).toEqual(allSubtopics.map((s) => s.id));
  });
});
