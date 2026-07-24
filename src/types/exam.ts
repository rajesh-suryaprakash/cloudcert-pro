export type SelectionStrategy = 'random' | 'difficulty_balanced' | 'topic_based';

export type ExamStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Question {
  id: string;
  topicId: string;
  subTopicId?: string;
  questionText: string;
  questionType: 'single' | 'multiple';
  options: string[];
  correctAnswers: string | string[];
  explanation?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  points: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamConfiguration {
  id: string;
  certificationId: string;
  name: string;
  description?: string;
  duration: number; // in minutes
  totalQuestions: number;
  passingScore: number; // percentage
  questionSelectionStrategy: SelectionStrategy;
  topicWeights: Record<string, number>; // topicId -> weight
  isActive: boolean;
  isPracticeMode?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExamSession {
  id: string;
  userId: string;
  examConfigurationId?: string;
  topicId?: string;
  questions: string[]; // Array of question IDs
  status: ExamStatus;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  timeTaken?: number; // in seconds
  startTime: string;
  endTime?: string;
  autoSubmitAt: string;
  isPracticeMode: boolean;
  isTopicQuiz: boolean;
  isCustomQuiz: boolean;
  isSRSReview: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizState {
  questions: Question[];
  currentQuestionIndex: number;
  userAnswers: (string | string[] | null)[];
  isFinished: boolean;
  startTime: number;
  endTime: number | null;
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  timeSpent: number;
  categoryBreakdown: Record<string, { correct: number; total: number }>;
}

export interface ConfidenceMatrix {
  trueKnowledge: number;
  luckyGuesses: number;
  knownWeaknesses: number;
  criticalGaps: number;
}

/** Shape of a single answer returned by the exam-session API (GET /exam-sessions/:id) */
export interface SessionAnswer {
  id: string;
  questionId: string;
  userAnswer: string | string[] | null;
  isCorrect: boolean;
  markedForReview: boolean;
  confidenceLevel: number | null;
  answerOrder: number;
  timeSpent: number | null;
  /** Aliased from userAnswer when mapped for Quiz display */
  selectedOptions?: string | string[] | null;
}

/**
 * Shape of a past exam attempt as stored in the `historicalAttempt` state.
 * Combines ExamSession fields with the session's answers (selectedOptions-remapped).
 */
export interface HistoricalAttempt {
  id: string;
  userId: string;
  examConfigurationId?: string;
  certificationId?: string;
  sessionName?: string;
  questions: string[];
  status: ExamStatus;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  timeTaken?: number;
  startTime: string;
  endTime?: string;
  autoSubmitAt: string;
  isPracticeMode: boolean;
  isTopicQuiz: boolean;
  isCustomQuiz: boolean;
  isSRSReview: boolean;
  createdAt: string;
  updatedAt: string;
  answers: SessionAnswer[];
}

/**
 * Extends ExamConfiguration with optional wizard-override fields.
 * These are passed from the Quiz Wizard UI to `startQuiz()` and take priority
 * over the stored exam config values.
 */
export interface WizardExamConfig extends ExamConfiguration {
  _numQuestions?: number;
  _difficulty?: string;
  _duration?: number;
  _passingScore?: number;
}
