export interface UserRow {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  xp: number;
  resetPasswordToken: string | null;
  resetPasswordExpire: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ExamSessionRow {
  id: string;
  userId: string;
  examConfigurationId: string | null;
  topicId: string | null;
  questions: string;
  status: string;
  score: number | null;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  timeTaken: number | null;
  startTime: string;
  endTime: string | null;
  autoSubmitAt: string;
  isPracticeMode: number;
  isTopicQuiz: number;
  isCustomQuiz: number;
  isSRSReview: number;
  /** Wizard-supplied passing score override. NULL means use the exam config default. */
  passingScoreOverride: number | null;
}

export interface ExamAnswerRow {
  id: string;
  examSessionId: string;
  questionId: string;
  userAnswer: string | null;
  isCorrect: number | null;
  markedForReview: number;
  timeSpent: number;
  confidenceLevel: string | null;
  answerOrder: number;
}

export interface QuestionRow {
  id: string;
  topicId: string;
  subTopicId: string | null;
  unitId: string | null;
  questionText: string;
  questionType: string;
  options: string;
  correctAnswers: string;
  explanation: string | null;
  difficulty: string;
  tags: string;
  points: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicRow {
  id: string;
  certificationId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: number;
  // New fields for unified domain weight management
  weightPercentage: number | null;
  docUrl: string | null;
}

export interface SubTopicRow {
  id: string;
  topicId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: number;
}

export interface UnitRow {
  id: string;
  subTopicId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitDto {
  subTopicId: string;
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface ExamConfigRow {
  id: string;
  certificationId: string;
  name: string;
  duration: number;
  totalQuestions: number;
  passingScore: number;
  questionSelectionStrategy: string;
  topicWeights: string;
  isActive: number;
}
