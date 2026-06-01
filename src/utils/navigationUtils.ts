/**
 * Navigation utilities for admin detail views.
 * Handles encoding/decoding navigation context to/from URL query parameters.
 */

const STORAGE_KEY_PREFIX = 'admin-nav-context';
const STORAGE_EXPIRY_MS = 3600000; // 1 hour

/**
 * Performance measurement utilities
 */
export interface PerformanceMetrics {
  encodingTime: number;
  decodingTime: number;
  urlLength: number;
  usedSessionStorage: boolean;
}

let performanceMetrics: PerformanceMetrics | null = null;

/**
 * Gets the last recorded performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics | null {
  return performanceMetrics;
}

/**
 * Resets performance metrics
 */
export function resetPerformanceMetrics(): void {
  performanceMetrics = null;
}

export interface NavigationContext {
  ids: string[];
  currentId: string;
  filters?: Record<string, string>;
}

interface StoredNavigationContext extends NavigationContext {
  timestamp: number;
  expiresAt: number;
}

/**
 * Encodes navigation context to URL query parameters.
 * Always stores the full context in sessionStorage and returns only a short
 * navRef key in the URL, keeping URL length O(1) regardless of ID count.
 * Measures encoding performance for optimization tracking.
 */
export function encodeNavigationContext(
  context: NavigationContext,
  _baseUrl: string,
): URLSearchParams {
  const startTime = performance.now();

  // Always store in sessionStorage — sessionStorage is the primary store
  const storageKey = generateStorageKey(context.currentId);
  storeNavigationContext(storageKey, context);

  // Return only the short reference key and current ID — never ids or nav-prefixed filters
  const params = new URLSearchParams();
  params.set('navRef', storageKey);
  params.set('current', context.currentId);

  const endTime = performance.now();

  // Record performance metrics
  performanceMetrics = {
    encodingTime: endTime - startTime,
    decodingTime: 0,
    urlLength: params.toString().length,
    usedSessionStorage: true,
  };

  return params;
}

/**
 * Decodes navigation context from URL query parameters.
 * Handles both direct encoding and sessionStorage references.
 * Measures decoding performance for optimization tracking.
 */
export function decodeNavigationContext(searchParams: URLSearchParams): NavigationContext | null {
  const startTime = performance.now();

  // Check for sessionStorage reference
  const navRef = searchParams.get('navRef');
  if (navRef) {
    const stored = retrieveNavigationContext(navRef);
    if (stored) {
      const endTime = performance.now();
      if (performanceMetrics) {
        performanceMetrics.decodingTime = endTime - startTime;
      }
      return stored;
    }
    // Fall through to try direct decoding if storage retrieval fails
  }

  // Direct decoding from URL
  const idsParam = searchParams.get('ids');
  const currentId = searchParams.get('current');

  if (!idsParam || !currentId) {
    return null;
  }

  const ids = idsParam.split(',').filter((id) => id.length > 0);
  if (ids.length === 0) {
    return null;
  }

  // Extract filter parameters (those prefixed with 'nav')
  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith('nav') && key !== 'navRef') {
      // Convert navSearch -> search, navVendor -> vendor
      const filterKey = key.charAt(3).toLowerCase() + key.slice(4);
      filters[filterKey] = value;
    }
  });

  const endTime = performance.now();
  if (performanceMetrics) {
    performanceMetrics.decodingTime = endTime - startTime;
  }

  return {
    ids,
    currentId,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

/**
 * Generates a unique storage key for navigation context.
 */
function generateStorageKey(currentId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${STORAGE_KEY_PREFIX}-${currentId}-${timestamp}-${random}`;
}

/**
 * Stores navigation context in sessionStorage with expiry.
 */
function storeNavigationContext(key: string, context: NavigationContext): void {
  const stored: StoredNavigationContext = {
    ...context,
    timestamp: Date.now(),
    expiresAt: Date.now() + STORAGE_EXPIRY_MS,
  };

  try {
    sessionStorage.setItem(key, JSON.stringify(stored));
  } catch (error) {
    console.warn('Failed to store navigation context in sessionStorage:', error);
  }
}

/**
 * Retrieves navigation context from sessionStorage.
 * Returns null if not found or expired.
 */
function retrieveNavigationContext(key: string): NavigationContext | null {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) {
      return null;
    }

    const stored: StoredNavigationContext = JSON.parse(item);

    // Check expiry
    if (Date.now() > stored.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }

    return {
      ids: stored.ids,
      currentId: stored.currentId,
      filters: stored.filters,
    };
  } catch (error) {
    console.warn('Failed to retrieve navigation context from sessionStorage:', error);
    return null;
  }
}

/**
 * Cleans up expired navigation contexts from sessionStorage.
 */
export function cleanupExpiredContexts(): void {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const item = sessionStorage.getItem(key);
        if (item) {
          try {
            const stored: StoredNavigationContext = JSON.parse(item);
            if (Date.now() > stored.expiresAt) {
              keysToRemove.push(key);
            }
          } catch {
            // Invalid JSON, remove it
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to cleanup expired navigation contexts:', error);
  }
}
