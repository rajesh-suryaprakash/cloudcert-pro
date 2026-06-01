/**
 * Example usage of useAdminNavigation hook with prefetching
 *
 * This file demonstrates how to use the navigation hook with
 * performance optimizations including prefetching.
 */

import { useAdminNavigation } from './useAdminNavigation';
import { fetchApi } from '../api/client';

/**
 * Example 1: Basic usage without prefetching (default)
 */
function CertificationDetailPanelBasic({ certificationId }: { certificationId: string }) {
  const _navigation = useAdminNavigation('certifications', certificationId, {
    onNavigationError: (error, message) => {
      console.error(`Navigation error: ${error}`, message);
    },
  });

  return (
    <div>
      <h1>Certification Details</h1>
      {/* Navigation controls would go here */}
    </div>
  );
}

/**
 * Example 2: With prefetching enabled for optimal performance
 */
function CertificationDetailPanelOptimized({ certificationId }: { certificationId: string }) {
  const navigation = useAdminNavigation('certifications', certificationId, {
    onNavigationError: (error, message) => {
      console.error(`Navigation error: ${error}`, message);
    },
    // Enable prefetching for instant navigation
    prefetch: {
      enabled: true,
      prefetchNext: true,
      prefetchPrevious: true,
    },
    // Provide fetch function for prefetching
    fetchRecord: async (id: string) => {
      const response = await fetchApi(`/api/certifications/${id}`);
      return response;
    },
  });

  // Check cache statistics for monitoring
  const cacheStats = navigation.getCacheStats();
  console.warn('Cache stats:', cacheStats);

  return (
    <div>
      <h1>Certification Details</h1>
      {/* Navigation controls would go here */}
      {navigation.cachedData && <div>Using cached data for instant display</div>}
    </div>
  );
}

/**
 * Example 3: Prefetch only next record (for forward-only workflows)
 */
function ExamDetailPanelForwardOnly({ examId }: { examId: string }) {
  const _navigation = useAdminNavigation('exams', examId, {
    prefetch: {
      enabled: true,
      prefetchNext: true,
      prefetchPrevious: false, // Don't prefetch previous
    },
    fetchRecord: async (id: string) => {
      const response = await fetchApi(`/api/exams/${id}`);
      return response;
    },
  });

  return (
    <div>
      <h1>Exam Details</h1>
      {/* Navigation controls would go here */}
    </div>
  );
}

/**
 * Example 4: Monitoring performance metrics
 */
function QuestionDetailPanelWithMetrics({ questionId }: { questionId: string }) {
  const navigation = useAdminNavigation('questions', questionId, {
    prefetch: {
      enabled: true,
      prefetchNext: true,
      prefetchPrevious: true,
    },
    fetchRecord: async (id: string) => {
      const response = await fetchApi(`/api/questions/${id}`);
      return response;
    },
  });

  // Monitor cache performance
  const cacheStats = navigation.getCacheStats();

  return (
    <div>
      <h1>Question Details</h1>
      {/* Navigation controls would go here */}

      {/* Performance monitoring (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ fontSize: '10px', color: '#666' }}>
          Cache: {cacheStats.size} entries, ~{Math.round(cacheStats.estimatedMemoryBytes / 1024)}KB
        </div>
      )}
    </div>
  );
}

export {
  CertificationDetailPanelBasic,
  CertificationDetailPanelOptimized,
  ExamDetailPanelForwardOnly,
  QuestionDetailPanelWithMetrics,
};
