import { describe, it, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { API_BASE_URL } from '../constants/api';

// Feature: enterprise-structure, Property 3: fetchApi sends credentials and correct URL
// Validates: Requirements 4.1

describe('fetchApi cookie-based auth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('property: fetchApi always sends credentials:include so the httpOnly cookie is attached', async () => {
    const { fetchApi } = await import('./client');

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).map((s) => '/' + s.replace(/[^a-z0-9/]/gi, 'x')),
        async (endpoint) => {
          let capturedInit: RequestInit | undefined;

          vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, init?: RequestInit) => {
              capturedInit = init;
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
              } as Response);
            }),
          );

          await fetchApi(endpoint);

          return capturedInit?.credentials === 'include';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: fetchApi does not attach an Authorization header (token is in cookie)', async () => {
    const { fetchApi } = await import('./client');

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).map((s) => '/' + s.replace(/[^a-z0-9/]/gi, 'x')),
        async (endpoint) => {
          let capturedHeaders: Record<string, string> = {};

          vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, init?: RequestInit) => {
              capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
              } as Response);
            }),
          );

          await fetchApi(endpoint);

          return !('Authorization' in capturedHeaders);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: fetchApi calls the correct URL composed of API_BASE_URL + endpoint', async () => {
    const { fetchApi } = await import('./client');

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).map((s) => '/' + s.replace(/[^a-z0-9/]/gi, 'x')),
        async (endpoint) => {
          let capturedUrl = '';

          vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
              capturedUrl = url;
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
              } as Response);
            }),
          );

          await fetchApi(endpoint);

          return capturedUrl === `${API_BASE_URL}${endpoint}`;
        },
      ),
      { numRuns: 100 },
    );
  });
});
