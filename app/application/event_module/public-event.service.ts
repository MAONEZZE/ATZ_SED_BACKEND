import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';

/**
 * Read-only queries backing the public (unauthenticated) event pages.
 * Centralizes the "is this event visible?" gating that was copy-pasted across
 * the public controllers.
 */
@Injectable()
export class PublicEventService {
  constructor(@Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort) {}

  async getPublicEvent(slug: string) {
    const event = await this.eventRepo.findPublicBySlug(slug);
    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new NotFoundException('Event not found');
    }

    return {
      ...event,
      // @deprecated Configurações de formulário não vivem no evento: cada item de
      // GET /public/events/:slug/forms traz as suas. Mantidos com valor neutro só
      // até o frontend parar de ler daqui.
      description: null,
      postRegistrationMessage: null,
      linkPostSubscription: null,
      requireImageAuthorization: false,
    };
  }
}
