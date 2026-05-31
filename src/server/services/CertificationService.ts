import type { CertificationRepository } from '../repositories/CertificationRepository';
import type { QuestionRepository, CreateQuestionDto } from '../repositories/QuestionRepository';
import type { UnitRepository } from '../repositories/UnitRepository';
import type { CreateUnitDto } from '../db-types';
import { ValidationError, NotFoundError } from '../errors';
import { isValidUrl, ALLOWED_CERT_LEVELS } from '../validation';

export interface CreateCertificationInput {
  title: string;
  vendor: string;
  description: string;
  level?: string;
  examCode?: string;
  url?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export interface UpdateCertificationInput {
  title: string;
  vendor: string;
  description: string;
  level?: string;
  examCode?: string;
  url?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export interface CreateTopicInput {
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface UpdateTopicInput {
  title?: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
  docUrl?: string | null;
}

export interface CreateSubTopicInput {
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface UpdateSubTopicInput {
  title?: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface CreateExamConfigInput {
  name: string;
  description?: string;
  duration: number;
  totalQuestions: number;
  passingScore: number;
  questionSelectionStrategy?: string;
  topicWeights?: Record<string, number>;
  isActive?: boolean;
}

export class CertificationService {
  constructor(
    private readonly certRepo: CertificationRepository,
    private readonly questionRepo: QuestionRepository,
    private readonly unitRepo?: UnitRepository,
  ) {}

  // ── Certifications ──────────────────────────────────────────────────────────

  createCertification(data: CreateCertificationInput): string {
    const { title, vendor, description, level, examCode, url, iconUrl, isActive } = data;

    if (!title || title.length < 5 || title.length > 255) {
      throw new ValidationError('Title must be between 5 and 255 characters');
    }
    if (level && !ALLOWED_CERT_LEVELS.includes(level as (typeof ALLOWED_CERT_LEVELS)[number])) {
      throw new ValidationError('Invalid level');
    }
    if (url && !isValidUrl(url)) throw new ValidationError('Invalid URL format');
    if (iconUrl && !isValidUrl(iconUrl)) throw new ValidationError('Invalid Icon URL format');

    const resolvedLevel = level || 'Associate';
    if (this.certRepo.findByTitleAndLevel(title, resolvedLevel)) {
      throw new ValidationError('Title and level combination must be unique');
    }

    return this.certRepo.create({
      title,
      vendor,
      description,
      level: resolvedLevel,
      examCode,
      url,
      iconUrl,
      isActive,
    });
  }

  updateCertification(id: string, data: UpdateCertificationInput): void {
    const { title, vendor, description, level, examCode, url, iconUrl, isActive } = data;

    if (!title || title.length < 5 || title.length > 255) {
      throw new ValidationError('Title must be between 5 and 255 characters');
    }
    if (level && !ALLOWED_CERT_LEVELS.includes(level as (typeof ALLOWED_CERT_LEVELS)[number])) {
      throw new ValidationError('Invalid level');
    }

    const resolvedLevel = level || 'Associate';
    if (this.certRepo.findByTitleAndLevel(title, resolvedLevel, id)) {
      throw new ValidationError('Title and level combination must be unique');
    }

    this.certRepo.update(id, {
      title,
      vendor,
      description,
      level: resolvedLevel,
      examCode,
      url,
      iconUrl,
      isActive,
    });

    if (isActive === false) {
      this.certRepo.deactivateTopics(id);
    }
  }

  deleteCertification(id: string): void {
    if (this.certRepo.countActiveSessions(id) > 0) {
      throw new ValidationError('Cannot delete certification with active exam sessions');
    }
    if (this.certRepo.countExamsByCertification(id) > 0) {
      throw new ValidationError(
        'Cannot delete certification that has exam configurations. Delete all exam configurations first.',
      );
    }
    if (this.certRepo.countTopicsByCertification(id) > 0) {
      throw new ValidationError(
        'Cannot delete certification that has topics. Delete all topics (and their subtopics and questions) first.',
      );
    }
    this.certRepo.delete(id);
  }

  // ── Topics ──────────────────────────────────────────────────────────────────

  createTopic(certificationId: string, data: CreateTopicInput): string {
    const { title, description, orderIndex, isActive } = data;

    if (!title || title.length < 3 || title.length > 255) {
      throw new ValidationError('Title must be between 3 and 255 characters');
    }

    try {
      return this.certRepo.createTopic({
        certificationId,
        title,
        description,
        orderIndex,
        isActive,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new ValidationError('Topic title must be unique within a certification');
      }
      throw err;
    }
  }

  updateTopic(id: string, data: UpdateTopicInput): void {
    const current = this.certRepo.findTopicById(id);
    if (!current) throw new NotFoundError('Topic not found');
    if (data.docUrl !== null && data.docUrl !== undefined && !data.docUrl.startsWith('https://')) {
      throw new ValidationError('docUrl must start with https://');
    }
    this.certRepo.updateTopic(id, data, current);
  }

  deleteTopic(id: string): void {
    if (this.certRepo.countSubTopicsByTopic(id) > 0) {
      throw new ValidationError(
        'Cannot delete topic that has subtopics. Delete all subtopics (and their questions) first.',
      );
    }
    if (this.certRepo.countQuestionsByTopic(id) > 0) {
      throw new ValidationError(
        'Cannot delete topic that has questions. Delete all questions first.',
      );
    }
    this.certRepo.deleteTopic(id);
  }

  // ── SubTopics ────────────────────────────────────────────────────────────────

  createSubTopic(topicId: string, data: CreateSubTopicInput): string {
    return this.certRepo.createSubTopic({ topicId, ...data });
  }

  updateSubTopic(id: string, data: UpdateSubTopicInput): void {
    const current = this.certRepo.findSubTopicById(id);
    if (!current) throw new NotFoundError('Subtopic not found');
    this.certRepo.updateSubTopic(id, data, current);
  }

  deleteSubTopic(id: string): void {
    if (this.certRepo.countQuestionsBySubTopic(id) > 0) {
      throw new ValidationError(
        'Cannot delete subtopic that has questions. Delete all questions first.',
      );
    }
    this.certRepo.deleteSubTopic(id);
  }

  // ── Questions ────────────────────────────────────────────────────────────────

  createQuestion(topicId: string, data: Omit<CreateQuestionDto, 'topicId' | 'subTopicId'>): string {
    return this.questionRepo.createQuestion({ ...data, topicId, subTopicId: null });
  }

  createSubTopicQuestion(
    subtopicId: string,
    data: Omit<CreateQuestionDto, 'topicId' | 'subTopicId'>,
  ): string {
    const subtopic = this.certRepo.findSubTopicById(subtopicId);
    if (!subtopic) throw new NotFoundError('Subtopic not found');
    return this.questionRepo.createQuestion({
      ...data,
      topicId: subtopic.topicId,
      subTopicId: subtopicId,
    });
  }

  updateQuestion(id: string, data: Omit<CreateQuestionDto, 'topicId' | 'subTopicId'>): void {
    this.questionRepo.updateQuestion(id, data);
  }

  deleteQuestion(id: string): void {
    this.questionRepo.deleteQuestion(id);
  }

  // ── Units ────────────────────────────────────────────────────────────────────

  createUnit(subTopicId: string, dto: Omit<CreateUnitDto, 'subTopicId'>): string {
    if (!this.unitRepo) {
      throw new Error('UnitRepository not available');
    }
    const subtopic = this.certRepo.findSubTopicById(subTopicId);
    if (!subtopic) throw new NotFoundError('Subtopic not found');
    return this.unitRepo.createUnit({ subTopicId, ...dto });
  }

  updateUnit(id: string, dto: Partial<CreateUnitDto>): void {
    if (!this.unitRepo) {
      throw new Error('UnitRepository not available');
    }
    const current = this.unitRepo.findUnitById(id);
    if (!current) throw new NotFoundError('Unit not found');
    this.unitRepo.updateUnit(id, dto, current);
  }

  deleteUnit(id: string): void {
    if (!this.unitRepo) {
      throw new Error('UnitRepository not available');
    }
    this.unitRepo.deleteUnit(id);
  }

  createUnitQuestion(
    unitId: string,
    data: Omit<CreateQuestionDto, 'topicId' | 'subTopicId' | 'unitId'>,
  ): string {
    if (!this.unitRepo) {
      throw new Error('UnitRepository not available');
    }
    // Fetch unit by unitId
    const unit = this.unitRepo.findUnitById(unitId);
    if (!unit) throw new NotFoundError('Unit not found');

    // Fetch subtopic by unit.subTopicId
    const subtopic = this.certRepo.findSubTopicById(unit.subTopicId);
    if (!subtopic) throw new NotFoundError('Subtopic not found');

    // Fetch topic by subtopic.topicId
    const topic = this.certRepo.findTopicById(subtopic.topicId);
    if (!topic) throw new NotFoundError('Topic not found');

    // Insert question with unitId, subTopicId, and topicId all set
    return this.questionRepo.createQuestion({
      ...data,
      unitId,
      subTopicId: unit.subTopicId,
      topicId: topic.id,
    });
  }

  // ── Exam Configurations ──────────────────────────────────────────────────────

  deleteExamConfig(id: string): void {
    if (this.certRepo.countSessionsByExamConfig(id) > 0) {
      throw new ValidationError(
        'Cannot delete exam configuration that has exam sessions. All associated sessions must be completed or abandoned first.',
      );
    }
    this.certRepo.deleteExamConfig(id);
  }

  updateExamConfig(id: string, data: CreateExamConfigInput): void {
    const {
      name,
      description,
      duration,
      totalQuestions,
      passingScore,
      questionSelectionStrategy,
      topicWeights,
      isActive,
    } = data;

    if (!name || name.length < 5 || name.length > 255)
      throw new ValidationError('Name must be between 5 and 255 characters');
    if (duration < 15 || duration > 480)
      throw new ValidationError('Duration must be between 15 and 480 minutes');
    if (totalQuestions < 5 || totalQuestions > 500)
      throw new ValidationError('Total questions must be between 5 and 500');
    if (passingScore < 0 || passingScore > 100)
      throw new ValidationError('Passing score must be between 0 and 100');

    this.certRepo.updateExamConfig(id, {
      name,
      description,
      duration,
      totalQuestions,
      passingScore,
      questionSelectionStrategy,
      topicWeights,
      isActive,
    });
  }

  createExamConfig(certificationId: string, data: CreateExamConfigInput): string {
    const {
      name,
      description,
      duration,
      totalQuestions,
      passingScore,
      questionSelectionStrategy,
      topicWeights,
      isActive,
    } = data;

    if (!name || name.length < 5 || name.length > 255)
      throw new ValidationError('Name must be between 5 and 255 characters');
    if (duration < 15 || duration > 480)
      throw new ValidationError('Duration must be between 15 and 480 minutes');
    if (totalQuestions < 5 || totalQuestions > 500)
      throw new ValidationError('Total questions must be between 5 and 500');
    if (passingScore < 0 || passingScore > 100)
      throw new ValidationError('Passing score must be between 0 and 100');

    return this.certRepo.createExamConfig(certificationId, {
      name,
      description,
      duration,
      totalQuestions,
      passingScore,
      questionSelectionStrategy,
      topicWeights,
      isActive,
    });
  }
}
