import type { UnitRepository } from '../repositories/UnitRepository';
import type { CertificationRepository } from '../repositories/CertificationRepository';
import type { CreateUnitDto } from '../db-types';
import { NotFoundError } from '../errors';

export class UnitService {
  constructor(
    private readonly unitRepo: UnitRepository,
    private readonly certRepo: CertificationRepository,
  ) {}

  createUnit(subTopicId: string, dto: Omit<CreateUnitDto, 'subTopicId'>): string {
    const subtopic = this.certRepo.findSubTopicById(subTopicId);
    if (!subtopic) throw new NotFoundError('Subtopic not found');
    return this.unitRepo.createUnit({ subTopicId, ...dto });
  }

  updateUnit(id: string, dto: Partial<CreateUnitDto>): void {
    const current = this.unitRepo.findUnitById(id);
    if (!current) throw new NotFoundError('Unit not found');
    this.unitRepo.updateUnit(id, dto, current);
  }

  deleteUnit(id: string): void {
    this.unitRepo.deleteUnit(id);
  }
}
