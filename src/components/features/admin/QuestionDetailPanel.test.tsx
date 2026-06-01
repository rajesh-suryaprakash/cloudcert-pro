import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QuestionDetailPanel from './QuestionDetailPanel';
import * as client from '../../../api/client';
import * as certifications from '../../../api/certifications';

vi.mock('../../../api/client');
vi.mock('../../../api/certifications');

const mockFetchApi = vi.mocked(client.fetchApi);
const mockFetchCertifications = vi.mocked(certifications.fetchCertifications);

describe('QuestionDetailPanel', () => {
  const mockQuestion = {
    id: 'q-test-001',
    questionText: 'What is the capital of France?',
    questionType: 'single',
    options: ['London', 'Paris', 'Berlin', 'Madrid'],
    correctAnswers: ['Paris'],
    explanation: 'Paris is the capital and largest city of France.',
    difficulty: 'Easy',
    tags: ['geography', 'europe'],
    points: 1,
    isActive: true,
  };

  const mockCert = { id: 'cert-1', title: 'Test Certification', vendor: 'Test' };
  const mockTopic = { id: 'topic-1', title: 'Test Topic' };
  const mockSubTopic = { id: 'subtopic-1', title: 'Test SubTopic' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCertifications.mockResolvedValue([mockCert]);
    mockFetchApi.mockImplementation((url: string) => {
      if (url.includes('/certifications/') && url.includes('/topics')) {
        return Promise.resolve([mockTopic]);
      }
      if (url.includes('/topics/') && url.includes('/subtopics')) {
        return Promise.resolve([mockSubTopic]);
      }
      if (url.includes('/subtopics/') && url.includes('/questions')) {
        return Promise.resolve([mockQuestion]);
      }
      return Promise.resolve([]);
    });
  });

  it('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <QuestionDetailPanel
          questionId="q-test-001"
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onBack={vi.fn()}
        />
      </BrowserRouter>,
    );

    expect(screen.getByText(/loading question details/i)).toBeInTheDocument();
  });

  it('renders question details after loading', async () => {
    render(
      <BrowserRouter>
        <QuestionDetailPanel
          questionId="q-test-001"
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onBack={vi.fn()}
        />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Question Details')).toBeInTheDocument();
    });
  });
});
