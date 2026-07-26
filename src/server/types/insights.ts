// Domain proficiency data
export interface DomainProficiency {
  domainId: string;
  domainName: string;
  proficiencyScore: number; // 0-100
  domainWeight: number; // 0-100
  questionsAttempted: number;
  questionsCorrect: number;
}

// Topic-level proficiency
export interface TopicProficiency {
  topicId: string;
  topicName: string;
  domainId: string;
  proficiencyScore: number;
  questionsAttempted: number;
  questionsCorrect: number;
}

// Subtopic-level proficiency
export interface SubtopicProficiency {
  subtopicId: string;
  subtopicName: string;
  topicId: string;
  proficiencyScore: number;
  questionsAttempted: number;
  questionsCorrect: number;
  questionsIncorrect?: number;
  hasInsufficientData: boolean; // true if < 3 questions
}

// Readiness score with breakdown
export interface ReadinessScore {
  overallScore: number; // 0-100
  domainScores: DomainProficiency[];
  consistencyScore: number;
  pacingScore: number;
  recentTrend: 'improving' | 'stable' | 'declining';
  greenLightStatus: 'green' | 'yellow' | 'red';
  criteriaForGreen: string[];
}

// Double-down metric
export interface DoubleDownMetric {
  domainId: string;
  domainName: string;
  proficiencyScore: number;
  domainWeight: number;
  priorityScore: number; // (100 - proficiency) * weight
}

// Time analysis
export interface TimeAnalysis {
  avgTimeCorrect: number; // seconds
  avgTimeIncorrect: number; // seconds
  dangerZoneWarning: boolean; // true if avgTimeIncorrect > 180
  projectedCompletionTime: number; // seconds
  pacingAlert: boolean; // true if projected > 90% of exam duration
}

// Hesitation analysis
export interface HesitationAnalysis {
  totalChanges: number;
  correctToIncorrectPct: number;
  incorrectToCorrectPct: number;
  confidenceWarning: boolean; // true if correctToIncorrect > 20%
}

// Fatigue analysis
export interface FatigueAnalysis {
  quartiles: QuartileData[];
  fatigueDetected: boolean; // true if drop > 15%
  recommendation: string | null;
}

export interface QuartileData {
  quartile: number; // 1-4
  accuracyPct: number;
  questionsAnswered: number;
}

// Certainty matrix
export interface CertaintyMatrix {
  highConfidenceCorrect: { count: number; percentage: number };
  highConfidenceIncorrect: { count: number; percentage: number };
  lowConfidenceCorrect: { count: number; percentage: number };
  lowConfidenceIncorrect: { count: number; percentage: number };
}

// Consistency metric
export interface ConsistencyMetric {
  recentSessions: SessionScore[];
  standardDeviation: number;
  hasHighVariance: boolean; // true if stdDev > 10
  insufficientData: boolean; // true if < 5 sessions
}

export interface SessionScore {
  sessionId: string;
  date: string;
  score: number;
  sessionName: string;
}

// Community benchmark
export interface CommunityBenchmark {
  domainId?: string;
  topicId?: string;
  name: string;
  communityAverage: number;
  userScore: number;
  difference: number; // userScore - communityAverage
  needsImprovement: boolean;
  typicalPassingThreshold: number;
}

// ROI score
export interface ROIScore {
  topicId: string;
  topicName: string;
  domainId: string;
  currentProficiency: number;
  domainWeight: number;
  availableQuestions: number;
  roiScore: number; // calculated metric
  estimatedScoreIncrease: number; // per hour of study
}

// Study list item
export interface StudyListItem {
  topicId: string;
  topicName: string;
  subtopics: string[];
  incorrectCount: number;
  docUrl: string | null;
  priority: number;
}

// Filter options for analytics
export interface FilterOptions {
  examType?: 'mock' | 'practice';
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed' | 'all';
}

// Unit-level proficiency (for Subtopic → Unit drill-down)
export interface UnitProficiency {
  unitId: string;
  unitName: string;
  subtopicId: string;
  proficiencyScore: number; // 0-100
  questionsAttempted: number;
  questionsCorrect: number;
  hasInsufficientData: boolean; // true when questionsAttempted < 3
}
