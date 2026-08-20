import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { EventEntity } from '@domain/event_module/event.entity';
import { OutboxService } from '@application/outbox_module/outbox.service';
import { FORM_REPOSITORY_PORT, FormRepositoryPort } from '@domain/form_module/i-repository-form';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';
import { RecurringSchedulerService } from '@application/automation_module/recurring-scheduler.service';
import {
  AUTOMATION_REPOSITORY_PORT,
  AutomationRepositoryPort,
} from '@domain/automation_module/i-repository-automation';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@domain/registration_module/i-repository-registration';
import {
  MESSAGE_TEMPLATE_REPOSITORY_PORT,
  MessageTemplateRepositoryPort,
} from '@domain/message_template_module/i-repository-message-template';

@Injectable()
export class EventLifecycleService {
  private readonly logger = new Logger(EventLifecycleService.name);

  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly scheduler: RecurringSchedulerService,
    private readonly outbox: OutboxService,
    @Inject(FORM_REPOSITORY_PORT) private readonly forms: FormRepositoryPort,
    @Inject(AUTOMATION_REPOSITORY_PORT)
    private readonly automations: AutomationRepositoryPort,
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly registrations: RegistrationRepositoryPort,
    @Inject(MESSAGE_TEMPLATE_REPOSITORY_PORT)
    private readonly templates: MessageTemplateRepositoryPort,
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

    // `createWithFields` preserva o slug do formulário original, então
    // (novoEventId, slug) resolve o formId novo para remapear os formIds da
    // regra (a fonte só tem os slugs — o id antigo não existe no evento novo).
    const newFormIdBySlug = new Map<string, string>();
    for (const form of source.forms) {
      const created = await this.forms.createWithFields(newEvent.id, form);
      newFormIdBySlug.set(created.slug, created.id);
    }

    if (source.automationRules.length > 0) {
      const createdRules = await this.automations.createManyForDuplication(
        newEvent.id,
        source.automationRules.map(({ formSlugs, ...rule }) => ({
          ...rule,
          // A data de uma regra `on_date` é do evento de origem e pode já ter
          // passado: copiar ativa faria a duplicação disparar tudo na varredura
          // seguinte. Nasce inativa, e reativar exige data nova (400 se passada).
          active: AutomationRuleEntity.isDate(rule.trigger) ? false : rule.active,
          // Formulário do evento de origem que não existe mais aqui (raro: só se
          // a criação de formulários acima falhar parcialmente) é descartado em
          // vez de travar a duplicação inteira.
          formIds: formSlugs
            .map((slug) => newFormIdBySlug.get(slug))
            .filter((id): id is string => id !== undefined),
        })),
      );

      // Regra `recurring` sem job scheduler no BullMQ fica ativa e muda: ela só
      // voltaria a disparar no próximo boot, quando o `syncAll` do
      // RecurringAutomationsWorker reconcilia. Registrar aqui fecha essa janela.
      for (const rule of createdRules) {
        if (rule.trigger === 'recurring' && rule.active && rule.cron && rule.timezone) {
          await this.scheduler.upsert({ id: rule.id, cron: rule.cron, timezone: rule.timezone });
        }
      }
    }

    this.logger.log({ sourceId: eventId, newId: newEvent.id }, 'Event duplicated');
    return new EventEntity(
      newEvent.id,
      newEvent.ownerId,
      newEvent.title,
      newEvent.slug,
      'draft',
    );
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
