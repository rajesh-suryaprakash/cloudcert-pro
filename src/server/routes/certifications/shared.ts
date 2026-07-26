import { db } from '../../db/connection';
import { CertificationRepository } from '../../repositories/CertificationRepository';
import { QuestionRepository } from '../../repositories/QuestionRepository';
import { UnitRepository } from '../../repositories/UnitRepository';
import { CertificationService } from '../../services/CertificationService';
import { QuestionHistoryService } from '../../services/QuestionHistoryService';

export const certRepo = new CertificationRepository(db);
export const questionRepo = new QuestionRepository(db);
export const unitRepo = new UnitRepository(db);
export const certService = new CertificationService(certRepo, questionRepo, unitRepo);
export const questionHistoryService = new QuestionHistoryService(db);
