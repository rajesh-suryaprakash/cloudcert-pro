import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Quiz from './Quiz';
import { pauseExamSession, resumeExamSession } from '../../api/exams';

vi.mock('motion/react', () => {
  const mockMotion = (tag: string) =>
    React.forwardRef(({ children, ...props }: Record<string, unknown>, ref: React.Ref<unknown>) => {
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        whileHover: _whileHover,
        whileTap: _whileTap,
        whileFocus: _whileFocus,
        variants: _variants,
        layout: _layout,
        layoutId: _layoutId,
        drag: _drag,
        dragConstraints: _dragConstraints,
        onDragEnd: _onDragEnd,
        ...domProps
      } = props;
      return React.createElement(tag, { ...domProps, ref }, children);
    });

  const cache: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  const motion = new Proxy({} as unknown as Record<string, React.ComponentType<Record<string, unknown>>>, {
    get: (_, prop: string) => {
      if (!cache[prop]) {
        cache[prop] = mockMotion(prop);
      }
      return cache[prop];
    },
  });

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Test User' } }),
}));

vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../api/exams', () => ({
  pauseExamSession: vi.fn(() => Promise.resolve({ ok: true })),
  resumeExamSession: vi.fn(() => Promise.resolve({ ok: true, timeLeftSeconds: 3600 })),
}));

let mockShortcutsEnabled = true;

vi.mock('../../contexts/KeyboardShortcutContext', () => ({
  useKeyboardShortcuts: () => ({
    shortcutsEnabled: mockShortcutsEnabled,
    setShortcutsEnabled: vi.fn(),
  }),
}));

const mockQuestions = [
  {
    id: 'q-1',
    topicId: 't-1',
    subTopicId: 'st-1',
    unitId: 'u-1',
    questionText: 'Question 1 Content',
    questionType: 'single' as const,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswers: 'Option A',
    explanation: 'Explanation 1',
    difficulty: 'Easy' as const,
    tags: ['General'],
    points: 1,
    isActive: true,
    createdAt: '2026-07-02T02:00:00Z',
    updatedAt: '2026-07-02T02:00:00Z',
  },
  {
    id: 'q-2',
    topicId: 't-1',
    subTopicId: 'st-1',
    unitId: 'u-1',
    questionText: 'Question 2 Content',
    questionType: 'single' as const,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswers: 'Option B',
    explanation: 'Explanation 2',
    difficulty: 'Medium' as const,
    tags: ['General'],
    points: 1,
    isActive: true,
    createdAt: '2026-07-02T02:00:00Z',
    updatedAt: '2026-07-02T02:00:00Z',
  },
];

const mockExamConfig = {
  id: 'exam-1',
  certificationId: 'cert-1',
  name: 'Mock Exam',
  duration: 60,
  passingScore: 70,
  questionSelectionStrategy: 'random' as const,
  topicWeights: {},
  isActive: true,
  isPracticeMode: false,
  totalQuestions: 2,
  createdAt: '2026-07-02T02:00:00Z',
  updatedAt: '2026-07-02T02:00:00Z',
};

describe('Quiz Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShortcutsEnabled = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should navigate to the next question with ArrowRight and previous question with ArrowLeft', async () => {
    render(
      <Quiz
        questions={mockQuestions}
        examConfig={mockExamConfig}
        sessionId="session-123"
        onFinish={vi.fn()}
        onReset={vi.fn()}
      />
    );

    // Initial state: Question 1
    expect(screen.getByText('Question 1 Content')).toBeInTheDocument();

    // Navigate next
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(screen.getByText('Question 2 Content')).toBeInTheDocument();

    // Navigate prev
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(screen.getByText('Question 1 Content')).toBeInTheDocument();
  });

  it('should pause and resume the exam session when Space bar is pressed', async () => {
    render(
      <Quiz
        questions={mockQuestions}
        examConfig={mockExamConfig}
        sessionId="session-123"
        onFinish={vi.fn()}
        onReset={vi.fn()}
      />
    );

    // Toggle pause (First press)
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(pauseExamSession).toHaveBeenCalledWith('session-123');

    // Wait for the paused state modal to appear or be processed
    await waitFor(() => {
      expect(screen.getByText('Exam Paused')).toBeInTheDocument();
    });

    // Toggle resume (Second press)
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(resumeExamSession).toHaveBeenCalledWith('session-123');
  });

  it('should not navigate or pause/resume when an input or textarea element is focused', async () => {
    render(
      <Quiz
        questions={mockQuestions}
        examConfig={mockExamConfig}
        sessionId="session-123"
        onFinish={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Test ArrowRight inside input
    const arrowRightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    Object.defineProperty(arrowRightEvent, 'target', { value: input });
    await act(async () => {
      window.dispatchEvent(arrowRightEvent);
    });

    expect(screen.getByText('Question 1 Content')).toBeInTheDocument();
    expect(screen.queryByText('Question 2 Content')).not.toBeInTheDocument();

    // Test Space bar inside input
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(spaceEvent, 'target', { value: input });
    await act(async () => {
      window.dispatchEvent(spaceEvent);
    });

    expect(pauseExamSession).not.toHaveBeenCalled();
  });

  it('should not pause/resume when a button or link element is focused', async () => {
    render(
      <Quiz
        questions={mockQuestions}
        examConfig={mockExamConfig}
        sessionId="session-123"
        onFinish={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(spaceEvent, 'target', { value: button });
    await act(async () => {
      window.dispatchEvent(spaceEvent);
    });

    expect(pauseExamSession).not.toHaveBeenCalled();
  });

  it('should not navigate or pause/resume when shortcuts are globally disabled', async () => {
    mockShortcutsEnabled = false;

    render(
      <Quiz
        questions={mockQuestions}
        examConfig={mockExamConfig}
        sessionId="session-123"
        onFinish={vi.fn()}
        onReset={vi.fn()}
      />
    );

    // Assert initial state is question 1
    expect(screen.getByText('Question 1 Content')).toBeInTheDocument();

    // Verify ArrowRight does not navigate
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(screen.getByText('Question 1 Content')).toBeInTheDocument();
    expect(screen.queryByText('Question 2 Content')).not.toBeInTheDocument();

    // Verify Space bar does not trigger pause
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(pauseExamSession).not.toHaveBeenCalled();
  });
});
