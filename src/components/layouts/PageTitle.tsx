/**
 * PageTitle
 *
 * Declarative component that sets the browser tab title for the current route.
 * Renders nothing in the DOM — it is a pure side-effect component.
 *
 * Usage:
 *   <PageTitle title="Dashboard" />
 *   <PageTitle title={`${certTitle} — Practice`} />
 *   <PageTitle title={null} />   ← resets to "CloudCert Pro"
 */

import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface PageTitleProps {
  /** Page-specific title segment. Null/undefined falls back to the app name. */
  title: string | null | undefined;
}

export function PageTitle({ title }: PageTitleProps): null {
  useDocumentTitle(title);
  return null;
}

export default PageTitle;
