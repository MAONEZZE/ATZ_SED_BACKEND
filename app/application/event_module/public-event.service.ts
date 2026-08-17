import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { FORM_REPOSITORY_PORT, FormRepositoryPort } from '@domain/form_module/i-repository-form';

/**
 * Read-only queries backing the public (unauthenticated) event pages.
 * Centralizes the "is this event visible?" gating that was copy-pasted across
 * the public controllers.
 */
@Injectable()
export class PublicEventService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(FORM_REPOSITORY_PORT) private readonly forms: FormRepositoryPort,
  ) {}

  async getPublicEvent(slug: string) {
    const event = await this.eventRepo.findPublicBySlug(slug);
    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new NotFoundException('Event not found');
    }

    // description/postRegistrationMessage vivem no Form, não no Event. Sem os 3
    // tipos fixos, a página pública usa o formulário principal (menor `order`).
    const [form] = await this.forms.listByEvent(event.id);

    return {
      ...event,
      description: form?.description ?? null,
      postRegistrationMessage: form?.postRegistrationMessage ?? null,
      linkPostSubscription: form?.linkPostSubscription ?? null,
      requireImageAuthorization: form?.requireImageAuthorization ?? false,
    };
  }

}
