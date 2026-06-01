/**
 * useDocumentTitle
 *
 * Dynamically updates the browser tab title.
 *
 * Usage:
 *   useDocumentTitle('Dashboard')          → "Dashboard | CloudCert Pro"
 *   useDocumentTitle('CloudCert Pro')      → "CloudCert Pro"   (no suffix when title IS the app name)
 *   useDocumentTitle(null)                 → "CloudCert Pro"   (fallback to app name)
 *
 * The hook restores the previous title when the component unmounts, so nested
 * routes that set their own title don't leave stale values behind.
 */

import { useEffect, useRef } from 'react';

export const APP_NAME = 'CloudCert Pro';

/**
 * Builds the full browser-tab title from a page-level segment.
 *
 * @param pageTitle - The page-specific segment, or null/undefined for the root title.
 * @returns The full title string.
 */
export function buildTitle(pageTitle: string | null | undefined): string {
  if (!pageTitle || pageTitle.trim() === '' || pageTitle.trim() === APP_NAME) {
    return APP_NAME;
  }
  return `${pageTitle.trim()} | ${APP_NAME}`;
}

/**
 * Sets document.title to `"<pageTitle> | CloudCert Pro"` while the component
 * is mounted, and restores the previous title on unmount.
 *
 * @param pageTitle - The page-specific title segment.
 */
export function useDocumentTitle(pageTitle: string | null | undefined): void {
  const previousTitle = useRef<string>(document.title);

  useEffect(() => {
    const prev = document.title;
    previousTitle.current = prev;

    document.title = buildTitle(pageTitle);

    return () => {
      document.title = previousTitle.current;
    };
    // Re-run whenever the page title changes
  }, [pageTitle]);
}
