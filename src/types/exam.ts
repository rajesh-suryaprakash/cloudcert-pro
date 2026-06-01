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

export interface ExamAnswer {
  id: string;
  examSessionId: string;
  questionId: string;
  selectedAnswers: string[];
  isCorrect: boolean;
  timeSpent: number; // in seconds
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
