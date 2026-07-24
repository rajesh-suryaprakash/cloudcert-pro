import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadAttemptReviewMarkdown } from './markdownExport';
import type { QuizState, Question } from '../types';

describe('downloadAttemptReviewMarkdown', () => {
  const originalBlob = global.Blob;
  let mockBlobConstructor: any;
  let createdObjectURL = '';
  let mockLink: any;

  beforeEach(() => {
    createdObjectURL = 'blob:http://localhost:3000/mock-uuid';
    global.URL.createObjectURL = vi.fn(() => createdObjectURL);
    global.URL.revokeObjectURL = vi.fn();

    mockBlobConstructor = vi.fn(function(...args: any[]) {
      // @ts-ignore
      return new originalBlob(...args);
    });
    global.Blob = mockBlobConstructor as any;

    // Mock document.createElement to intercept the anchor click download trigger
    mockLink = {
      href: '',
      setAttribute: vi.fn(),
      click: vi.fn(),
    };
    
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockLink;
      }
      return document.createElement(tagName);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
  });

  afterEach(() => {
    global.Blob = originalBlob;
    vi.restoreAllMocks();
  });

  const mockQuestions: Question[] = [
    {
      id: 'q-1',
      topicId: 't-1',
      subTopicId: 'st-1',
      unitId: 'u-1',
      questionText: 'Which service provides managed Redis on Google Cloud?',
      questionType: 'single',
      options: ['Memorystore', 'Cloud SQL', 'Datastore', 'Bigtable'],
      correctAnswers: 'Memorystore',
      explanation: JSON.stringify({
        'general explanation': 'Memorystore provides fully managed in-memory data store services for Redis.',
        'why other options are wrong': {
          'Cloud SQL': 'Cloud SQL is a relational database service for MySQL, PostgreSQL, and SQL Server.',
          'Bigtable': 'Bigtable is a NoSQL wide-column database service.',
        },
      }),
      difficulty: 'Easy',
      tags: ['Caching', 'Databases'],
      points: 1,
      isActive: true,
      createdAt: '2026-07-02T02:00:00Z',
      updatedAt: '2026-07-02T02:00:00Z',
    },
  ];

  const mockQuizState: QuizState = {
    sessionId: 'session-123',
    examConfigurationId: 'config-123',
    certificationId: 'cert-123',
    questions: mockQuestions,
    userAnswers: ['Memorystore'],
    flagged: [false],
    currentQuestionIndex: 0,
    startTime: Date.now(),
    isFinished: true,
    sessionName: 'Google Cloud Professional Cloud Architect Practice Exam',
  };

  it('should generate a structured markdown and trigger browser download with URL-safe filename', () => {
    downloadAttemptReviewMarkdown({
      quizState: mockQuizState,
      scorePercent: 100,
      correctCount: 1,
      totalCount: 1,
      passed: true,
      confidenceMatrix: {
        trueKnowledge: 1,
        luckyGuesses: 0,
        knownWeaknesses: 0,
        criticalGaps: 0,
      },
    });

    // Verify blob URL creation
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockLink.setAttribute).toHaveBeenCalledWith(
      'download',
      expect.stringMatching(/^session_session123_[a-z0-9]+\.md$/)
    );
    expect(mockLink.click).toHaveBeenCalled();

    // Verify actual markdown content structured into the Blob
    const blobCallArg = mockBlobConstructor.mock.calls[0][0][0];
    
    // Check main headers
    expect(blobCallArg).toContain('# Attempt Review: Google Cloud Professional Cloud Architect Practice Exam');
    expect(blobCallArg).toContain('**Score:** 100% (1 / 1)');
    expect(blobCallArg).toContain('**Status:** PASSED');

    // Check confidence profile details
    expect(blobCallArg).toContain('## Confidence Profile');
    expect(blobCallArg).toContain('- **True Knowledge:** 1 (Correct + Confident)');

    // Check questions review section
    expect(blobCallArg).toContain('### Question 1: Which service provides managed Redis on Google Cloud?');
    expect(blobCallArg).toContain('- [x] **A)** Memorystore *(Correct Answer)*');
    expect(blobCallArg).toContain('- [ ] **B)** Cloud SQL');

    // Check wrong option reasons formatted as markdown
    expect(blobCallArg).toContain('**Explanation:**');
    expect(blobCallArg).toContain('> Memorystore provides fully managed in-memory data store services for Redis.');
    expect(blobCallArg).toContain('> **Why other options are wrong:**');
    expect(blobCallArg).toContain('> - **B)** *Cloud SQL* — Cloud SQL is a relational database service for MySQL, PostgreSQL, and SQL Server.');
  });

  it('should handle edge cases like whitespace trimming and SSR safety gracefully', () => {
    // 1. SSR / window check safety
    const originalWindow = global.window;
    const originalDocument = global.document;
    
    // @ts-ignore
    delete global.window;
    // @ts-ignore
    delete global.document;

    expect(() => {
      downloadAttemptReviewMarkdown({
        quizState: mockQuizState,
        scorePercent: 100,
        correctCount: 1,
        totalCount: 1,
        passed: true,
        confidenceMatrix: null,
      });
    }).not.toThrow();

    // Restore globals
    global.window = originalWindow;
    global.document = originalDocument;

    // 2. Whitespace trimming matching verification
    const edgeQuestion: Question = {
      ...mockQuestions[0],
      correctAnswers: 'Memorystore \n', // trailing spaces & carriage returns
      explanation: 'Not JSON text explanation', // non-JSON plain text
    };
    const edgeQuizState: QuizState = {
      ...mockQuizState,
      questions: [edgeQuestion],
      userAnswers: [' Memorystore'], // leading space
    };

    downloadAttemptReviewMarkdown({
      quizState: edgeQuizState,
      scorePercent: 100,
      correctCount: 1,
      totalCount: 1,
      passed: true,
      confidenceMatrix: null,
    });

    const blobCallArg = mockBlobConstructor.mock.calls[mockBlobConstructor.mock.calls.length - 1][0][0];
    expect(blobCallArg).toContain('- [x] **A)** Memorystore *(Correct Answer)*');
    expect(blobCallArg).toContain('**Explanation:**\n\n> Not JSON text explanation');
  });
});
