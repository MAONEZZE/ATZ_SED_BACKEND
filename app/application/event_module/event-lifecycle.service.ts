import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { EventEntity } from '@domain/event_module/event.entity';
import { OutboxService } from '@modules/messaging/outbox.service';
import { FormsRepository } from '@infra/repositories/form_module/forms.repository';
import { AutomationsRepository } from '@modules/automations/automations.repository';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@domain/registration_module/i-repository-registration';
import { MessageTemplatesRepository } from '@modules/messaging/message-templates.repository';

@Injectable()
export class EventLifecycleService {
  private readonly logger = new Logger(EventLifecycleService.name);

  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly outbox: OutboxService,
    private readonly forms: FormsRepository,
    private readonly automations: AutomationsRepository,
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly registrations: RegistrationRepositoryPort,
    private readonly templates: MessageTemplatesRepository,
  ) {}

  async cancel(
    eventId: string,
    notifyParticipants: boolean,
    editorId?: string,
  ): Promise<EventEntity> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (!event.canTransitionTo('cancelled')) {
      throw new BadRequestException(`Cannot cancel event in status '${event.status}'`);
    }

    const updated = await this.eventRepo.updateStatus(eventId, 'cancelled', editorId);

    if (notifyParticipants) {
      await this.notifyCancellation(event);
    }

    return updated;
  }

  async duplicate(eventId: string, ownerId: string): Promise<EventEntity> {
    const source = await this.eventRepo.findDuplicationSource(eventId);
    if (!source) throw new NotFoundException('Event not found');

    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const newSlug = EventEntity.generateSlug(`${source.title} copia`, suffix);

    const newEvent = await this.eventRepo.createDuplicate({
      ownerId,
      title: `${source.title} (cópia)`,
      slug: newSlug,
      location: source.location,
      capacity: source.capacity,
      dressCode: source.dressCode,
      groupLink: source.groupLink,
      eventDate: source.eventDate,
      endDate: source.endDate,
      sendToPipedrive: source.sendToPipedrive,
      lastEditedById: ownerId,
    });

    for (const form of source.forms) {
      await this.forms.createWithFields(newEvent.id, form);
    }

    if (source.automationRules.length > 0) {
      await this.automations.createManyForDuplication(newEvent.id, source.automationRules);
    }

    this.logger.log({ sourceId: eventId, newId: newEvent.id }, 'Event duplicated');
    return new EventEntity(newEvent.id, newEvent.ownerId, newEvent.title, newEvent.slug, 'draft');
  }

  private async notifyCancellation(event: EventEntity): Promise<void> {
    const registrations = await this.registrations.findActiveByEvent(event.id);
    const template = await this.templates.findFirstForOwner(event.ownerId);

    if (!template) {
      this.logger.warn({ eventId: event.id }, 'No template found for cancellation notification');
      return;
    }

    for (const reg of registrations) {
      try {
        await this.outbox.enqueue({
          eventId: event.id,
          ownerId: event.ownerId,
          registrationId: reg.id,
          templateId: template.id,
          trigger: 'on_cancellation',
          channel: template.channel,
          recipient: template.channel === 'email' ? reg.email : reg.phone,
          renderedBody: `O evento "${event.title}" foi cancelado. Lamentamos o inconveniente.`,
          renderedSubject: `Evento cancelado: ${event.title}`,
        });
      } catch (err) {
        this.logger.error(
          { err, registrationId: reg.id },
          'Failed to enqueue cancellation notification',
        );
      }
    }
  }
}
