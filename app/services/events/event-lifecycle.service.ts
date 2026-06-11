import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/events/ports/event-repository.port';
import { EventEntity } from '@domain/events/entities/event.entity';
import { OutboxService } from '@services/messaging/outbox.service';
import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class EventLifecycleService {
  private readonly logger = new Logger(EventLifecycleService.name);

  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly outbox: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  async cancel(eventId: string, notifyParticipants: boolean): Promise<EventEntity> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (!event.canTransitionTo('cancelled')) {
      throw new BadRequestException(`Cannot cancel event in status '${event.status}'`);
    }

    const updated = await this.eventRepo.updateStatus(eventId, 'cancelled');

    if (notifyParticipants) {
      await this.notifyCancellation(event);
    }

    return updated;
  }

  async duplicate(eventId: string, ownerId: string): Promise<EventEntity> {
    const source = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { formFields: true, templates: true, automationRules: true },
    });
    if (!source) throw new NotFoundException('Event not found');

    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const newSlug = EventEntity.generateSlug(`${source.title} copia`, suffix);

    // 1. Create event + form fields
    const newEvent = await this.prisma.event.create({
      data: {
        ownerId,
        title: `${source.title} (cópia)`,
        slug: newSlug,
        description: source.description,
        location: source.location,
        capacity: source.capacity,
        dressCode: source.dressCode,
        groupLink: source.groupLink,
        eventDate: source.eventDate,
        endDate: source.endDate,
        postRegistrationMessage: source.postRegistrationMessage,
        status: 'draft',
        formFields: {
          create: source.formFields.map((f) => ({
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options ?? undefined,
            order: f.order,
            isFixed: f.isFixed,
          })),
        },
      },
    });

    // 2. Copy templates one-by-one to capture new IDs for automation remapping
    const templateMap = new Map<string, string>();
    for (const t of source.templates) {
      const newTemplate = await this.prisma.messageTemplate.create({
        data: {
          eventId: newEvent.id,
          name: t.name,
          channel: t.channel,
          subject: t.subject,
          body: t.body,
        },
      });
      templateMap.set(t.id, newTemplate.id);
    }

    // 3. Copy automations with remapped templateId
    if (source.automationRules.length > 0) {
      await this.prisma.automationRule.createMany({
        data: source.automationRules.map((a) => ({
          eventId: newEvent.id,
          templateId: templateMap.get(a.templateId) ?? a.templateId,
          trigger: a.trigger,
          delayMinutes: a.delayMinutes ?? undefined,
          active: a.active,
        })),
      });
    }

    this.logger.log({ sourceId: eventId, newId: newEvent.id }, 'Event duplicated');
    return new EventEntity(newEvent.id, newEvent.ownerId, newEvent.title, newEvent.slug, 'draft');
  }

  private async notifyCancellation(event: EventEntity): Promise<void> {
    const registrations = await this.prisma.registration.findMany({
      where: { eventId: event.id, status: { in: ['approved', 'pending', 'waitlist'] } },
    });

    const template = await this.prisma.messageTemplate.findFirst({
      where: { eventId: event.id },
    });

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
