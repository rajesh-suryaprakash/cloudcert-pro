import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DomainWeightsPanel from './DomainWeightsPanel';
import * as client from '../../../api/client';
import * as certifications from '../../../api/certifications';

vi.mock('../../../api/client');
vi.mock('../../../api/certifications');

describe('DomainWeightsPanel', () => {
  const mockCertifications = [
    { id: 'cert-1', title: 'AWS Solutions Architect' },
    { id: 'cert-2', title: 'Azure Administrator' },
  ];

  const mockDomainWeights = {
    domains: [
      { id: 'domain-1', domainName: 'Identity & Access Management', weightPercentage: 30 },
      { id: 'domain-2', domainName: 'Networking', weightPercentage: 25 },
      { id: 'domain-3', domainName: 'Storage', weightPercentage: 20 },
      { id: 'domain-4', domainName: 'Compute', weightPercentage: 25 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(certifications.fetchCertifications).mockResolvedValue(mockCertifications);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const selectCertification = async (certId: string) => {
    await waitFor(() => {
      expect(screen.getByText('AWS Solutions Architect')).toBeInTheDocument();
    });
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, certId);
  };

  describe('Weight Validation Logic', () => {
    it('should validate that individual weights are between 0 and 100', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '50');
      expect(weightInput).toHaveValue(50);
      expect(weightInput).toHaveAttribute('min', '0');
      expect(weightInput).toHaveAttribute('max', '100');
    });

    it('should handle edge case of 0% weight', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '0');
      expect(weightInput).toHaveValue(0);
    });

    it('should handle edge case of 100% weight', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '100');
      expect(weightInput).toHaveValue(100);
    });

    it('should handle decimal weight values', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '33.5');
      expect(weightInput).toHaveValue(33.5);
    });
  });

  describe('Sum-to-100 Validation', () => {
    it('should display total weight correctly when weights sum to 100', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const checkIcon = screen.getByText('100.0%').parentElement?.querySelector('svg');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should show error when total weight is less than 100', async () => {
      const invalidWeights = {
        domains: [
          { id: 'domain-1', domainName: 'IAM', weightPercentage: 30 },
          { id: 'domain-2', domainName: 'Networking', weightPercentage: 25 },
          { id: 'domain-3', domainName: 'Storage', weightPercentage: 20 },
        ],
      };
      vi.mocked(client.fetchApi).mockResolvedValue(invalidWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('75.0%')).toBeInTheDocument();
      });

      expect(screen.getByText(/Total must equal 100%/)).toBeInTheDocument();
      expect(screen.getByText(/currently 75.0%/)).toBeInTheDocument();
    });

    it('should show error when total weight is greater than 100', async () => {
      const invalidWeights = {
        domains: [
          { id: 'domain-1', domainName: 'IAM', weightPercentage: 40 },
          { id: 'domain-2', domainName: 'Networking', weightPercentage: 35 },
          { id: 'domain-3', domainName: 'Storage', weightPercentage: 30 },
        ],
      };
      vi.mocked(client.fetchApi).mockResolvedValue(invalidWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('105.0%')).toBeInTheDocument();
      });

      expect(screen.getByText(/Total must equal 100%/)).toBeInTheDocument();
      expect(screen.getByText(/currently 105.0%/)).toBeInTheDocument();
    });

    it('should update total weight dynamically as user changes individual weights', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '40');

      await waitFor(() => {
        expect(screen.getByText('110.0%')).toBeInTheDocument();
      });
    });

    it('should disable save button when total is not 100', async () => {
      const invalidWeights = {
        domains: [
          { id: 'domain-1', domainName: 'IAM', weightPercentage: 50 },
          { id: 'domain-2', domainName: 'Networking', weightPercentage: 30 },
        ],
      };
      vi.mocked(client.fetchApi).mockResolvedValue(invalidWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('80.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when total equals 100', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should handle floating point precision in sum validation', async () => {
      const precisionWeights = {
        domains: [
          { id: 'domain-1', domainName: 'IAM', weightPercentage: 33.3 },
          { id: 'domain-2', domainName: 'Networking', weightPercentage: 33.3 },
          { id: 'domain-3', domainName: 'Storage', weightPercentage: 33.4 },
        ],
      };
      vi.mocked(client.fetchApi).mockResolvedValue(precisionWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Form Submission and API Integration', () => {
    it('should call API with correct payload when saving valid weights', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(client.fetchApi).toHaveBeenCalledWith('/admin/domain-weights/cert-1', {
          method: 'PUT',
          body: JSON.stringify({
            domains: [
              { domainName: 'Identity & Access Management', weightPercentage: 30 },
              { domainName: 'Networking', weightPercentage: 25 },
              { domainName: 'Storage', weightPercentage: 20 },
              { domainName: 'Compute', weightPercentage: 25 },
            ],
          }),
        });
      });
    });

    it('should show success toast on successful save', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Domain weights updated successfully')).toBeInTheDocument();
      });
    });

    it('should show error toast on API failure', async () => {
      vi.mocked(client.fetchApi)
        .mockResolvedValueOnce(mockDomainWeights)
        .mockRejectedValueOnce(new Error('Network error'));
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should prevent save when total is not 100', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '50');

      await waitFor(() => {
        expect(screen.getByText('120.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      expect(saveButton).toBeDisabled();
      expect(client.fetchApi).toHaveBeenCalledTimes(1);
    });

    it('should show error toast when attempting to save invalid total', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const weightInput = screen.getByDisplayValue('30');
      await userEvent.clear(weightInput);
      await userEvent.type(weightInput, '50');

      await waitFor(() => {
        expect(screen.getByText('120.0%')).toBeInTheDocument();
      });

      // The inline error message should already be visible
      expect(screen.getByText(/Total must equal 100%/)).toBeInTheDocument();
      expect(screen.getByText(/currently 120.0%/)).toBeInTheDocument();
    });

    it('should disable save button while saving', async () => {
      vi.mocked(client.fetchApi).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDomainWeights), 100)),
      );
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      await userEvent.click(saveButton);

      expect(saveButton).toBeDisabled();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should send updated weights after user modifications', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      await userEvent.clear(inputs[0]);
      await userEvent.type(inputs[0], '35');
      await userEvent.clear(inputs[1]);
      await userEvent.type(inputs[1], '20');

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Domain Weights/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(client.fetchApi).toHaveBeenCalledWith('/admin/domain-weights/cert-1', {
          method: 'PUT',
          body: JSON.stringify({
            domains: [
              { domainName: 'Identity & Access Management', weightPercentage: 35 },
              { domainName: 'Networking', weightPercentage: 20 },
              { domainName: 'Storage', weightPercentage: 20 },
              { domainName: 'Compute', weightPercentage: 25 },
            ],
          }),
        });
      });
    });
  });

  describe('Cache Invalidation Warning', () => {
    it('should display cache invalidation warning', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue(mockDomainWeights);
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('Cache Invalidation Impact')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Updating domain weights will invalidate cached readiness scores/),
      ).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state while fetching domain weights', async () => {
      vi.mocked(client.fetchApi).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDomainWeights), 100)),
      );
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      expect(screen.getByText('Loading domain weights...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading domain weights...')).not.toBeInTheDocument();
      });
    });

    it('should show error toast when failing to load domain weights', async () => {
      vi.mocked(client.fetchApi).mockRejectedValue(new Error('Failed to fetch'));
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('Failed to load domain weights')).toBeInTheDocument();
      });
    });

    it('should show empty state when no domains exist', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ domains: [] });
      render(<DomainWeightsPanel />);
      await selectCertification('cert-1');

      await waitFor(() => {
        expect(screen.getByText('No Domains Found')).toBeInTheDocument();
      });
    });
  });
});
