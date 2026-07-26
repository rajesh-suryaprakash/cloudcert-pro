import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { encodeNavigationContext, decodeNavigationContext } from '../utils/navigationUtils';

/**
 * Entity types supported by the navigation system
 */
export type EntityType =
  | 'certifications'
  | 'exams'
  | 'topics'
  | 'subtopics'
  | 'units'
  | 'questions';

/**
 * Cache entry for storing recently viewed records
 */
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

/**
 * Simple LRU cache for navigation data with enhanced management
 */
class NavigationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 20;
  private maxAge: number = 5 * 60 * 1000; // 5 minutes
  private maxMemoryBytes: number = 10 * 1024 * 1024; // 10MB

  set(key: string, data: unknown): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Check memory usage and evict if necessary
    this.evictIfMemoryExceeded();
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; estimatedMemoryBytes: number } {
    const estimatedMemoryBytes = this.estimateMemoryUsage();
    return {
      size: this.cache.size,
      estimatedMemoryBytes,
    };
  }

  /**
   * Estimate memory usage of cached data
   */
  private estimateMemoryUsage(): number {
    let totalBytes = 0;
    this.cache.forEach((entry) => {
      // Rough estimation: JSON string length * 2 (for UTF-16)
      const jsonStr = JSON.stringify(entry.data);
      totalBytes += jsonStr.length * 2;
    });
    return totalBytes;
  }

  /**
   * Evict oldest entries if memory usage exceeds limit
   */
  private evictIfMemoryExceeded(): void {
    while (this.estimateMemoryUsage() > this.maxMemoryBytes && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

// Global cache instance shared across all navigation hooks
const globalNavigationCache = new NavigationCache();

/**
 * Clears the global navigation cache.
 * Exported for use in tests to prevent cache pollution between test runs.
 */
export function clearNavigationCache(): void {
  globalNavigationCache.clear();
}

/**
 * Filter state that can be preserved in navigation context
 */
export interface FilterState {
  search?: string;
  vendor?: string;
  certId?: string;
  topicId?: string;
  [key: string]: string | undefined;
}

/**
 * Navigation context containing the sequence of IDs and current position
 */
interface NavigationContext {
  ids: string[]; // Ordered list of record IDs in navigation sequence
  currentId: string; // Currently displayed record ID
  filters?: FilterState; // Optional filter state for context reconstruction
}

/**
 * Navigation error types
 */
type NavigationError =
  | 'record_not_found'
  | 'network_failure'
  | 'invalid_context'
  | 'context_reconstruction_failed'
  | null;

/**
 * Prefetching configuration
 */
interface PrefetchConfig {
  enabled: boolean;
  prefetchNext: boolean;
  prefetchPrevious: boolean;
}

/**
 * Navigation hook options
 */
export interface NavigationOptions {
  onNavigationError?: (error: NavigationError, message: string) => void;
  prefetch?: Partial<PrefetchConfig>;
  fetchRecord?: (id: string) => Promise<unknown>;
}

/**
 * Navigation state exposed by the hook
 */
interface NavigationState {
  context: NavigationContext | null;
  currentIndex: number;
  total: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLoading: boolean;
  error: NavigationError;
  cachedData: unknown | null;
}

/**
 * Navigation actions exposed by the hook
 */
interface NavigationActions {
  goNext: () => void;
  goPrevious: () => void;
  initializeFromList: (ids: string[], currentId: string, filters?: FilterState) => void;
  initializeFromURL: () => Promise<void>;
  updateContext: (ids: string[]) => void;
  clearError: () => void;
  onNavigationError?: (error: NavigationError, message: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cacheCurrentData: (data: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCachedData: <T = any>(id: string) => T | null;
  getCacheStats: () => { size: number; estimatedMemoryBytes: number };
}

/**
 * Combined return type of the hook
 */
export type UseAdminNavigationReturn = NavigationState & NavigationActions;

/**
 * Custom hook for managing navigation state in admin detail views
 *
 * This hook provides Previous/Next navigation functionality that respects
 * filters and search criteria from the list view. It manages navigation
 * context through URL query parameters for persistence and shareability.
 *
 * @param entityType - The type of entity being navigated
 * @param currentId - The ID of the currently displayed record
 * @param options - Optional configuration including error callback and prefetch settings
 * @returns Navigation state and actions
 *
 * @example
 * ```tsx
 * function CertificationDetailPanel({ certificationId }: Props) {
 *   const navigation = useAdminNavigation('certifications', certificationId, {
 *     onNavigationError: (error, message) => showToast('error', message),
 *     prefetch: { enabled: true, prefetchNext: true, prefetchPrevious: true },
 *     fetchRecord: async (id) => await fetchCertification(id)
 *   });
 *
 *   return (
 *     <>
 *       <NavigationControls {...navigation} />
 *       {/* Detail view content *\/}
 *     </>
 *   );
 * }
 * ```
 */
export function useAdminNavigation(
  entityType: EntityType,
  currentId: string,
  options?: NavigationOptions,
): UseAdminNavigationReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [context, setContext] = useState<NavigationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NavigationError>(null);
  const [cachedData, setCachedData] = useState<unknown | null>(null);

  // Mirror context in a ref so callbacks always see the latest value
  // even when called in the same React batch as setContext
  const contextRef = useRef<NavigationContext | null>(null);

  // Keep ref in sync with state
  const setContextAndRef = useCallback((newCtx: NavigationContext | null) => {
    contextRef.current = newCtx;
    setContext(newCtx);
  }, []);

  // Use ref to track the entity type for cache key generation
  const entityTypeRef = useRef(entityType);

  // Prefetch configuration with defaults - wrapped in useMemo to prevent deps change on every render
  const prefetchConfig: PrefetchConfig = useMemo(
    () => ({
      enabled: options?.prefetch?.enabled ?? false,
      prefetchNext: options?.prefetch?.prefetchNext ?? true,
      prefetchPrevious: options?.prefetch?.prefetchPrevious ?? true,
    }),
    [
      options?.prefetch?.enabled,
      options?.prefetch?.prefetchNext,
      options?.prefetch?.prefetchPrevious,
    ],
  );

  // Track prefetch requests to avoid duplicates
  const prefetchingRef = useRef<Set<string>>(new Set());

  /**
   * Generate cache key for a record
   */
  const getCacheKey = useCallback((id: string): string => {
    return `${entityTypeRef.current}:${id}`;
  }, []);

  /**
   * Cache current record data for optimistic updates
   */
  const cacheCurrentData = useCallback(
    (data: unknown) => {
      if (data && currentId) {
        globalNavigationCache.set(getCacheKey(currentId), data);
      }
    },
    [currentId, getCacheKey],
  );

  /**
   * Get cached data for a specific record ID
   */
   
  const getCachedData = useCallback(
    <T = unknown>(id: string): T | null => {
      return globalNavigationCache.get(getCacheKey(id)) as T | null;
    },
    [getCacheKey],
  );

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    return globalNavigationCache.getStats();
  }, []);

  /**
   * Prefetch adjacent records for instant navigation
   */
  const prefetchAdjacentRecords = useCallback(async () => {
    if (!prefetchConfig.enabled || !context || !options?.fetchRecord) {
      return;
    }

    const currentIdx = context.ids.indexOf(currentId);
    if (currentIdx === -1) return;

    const recordsToPrefetch: string[] = [];

    // Prefetch next record
    if (prefetchConfig.prefetchNext && currentIdx < context.ids.length - 1) {
      const nextId = context.ids[currentIdx + 1];
      if (!getCachedData(nextId) && !prefetchingRef.current.has(nextId)) {
        recordsToPrefetch.push(nextId);
      }
    }

    // Prefetch previous record
    if (prefetchConfig.prefetchPrevious && currentIdx > 0) {
      const prevId = context.ids[currentIdx - 1];
      if (!getCachedData(prevId) && !prefetchingRef.current.has(prevId)) {
        recordsToPrefetch.push(prevId);
      }
    }

    // Fetch records in parallel
    recordsToPrefetch.forEach(async (id) => {
      prefetchingRef.current.add(id);
      try {
        const data = await options.fetchRecord(id);
        globalNavigationCache.set(getCacheKey(id), data);
      } catch (err) {
        // Silently fail prefetch - it's an optimization, not critical
        console.warn(`Prefetch failed for ${id}:`, err);
      } finally {
        prefetchingRef.current.delete(id);
      }
    });
  }, [prefetchConfig, context, currentId, options, getCachedData, getCacheKey]);

  /**
   * Check for cached data when currentId changes
   */
  useEffect(() => {
    const cached = getCachedData(currentId);
    if (cached) {
      setCachedData(cached);
    } else {
      setCachedData(null);
    }
  }, [currentId, getCachedData]);

  /**
   * Prefetch adjacent records when context or currentId changes
   */
  useEffect(() => {
    if (prefetchConfig.enabled && context) {
      // Small delay to avoid prefetching during rapid navigation
      const timeoutId = setTimeout(() => {
        prefetchAdjacentRecords();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [context, currentId, prefetchConfig.enabled, prefetchAdjacentRecords]);

  /**
   * Parse navigation context from URL query parameters.
   * Handles both direct `ids` encoding and `navRef` sessionStorage references.
   * Fallback: when only `ids` is present (no `current` param), use the currentId prop.
   */
  const parseContextFromURL = useCallback((): NavigationContext | null => {
    // Primary: use decodeNavigationContext which handles navRef= (sessionStorage) and ids= + current=
    const decoded = decodeNavigationContext(searchParams);
    if (decoded) {
      return {
        ids: decoded.ids,
        currentId,
        filters: decoded.filters as FilterState | undefined,
      };
    }

    // Fallback: some callers (e.g. tests) only set `ids` without a `current` param.
    // In that case, manually parse ids and use the hook's currentId prop.
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').filter((id) => id.length > 0);
      if (ids.length > 0) {
        return { ids, currentId };
      }
    }

    return null;
  }, [searchParams, currentId]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Handle navigation errors with appropriate user feedback
   */
  const handleNavigationError = useCallback(
    (errorType: NavigationError, message: string) => {
      setError(errorType);
      if (options?.onNavigationError) {
        options.onNavigationError(errorType, message);
      }
    },
    [options],
  );

  /**
   * Initialize navigation context from URL on mount
   */
  useEffect(() => {
    const urlContext = parseContextFromURL();
    if (urlContext) {
      setContextAndRef(urlContext);
    }
  }, [parseContextFromURL, setContextAndRef]);

  /**
   * Calculate current index in the navigation sequence
   */
  const currentIndex = context ? context.ids.indexOf(currentId) : -1;
  const total = context?.ids.length ?? 0;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < total - 1;

  /**
   * Navigate to the next record in the sequence
   */
  const goNext = useCallback(() => {
    if (!context || !canGoNext || isLoading) return;

    const nextIndex = currentIndex + 1;
    const nextId = context.ids[nextIndex];

    // Optimistic update: Set loading immediately
    setIsLoading(true);
    clearError();

    // Check if next record is cached
    const nextCached = getCachedData(nextId);
    if (nextCached) {
      setCachedData(nextCached);
    }

    try {
      // Build new params: preserve navRef (sessionStorage) or ids, just update current
      const newParams = new URLSearchParams();

      // Preserve the navigation context reference (navRef or ids)
      const navRef = searchParams.get('navRef');
      if (navRef) {
        newParams.set('navRef', navRef);
      } else {
        const idsParam = searchParams.get('ids');
        if (idsParam) newParams.set('ids', idsParam);
      }
      newParams.set('current', nextId);

      // Preserve edit flag if present
      const edit = searchParams.get('edit');
      if (edit) newParams.set('edit', edit);

      // Navigate to the next record
      const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
      navigate(`${basePath}/${nextId}?${newParams.toString()}`, { replace: false });
    } catch {
      handleNavigationError(
        'network_failure',
        'Failed to navigate to next record. Please try again.',
      );
      setIsLoading(false);
    }
  }, [
    context,
    canGoNext,
    currentIndex,
    searchParams,
    navigate,
    isLoading,
    clearError,
    handleNavigationError,
    getCachedData,
  ]);

  /**
   * Navigate to the previous record in the sequence
   */
  const goPrevious = useCallback(() => {
    if (!context || !canGoPrevious || isLoading) return;

    const prevIndex = currentIndex - 1;
    const prevId = context.ids[prevIndex];

    // Optimistic update: Set loading immediately
    setIsLoading(true);
    clearError();

    // Check if previous record is cached
    const prevCached = getCachedData(prevId);
    if (prevCached) {
      setCachedData(prevCached);
    }

    try {
      // Build new params: preserve navRef (sessionStorage) or ids, just update current
      const newParams = new URLSearchParams();

      // Preserve the navigation context reference (navRef or ids)
      const navRef = searchParams.get('navRef');
      if (navRef) {
        newParams.set('navRef', navRef);
      } else {
        const idsParam = searchParams.get('ids');
        if (idsParam) newParams.set('ids', idsParam);
      }
      newParams.set('current', prevId);

      // Preserve edit flag if present
      const edit = searchParams.get('edit');
      if (edit) newParams.set('edit', edit);

      // Navigate to the previous record
      const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
      navigate(`${basePath}/${prevId}?${newParams.toString()}`, { replace: false });
    } catch {
      handleNavigationError(
        'network_failure',
        'Failed to navigate to previous record. Please try again.',
      );
      setIsLoading(false);
    }
  }, [
    context,
    canGoPrevious,
    currentIndex,
    searchParams,
    navigate,
    isLoading,
    clearError,
    handleNavigationError,
    getCachedData,
  ]);

  /**
   * Initialize navigation context from list view.
   * Uses encodeNavigationContext to automatically fall back to sessionStorage
   * when the ID list would make the URL exceed 2000 characters.
   */
  const initializeFromList = useCallback(
    (ids: string[], newCurrentId: string, filters?: FilterState) => {
      const newContext: NavigationContext = {
        ids,
        currentId: newCurrentId,
        filters,
      };

      setContextAndRef(newContext);

      // Use encodeNavigationContext so large ID lists go to sessionStorage
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const encodedParams = encodeNavigationContext(
        { ids, currentId: newCurrentId, filters: filters as Record<string, string> | undefined },
        baseUrl,
      );

      setSearchParams(encodedParams, { replace: true });
    },
    [setSearchParams, setContextAndRef],
  );

  /**
   * Initialize navigation context from URL
   * Called when accessing a detail view via direct URL
   * This is a placeholder - actual implementation would fetch the full list
   */
  const initializeFromURL = useCallback(async () => {
    setIsLoading(true);
    try {
      // Parse existing context from URL
      const urlContext = parseContextFromURL();
      if (urlContext) {
        setContextAndRef(urlContext);
      }
      // In a real implementation, if no context exists, we would:
      // 1. Fetch the full list of records for this entity type
      // 2. Apply any filters from the URL
      // 3. Build the navigation context
      // For now, we just use what's in the URL
    } finally {
      setIsLoading(false);
    }
  }, [parseContextFromURL, setContextAndRef]);

  /**
   * Update navigation context with new IDs.
   * Uses encodeNavigationContext to handle large ID lists via sessionStorage.
   * Handles edge cases: record removed from context, empty context.
   */
  const updateContext = useCallback(
    (newIds: string[]) => {
      // Read from ref so we always have the latest context even if called
      // in the same React batch as initializeFromList (same act() block)
      const currentContext = contextRef.current;
      if (!currentContext) return;

      // Edge case: Empty context
      if (newIds.length === 0) {
        setContextAndRef(null);
        handleNavigationError('invalid_context', 'All records removed. Returning to list.');
        // Navigate back to list view
        const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
        navigate(basePath, { replace: true });
        return;
      }

      // Check if current ID is still in the new list
      const newIndex = newIds.indexOf(currentId);

      if (newIndex === -1) {
        // Current record no longer in filtered list
        // Navigate to nearest record (first in new list)
        const nearestId = newIds[0];
        const newContext: NavigationContext = {
          ...currentContext,
          ids: newIds,
          currentId: nearestId,
        };
        setContextAndRef(newContext);

        handleNavigationError(
          'record_not_found',
          'Record not found. Showing next available record.',
        );

        // Use encodeNavigationContext for large ID lists
        const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
        const baseUrl = `${window.location.origin}${basePath}/${nearestId}`;
        const encodedParams = encodeNavigationContext(
          {
            ids: newIds,
            currentId: nearestId,
            filters: currentContext.filters as Record<string, string> | undefined,
          },
          baseUrl,
        );

        navigate(`${basePath}/${nearestId}?${encodedParams.toString()}`, { replace: true });
      } else {
        // Current record still in list, just update IDs
        const newContext: NavigationContext = {
          ...currentContext,
          ids: newIds,
        };
        setContextAndRef(newContext);

        // Use encodeNavigationContext for large ID lists
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        const encodedParams = encodeNavigationContext(
          {
            ids: newIds,
            currentId,
            filters: currentContext.filters as Record<string, string> | undefined,
          },
          baseUrl,
        );
        setSearchParams(encodedParams, { replace: true });
      }
    },
    [currentId, setSearchParams, navigate, handleNavigationError, setContextAndRef],
  );

  /**
   * Reset loading state when currentId changes
   */
  useEffect(() => {
    setIsLoading(false);
  }, [currentId]);

  return {
    // State
    context,
    currentIndex,
    total,
    canGoPrevious,
    canGoNext,
    isLoading,
    error,
    cachedData,

    // Actions
    goNext,
    goPrevious,
    initializeFromList,
    initializeFromURL,
    updateContext,
    clearError,
    onNavigationError: options?.onNavigationError,
    cacheCurrentData,
    getCachedData,
    getCacheStats,
  };
}
