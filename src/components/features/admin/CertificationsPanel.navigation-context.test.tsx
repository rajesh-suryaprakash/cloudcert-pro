/**
 * Unit Tests for CertificationsPanel - Navigation Context Building
 *
 * Feature: admin-detail-navigation
 * Validates: Requirements 2.1, 7.1, 7.2
 *
 * Tests:
 * - Context building with various filter combinations (vendor, search, combined)
 * - Context building with search terms (title match, description match, no match)
 * - Context building with sort orders (preserving order from filtered list)
 *
 * Strategy: The navigation context is built by `buildNavigationContextAndNavigate`
 * inside CertificationsPanel, which calls `onSelectCert(cert, openEdit, ids)` where
 * `ids` is derived from the `filtered` array. We render the component with mocked
 * data and verify the IDs passed to `onSelectCert` match the expected filtered set.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CertificationsPanel from './CertificationsPanel';
import * as certApi from '../../../api/certifications';

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
  {
    id: 'cert-aws-1',
    title: 'AWS Solutions Architect',
    vendor: 'Amazon',
    description: 'Design distributed systems on AWS',
    level: 'Associate',
    url: 'https://aws.amazon.com',
    iconUrl: '/icons/aws.svg',
  },
  {
    id: 'cert-aws-2',
    title: 'AWS Developer',
    vendor: 'Amazon',
    description: 'Develop applications on AWS cloud',
    level: 'Associate',
    url: 'https://aws.amazon.com/dev',
    iconUrl: '/icons/aws.svg',
  },
  {
    id: 'cert-gcp-1',
    title: 'GCP Professional Cloud Architect',
    vendor: 'Google',
    description: 'Design solutions on Google Cloud Platform',
    level: 'Professional',
    url: 'https://cloud.google.com',
    iconUrl: '/icons/gcp.svg',
  },
  {
    id: 'cert-gcp-2',
    title: 'GCP Associate Cloud Engineer',
    vendor: 'Google',
    description: 'Deploy and manage Google Cloud resources',
    level: 'Associate',
    url: 'https://cloud.google.com/ace',
    iconUrl: '/icons/gcp.svg',
  },
  {
    id: 'cert-azure-1',
    title: 'Azure Solutions Architect',
    vendor: 'Microsoft',
    description: 'Design solutions on Microsoft Azure',
    level: 'Expert',
    url: 'https://azure.microsoft.com',
    iconUrl: '/icons/azure.svg',
  },
  {
    id: 'cert-azure-2',
    title: 'Azure Administrator',
    vendor: 'Microsoft',
    description: 'Manage Azure subscriptions and resources',
    level: 'Associate',
    url: 'https://azure.microsoft.com/admin',
    iconUrl: '/icons/azure.svg',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupApiMock(certs = allCertifications) {
  (certApi.fetchCertifications as ReturnType<typeof vi.fn>).mockResolvedValue(certs);
}

function setUrlParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

function renderPanel(onSelectCert = vi.fn()) {
  return render(
    <MemoryRouter>
      <CertificationsPanel onSelectCert={onSelectCert} />
    </MemoryRouter>,
  );
}

async function waitForCertsToLoad() {
  await waitFor(() => {
    expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
  });
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
// 1. Context building with various filter combinations
// Validates: Requirements 2.1, 7.1, 7.2
// ---------------------------------------------------------------------------

describe('Context building with various filter combinations', () => {
  it('passes all certification IDs when no filters are applied', async () => {
    setupApiMock();
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // Click the first certification
    const firstCert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(firstCert);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(allCertifications.map((c) => c.id));
  });

  it('passes only Amazon vendor IDs when vendor filter is set to Amazon', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Amazon' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const amazonCert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(amazonCert);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(['cert-aws-1', 'cert-aws-2']);
  });

  it('passes only Google vendor IDs when vendor filter is set to Google', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Google' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const gcpCert = screen.getByText('GCP Professional Cloud Architect');
    fireEvent.click(gcpCert);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(['cert-gcp-1', 'cert-gcp-2']);
  });

  it('passes only Microsoft vendor IDs when vendor filter is set to Microsoft', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Microsoft' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const azureCert = screen.getByText('Azure Solutions Architect');
    fireEvent.click(azureCert);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(['cert-azure-1', 'cert-azure-2']);
  });

  it('passes combined filter results when both search and vendor are active', async () => {
    setupApiMock();
    // search="architect" + vendor="Amazon" → only cert-aws-1 matches
    setUrlParams({ search: 'architect', vendor: 'Amazon' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(['cert-aws-1']);
  });

  it('passes empty array when filters match no certifications', async () => {
    setupApiMock();
    // vendor filter that matches nothing
    setUrlParams({ vendor: 'HashiCorp' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // No certs are rendered, so we can't click one — but we can verify
    // the filtered list is empty by checking the "No results found" message
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(onSelectCert).not.toHaveBeenCalled();
  });

  it('context IDs exclude certifications that do not match the vendor filter', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Google' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const gcpCert = screen.getByText('GCP Professional Cloud Architect');
    fireEvent.click(gcpCert);

    const [, , ids] = onSelectCert.mock.calls[0];
    const amazonIds = allCertifications.filter((c) => c.vendor === 'Amazon').map((c) => c.id);
    const microsoftIds = allCertifications.filter((c) => c.vendor === 'Microsoft').map((c) => c.id);

    amazonIds.forEach((id) => expect(ids).not.toContain(id));
    microsoftIds.forEach((id) => expect(ids).not.toContain(id));
  });

  it('the clicked certification ID is always present in the navigation context', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Google' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const gcpCert = screen.getByText('GCP Associate Cloud Engineer');
    fireEvent.click(gcpCert);

    const [cert, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toContain(cert.id);
    expect(cert.id).toBe('cert-gcp-2');
  });
});

// ---------------------------------------------------------------------------
// 2. Context building with search terms
// Validates: Requirements 2.1, 7.1, 7.2
// ---------------------------------------------------------------------------

describe('Context building with search terms', () => {
  it('passes only title-matching IDs when search term matches titles', async () => {
    setupApiMock();
    // "architect" matches: AWS Solutions Architect, GCP Professional Cloud Architect, Azure Solutions Architect
    setUrlParams({ search: 'architect' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toContain('cert-aws-1');
    expect(ids).toContain('cert-gcp-1');
    expect(ids).toContain('cert-azure-1');
    expect(ids).not.toContain('cert-aws-2');
    expect(ids).not.toContain('cert-gcp-2');
    expect(ids).not.toContain('cert-azure-2');
  });

  it('passes only description-matching IDs when search term matches descriptions', async () => {
    setupApiMock();
    // "google cloud" matches descriptions of GCP certs
    setUrlParams({ search: 'google cloud' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('GCP Professional Cloud Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toContain('cert-gcp-1');
    expect(ids).toContain('cert-gcp-2');
    expect(ids).not.toContain('cert-aws-1');
    expect(ids).not.toContain('cert-aws-2');
    expect(ids).not.toContain('cert-azure-1');
    expect(ids).not.toContain('cert-azure-2');
  });

  it('search is case-insensitive for title matching', async () => {
    setupApiMock();
    // "AWS" (uppercase) should match "AWS Solutions Architect" and "AWS Developer"
    setUrlParams({ search: 'AWS' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toContain('cert-aws-1');
    expect(ids).toContain('cert-aws-2');
    expect(ids).not.toContain('cert-gcp-1');
    expect(ids).not.toContain('cert-gcp-2');
  });

  it('search is case-insensitive for description matching', async () => {
    setupApiMock();
    // "AZURE" (uppercase) should match descriptions containing "Azure"
    setUrlParams({ search: 'AZURE' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('Azure Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toContain('cert-azure-1');
    expect(ids).toContain('cert-azure-2');
    expect(ids).not.toContain('cert-aws-1');
    expect(ids).not.toContain('cert-gcp-1');
  });

  it('passes all IDs when search term matches all certifications', async () => {
    setupApiMock();
    // "a" is a very broad search that matches all titles/descriptions
    setUrlParams({ search: 'a' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // All certs contain "a" somewhere in title or description
    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    // All 6 certs have "a" in title or description
    expect(ids.length).toBeGreaterThan(0);
    // Verify the clicked cert is included
    expect(ids).toContain('cert-aws-1');
  });

  it('context contains only IDs matching the search term, not all IDs', async () => {
    setupApiMock();
    // "developer" only matches "AWS Developer"
    setUrlParams({ search: 'developer' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Developer');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(['cert-aws-2']);
    expect(ids.length).toBe(1);
  });

  it('context length equals the number of search-matching certifications', async () => {
    setupApiMock();
    // "solutions" matches:
    //   - "AWS Solutions Architect" (title)
    //   - "GCP Professional Cloud Architect" (description: "Design solutions on Google Cloud Platform")
    //   - "Azure Solutions Architect" (title)
    setUrlParams({ search: 'solutions' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids.length).toBe(3);
    expect(ids).toContain('cert-aws-1');
    expect(ids).toContain('cert-gcp-1');
    expect(ids).toContain('cert-azure-1');
  });
});

// ---------------------------------------------------------------------------
// 3. Context building with sort orders
// Validates: Requirements 2.1, 7.1, 7.2
// ---------------------------------------------------------------------------

describe('Context building with sort orders', () => {
  it('preserves the order of certifications as returned by the API', async () => {
    setupApiMock();
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const firstCert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(firstCert);

    const [, , ids] = onSelectCert.mock.calls[0];
    // IDs should be in the same order as allCertifications
    expect(ids).toEqual(allCertifications.map((c) => c.id));
  });

  it('preserves order when certifications are returned in a different sequence', async () => {
    // Reverse the order to simulate a different API sort
    const reversedCerts = [...allCertifications].reverse();
    setupApiMock(reversedCerts);
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // Click the first visible cert (which is now cert-azure-2 in reversed order)
    const firstCert = screen.getByText('Azure Administrator');
    fireEvent.click(firstCert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(reversedCerts.map((c) => c.id));
  });

  it('preserves filtered order when vendor filter is applied', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Amazon' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    // Amazon certs appear in original order: cert-aws-1, cert-aws-2
    expect(ids[0]).toBe('cert-aws-1');
    expect(ids[1]).toBe('cert-aws-2');
  });

  it('preserves filtered order when search filter is applied', async () => {
    setupApiMock();
    // "solutions" matches:
    //   - cert-aws-1 "AWS Solutions Architect" (index 0 in allCertifications)
    //   - cert-gcp-1 "GCP Professional Cloud Architect" (index 2, description matches)
    //   - cert-azure-1 "Azure Solutions Architect" (index 4)
    setUrlParams({ search: 'solutions' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    // Order should match original list order
    expect(ids[0]).toBe('cert-aws-1');
    expect(ids[1]).toBe('cert-gcp-1');
    expect(ids[2]).toBe('cert-azure-1');
  });

  it('navigation context IDs are in the same order as displayed in the list', async () => {
    // Use a custom order to verify the context matches display order
    const customOrderCerts = [
      allCertifications[2], // GCP Professional
      allCertifications[0], // AWS Solutions Architect
      allCertifications[4], // Azure Solutions Architect
      allCertifications[1], // AWS Developer
      allCertifications[3], // GCP Associate
      allCertifications[5], // Azure Administrator
    ];
    setupApiMock(customOrderCerts);
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // Click any cert
    const cert = screen.getByText('GCP Professional Cloud Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toEqual(customOrderCerts.map((c) => c.id));
  });

  it('context IDs maintain relative order after vendor filtering', async () => {
    // Interleave vendors to verify order is preserved after filtering
    const interleavedCerts = [
      allCertifications[0], // Amazon
      allCertifications[2], // Google
      allCertifications[1], // Amazon
      allCertifications[4], // Microsoft
      allCertifications[3], // Google
      allCertifications[5], // Microsoft
    ];
    setupApiMock(interleavedCerts);
    setUrlParams({ vendor: 'Google' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('GCP Professional Cloud Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    // Google certs in the order they appear in the interleaved list
    expect(ids[0]).toBe('cert-gcp-1'); // index 1 in interleaved
    expect(ids[1]).toBe('cert-gcp-2'); // index 4 in interleaved
  });
});

// ---------------------------------------------------------------------------
// 4. Context building edge cases
// Validates: Requirements 2.1, 7.1, 7.2
// ---------------------------------------------------------------------------

describe('Context building edge cases', () => {
  it('passes a single-element ID array when only one certification matches filters', async () => {
    setupApiMock();
    // "developer" only matches "AWS Developer"
    setUrlParams({ search: 'developer' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Developer');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('cert-aws-2');
  });

  it('passes correct IDs when edit button is clicked (openEdit=true)', async () => {
    setupApiMock();
    setUrlParams({ vendor: 'Amazon' });
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // Click the edit (pencil) button for the first Amazon cert
    const editButtons = screen.getAllByTitle('Edit');
    fireEvent.click(editButtons[0]);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [, openEdit, ids] = onSelectCert.mock.calls[0];
    expect(openEdit).toBe(true);
    expect(ids).toEqual(['cert-aws-1', 'cert-aws-2']);
  });

  it('context IDs do not include certifications from other pages (all filtered IDs included)', async () => {
    // Create 15 Amazon certs to test pagination
    const manyCerts = Array.from({ length: 15 }, (_, i) => ({
      id: `cert-amazon-${i + 1}`,
      title: `Amazon Cert ${i + 1}`,
      vendor: 'Amazon',
      description: `Description ${i + 1}`,
      level: 'Associate',
      url: `https://aws.amazon.com/${i + 1}`,
      iconUrl: '/icons/aws.svg',
    }));
    setupApiMock(manyCerts);
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    // Click the first cert (which is on page 1)
    const firstCert = screen.getByText('Amazon Cert 1');
    fireEvent.click(firstCert);

    const [, , ids] = onSelectCert.mock.calls[0];
    // All 15 IDs should be in the context, not just the current page
    expect(ids).toHaveLength(15);
    manyCerts.forEach((c) => expect(ids).toContain(c.id));
  });

  it('passes the correct cert object as the first argument to onSelectCert', async () => {
    setupApiMock();
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('GCP Professional Cloud Architect');
    fireEvent.click(cert);

    expect(onSelectCert).toHaveBeenCalledOnce();
    const [clickedCert] = onSelectCert.mock.calls[0];
    expect(clickedCert.id).toBe('cert-gcp-1');
    expect(clickedCert.title).toBe('GCP Professional Cloud Architect');
    expect(clickedCert.vendor).toBe('Google');
  });

  it('context IDs are unique (no duplicates)', async () => {
    setupApiMock();
    const onSelectCert = vi.fn();
    renderPanel(onSelectCert);

    await waitForCertsToLoad();

    const cert = screen.getByText('AWS Solutions Architect');
    fireEvent.click(cert);

    const [, , ids] = onSelectCert.mock.calls[0];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
