import type { Database } from 'better-sqlite3';
import { db as defaultDb } from '../db/connection';
import type {
  DomainProficiency,
  TopicProficiency,
  SubtopicProficiency,
  UnitProficiency,
  TimeAnalysis,
  HesitationAnalysis,
  ReadinessScore,
  ConsistencyMetric,
  FatigueAnalysis,
  CertaintyMatrix,
  DoubleDownMetric,
  FilterOptions,
} from '../types/insights';
import { ProficiencyAnalytics } from './analytics/ProficiencyAnalytics';
import { TimeAnalytics } from './analytics/TimeAnalytics';
import { ReadinessAnalytics } from './analytics/ReadinessAnalytics';

export class AnalyticsService {
  private db: Database;
  private proficiencyAnalytics: ProficiencyAnalytics;
  private timeAnalytics: TimeAnalytics;
  private readinessAnalytics: ReadinessAnalytics;

  constructor(db?: Database) {
    this.db = db ?? defaultDb;
    this.proficiencyAnalytics = new ProficiencyAnalytics(this.db);
    this.timeAnalytics = new TimeAnalytics(this.db);
    this.readinessAnalytics = new ReadinessAnalytics(
      this.db,
      this.proficiencyAnalytics,
      this.timeAnalytics,
    );
  }

  calculateDomainProficiency(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): DomainProficiency[] {
    return this.proficiencyAnalytics.calculateDomainProficiency(
      userId,
      certificationId,
      filterOptions,
    );
  }

  calculateTopicProficiency(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): TopicProficiency[] {
    return this.proficiencyAnalytics.calculateTopicProficiency(
      userId,
      certificationId,
      filterOptions,
    );
  }

  calculateSubtopicProficiency(userId: string, certificationId: string): SubtopicProficiency[] {
    return this.proficiencyAnalytics.calculateSubtopicProficiency(userId, certificationId);
  }

  calculateUnitProficiency(userId: string, certificationId: string): UnitProficiency[] {
    return this.proficiencyAnalytics.calculateUnitProficiency(userId, certificationId);
  }

  analyzeTimePerQuestion(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): TimeAnalysis {
    return this.timeAnalytics.analyzeTimePerQuestion(userId, certificationId, filterOptions);
  }

  analyzeHesitationPatterns(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): HesitationAnalysis {
    return this.timeAnalytics.analyzeHesitationPatterns(userId, certificationId, filterOptions);
  }

  calculateConsistencyMetric(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): ConsistencyMetric {
    return this.timeAnalytics.calculateConsistencyMetric(userId, certificationId, filterOptions);
  }

  calculateFatigueFactor(sessionId: string): FatigueAnalysis {
    return this.timeAnalytics.calculateFatigueFactor(sessionId);
  }

  calculateReadinessScore(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): ReadinessScore | null {
    return this.readinessAnalytics.calculateReadinessScore(userId, certificationId, filterOptions);
  }

  generateCertaintyMatrix(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): CertaintyMatrix {
    return this.readinessAnalytics.generateCertaintyMatrix(userId, certificationId, filterOptions);
  }

  identifyDoubleDownMetric(
    userId: string,
    certificationId: string,
    filterOptions: FilterOptions = {},
  ): DoubleDownMetric | null {
    return this.readinessAnalytics.identifyDoubleDownMetric(userId, certificationId, filterOptions);
  }
}
