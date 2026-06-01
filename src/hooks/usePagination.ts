import { useSearchParams } from 'react-router-dom';

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export interface PaginationState {
  page: number;
  pageSize: PageSize;
  setPage: (p: number) => void;
  setPageSize: (s: PageSize) => void;
}

/**
 * URL-driven pagination hook.
 * Reads ?page= and ?pageSize= from the URL so state survives navigation.
 * Resets to page 1 whenever filters change (caller should pass a resetKey).
 */
export function usePagination(): PaginationState {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const rawSize = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
  const pageSize: PageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(rawSize)
    ? (rawSize as PageSize)
    : DEFAULT_PAGE_SIZE;

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next, { replace: true });
  };

  const setPageSize = (s: PageSize) => {
    const next = new URLSearchParams(searchParams);
    next.set('pageSize', String(s));
    next.set('page', '1'); // reset to first page on size change
    setSearchParams(next, { replace: true });
  };

  return { page, pageSize, setPage, setPageSize };
}

/** Slice a filtered array to the current page window. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Total number of pages. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
