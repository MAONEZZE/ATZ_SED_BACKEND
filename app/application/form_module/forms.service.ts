import { Injectable } from '@nestjs/common';
import { FormsRepository } from '@infra/repositories/form_module/forms.repository';
import { FormKind } from '@domain/shared/form-kind.type';

export interface UpdateFormInput {
  description?: string;
  postRegistrationMessage?: string;
  linkPostSubscription?: string;
  requireImageAuthorization?: boolean;
}

@Injectable()
export class FormsService {
  constructor(private readonly repo: FormsRepository) {}

  /** Metadata for (eventId, kind); creates an empty row on first access (every form scope is lazily materialized). */
  async getOrCreate(eventId: string, kind: FormKind) {
    const existing = await this.repo.findByEventAndKind(eventId, kind);
    if (existing) return existing;
    return this.repo.create(eventId, kind);
  }

  async update(eventId: string, kind: FormKind, input: UpdateFormInput) {
    const form = await this.getOrCreate(eventId, kind);
    return this.repo.update(form.id, {
      ...(input.description !== undefined && { description: input.description }),
      ...(input.postRegistrationMessage !== undefined && {
        postRegistrationMessage: input.postRegistrationMessage,
      }),
      ...(input.linkPostSubscription !== undefined && {
        linkPostSubscription: input.linkPostSubscription,
      }),
      ...(input.requireImageAuthorization !== undefined && {
        requireImageAuthorization: input.requireImageAuthorization,
      }),
    });
  }
}
