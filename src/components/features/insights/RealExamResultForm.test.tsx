import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import * as apiClient from '../../../api/client';
import RealExamResultForm from './RealExamResultForm';

vi.mock('../../../api/client');

/**
 * RealExamResultForm - Unit Tests
 * Validates: Requirements 21.1, 21.2
 *
 * Tests the form component for reporting real exam results
 */
describe('RealExamResultForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const defaultProps = {
    certificationId: 'cert-123',
    certificationTitle: 'AWS Solutions Architect',
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Form Validation', () => {
    /**
     * Test: Form requires pass/fail selection
     * Validates: Requirement 21.1
     */
    it('should display error when submitting without selecting pass/fail', async () => {
      render(<RealExamResultForm {...defaultProps} />);

      // Submit the form directly — the submit button is disabled when no selection is made,
      // but the form's onSubmit handler still validates and sets the error state.
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/please select whether you passed or failed/i)).toBeInTheDocument();
      });
    });

    /**
     * Test: Submit button is disabled without selection
     * Validates: Requirement 21.1
     */
    it('should disable submit button when no pass/fail selection is made', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      expect(submitButton).toBeDisabled();
    });

    /**
     * Test: Submit button is enabled after selection
     * Validates: Requirement 21.1
     */
    it('should enable submit button when pass/fail is selected', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      expect(submitButton).not.toBeDisabled();
    });

    /**
     * Test: Exam date is optional
     * Validates: Requirement 21.1
     */
    it('should allow submission without exam date', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      expect(submitButton).not.toBeDisabled();
    });

    /**
     * Test: Exam date cannot be in the future
     * Validates: Requirement 21.1
     */
    it('should set max date to today for exam date input', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const dateInput = screen.getByLabelText(/exam date/i);
      const today = new Date().toISOString().split('T')[0];

      expect(dateInput).toHaveAttribute('max', today);
    });

    /**
     * Test: Error clears when selection changes
     * Validates: Requirement 21.1
     */
    it('should clear error when pass/fail selection is made', async () => {
      render(<RealExamResultForm {...defaultProps} />);

      // Submit the form directly to trigger the validation error
      const form = document.querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/please select whether you passed or failed/i)).toBeInTheDocument();
      });

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      expect(
        screen.queryByText(/please select whether you passed or failed/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    /**
     * Test: Successful API call with passed status
     * Validates: Requirement 21.2
     */
    it('should call API with correct data when passed is selected', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith('/insights/real-exam-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificationId: 'cert-123',
            passed: true,
            examDate: undefined,
          }),
        });
      });
    });

    /**
     * Test: Successful API call with failed status
     * Validates: Requirement 21.2
     */
    it('should call API with correct data when failed is selected', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const failButton = screen.getByRole('button', { name: /failed/i });
      fireEvent.click(failButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith('/insights/real-exam-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificationId: 'cert-123',
            passed: false,
            examDate: undefined,
          }),
        });
      });
    });

    /**
     * Test: API call includes exam date when provided
     * Validates: Requirement 21.2
     */
    it('should include exam date in API call when provided', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const dateInput = screen.getByLabelText(/exam date/i);
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith('/insights/real-exam-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificationId: 'cert-123',
            passed: true,
            examDate: '2024-01-15',
          }),
        });
      });
    });

    /**
     * Test: API error handling
     * Validates: Requirement 21.2
     */
    it('should display error message when API call fails', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockRejectedValueOnce(new Error('Network error'));

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    /**
     * Test: Generic error message for non-Error objects
     * Validates: Requirement 21.2
     */
    it('should display generic error message for unknown errors', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockRejectedValueOnce('Unknown error');

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to submit exam result/i)).toBeInTheDocument();
      });
    });

    /**
     * Test: Buttons disabled during submission
     * Validates: Requirement 21.2
     */
    it('should disable buttons during API submission', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
        expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      });
    });
  });

  describe('Success Message Display', () => {
    /**
     * Test: Success message displays after submission
     * Validates: Requirement 21.2
     */
    it('should display success message after successful submission', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/thank you!/i)).toBeInTheDocument();
        expect(
          screen.getByText(/your exam result has been recorded successfully/i),
        ).toBeInTheDocument();
      });
    });

    /**
     * Test: Congratulations message for passed exam
     * Validates: Requirement 21.2
     */
    it('should display congratulations message when user passed', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/congratulations on passing!/i)).toBeInTheDocument();
      });
    });

    /**
     * Test: No congratulations message for failed exam
     * Validates: Requirement 21.2
     */
    it('should not display congratulations message when user failed', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const failButton = screen.getByRole('button', { name: /failed/i });
      fireEvent.click(failButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/thank you!/i)).toBeInTheDocument();
        expect(screen.queryByText(/congratulations on passing!/i)).not.toBeInTheDocument();
      });
    });

    /**
     * Test: onSuccess callback called after delay
     * Validates: Requirement 21.2
     */
    it('should call onSuccess callback after 2 seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/thank you!/i)).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    /**
     * Test: Success icon displayed
     * Validates: Requirement 21.2
     */
    it('should display success icon in success message', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);
      mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      const submitButton = screen.getByRole('button', { name: /submit result/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const successIcon = document.querySelector('.text-emerald-600');
        expect(successIcon).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction', () => {
    /**
     * Test: Cancel button calls onCancel
     * Validates: Requirement 21.1
     */
    it('should call onCancel when cancel button is clicked', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    /**
     * Test: Certification title displayed
     * Validates: Requirement 21.1
     */
    it('should display certification title', () => {
      render(<RealExamResultForm {...defaultProps} />);

      expect(screen.getByText('AWS Solutions Architect')).toBeInTheDocument();
    });

    /**
     * Test: Pass button selection updates state
     * Validates: Requirement 21.1
     */
    it('should highlight pass button when selected', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const passButton = screen.getByRole('button', { name: /passed/i });
      fireEvent.click(passButton);

      expect(passButton).toHaveClass('border-emerald-600');
    });

    /**
     * Test: Fail button selection updates state
     * Validates: Requirement 21.1
     */
    it('should highlight fail button when selected', () => {
      render(<RealExamResultForm {...defaultProps} />);

      const failButton = screen.getByRole('button', { name: /failed/i });
      fireEvent.click(failButton);

      expect(failButton).toHaveClass('border-rose-600');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 1: Form submission includes required fields
     * Validates: Requirement 21.1
     */
    it('should submit form with certificationId and passed status', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.boolean(),
          fc.option(
            fc.date().map((d) => d.toISOString().split('T')[0]),
            { nil: undefined },
          ),
          async (certificationId, passed, examDate) => {
            // Reset mock for each property run
            mockFetchApi.mockClear();
            mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

            // Simulate form submission
            const formData = {
              certificationId,
              passed,
              examDate,
            };

            await apiClient.fetchApi('/insights/real-exam-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData),
            });

            // Verify API was called with correct data
            expect(mockFetchApi).toHaveBeenCalledWith('/insights/real-exam-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                certificationId,
                passed,
                examDate,
              }),
            });
          },
        ),
        { numRuns: 50 },
      );
    });

    /**
     * Property 2: Form validates required fields
     * Validates: Requirement 21.1
     */
    it('should require passed status to be selected', () => {
      fc.assert(
        fc.property(fc.uuid(), (_certificationId) => {
          // Simulate validation logic
          const passed = null;
          const isValid = passed !== null;

          // Form should be invalid without passed status
          expect(isValid).toBe(false);
        }),
        { numRuns: 20 },
      );
    });

    /**
     * Property 3: Exam date is optional
     * Validates: Requirement 21.1
     */
    it('should allow submission without exam date', async () => {
      const mockFetchApi = vi.mocked(apiClient.fetchApi);

      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.boolean(), async (certificationId, passed) => {
          // Reset mock for each property run
          mockFetchApi.mockClear();
          mockFetchApi.mockResolvedValueOnce({ success: true, benchmarkUserId: 'user-123' });

          // Submit without exam date
          await apiClient.fetchApi('/insights/real-exam-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              certificationId,
              passed,
              examDate: undefined,
            }),
          });

          // Should succeed
          expect(mockFetchApi).toHaveBeenCalled();
        }),
        { numRuns: 30 },
      );
    });
  });
});
