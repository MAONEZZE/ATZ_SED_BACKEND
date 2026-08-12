import { Inject, Injectable } from '@nestjs/common';
import { FormKind } from '@domain/shared/form-kind.type';
import {
  FORM_REPOSITORY_PORT,
  FormRepositoryPort,
  UpdateFormData,
} from '@domain/form_module/i-repository-form';

@Injectable()
export class FormService {
  constructor(@Inject(FORM_REPOSITORY_PORT) private readonly repo: FormRepositoryPort) {}

  /** Metadata for (eventId, kind); creates an empty row on first access (every form scope is lazily materialized). */
  async getOrCreate(eventId: string, kind: FormKind) {
    const existing = await this.repo.findByEventAndKind(eventId, kind);
    if (existing) return existing;
    return this.repo.create(eventId, kind);
  }

  async update(eventId: string, kind: FormKind, input: UpdateFormData) {
    const form = await this.getOrCreate(eventId, kind);
    return this.repo.update(form.id, input);
  }
}
