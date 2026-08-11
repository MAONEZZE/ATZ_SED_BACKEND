import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AutomationsRepository } from '@modules/automations/automations.repository';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@modules/registrations/ports/registration-repository.port';
import { OutboxService } from '@modules/messaging/outbox.service';
import { TemplateRenderer } from './template-renderer.service';
import { RegistrationStatusChanged } from '@modules/registrations/entities/registration-status-changed.event';
import { FormSubmitted } from '@modules/registrations/entities/form-submitted.event';

const TRIGGER_MAP: Partial<Record<string, string>> = {
  pending: 'on_registration',
  approved: 'on_approval',
  rejected: 'on_rejection',
};

@Injectable()
export class AutomationEngine {
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    private readonly automations: AutomationsRepository,
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly registrations: RegistrationRepositoryPort,
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
  ) {}

  @OnEvent('registration.status_changed')
  async handleStatusChanged(ev: RegistrationStatusChanged): Promise<void> {
    const trigger = TRIGGER_MAP[ev.newStatus];
    if (!trigger) return;

    try {
      await this.fireAutomations(ev.registrationId, ev.eventId, trigger);
    } catch (err) {
      this.logger.error(
        { err, registrationId: ev.registrationId, trigger },
        'AutomationEngine error',
      );
    }
  }

  @OnEvent('form.submitted')
  async handleFormSubmitted(ev: FormSubmitted): Promise<void> {
    try {
      await this.fireForContact(ev.eventId, ev.trigger, ev.contact);
    } catch (err) {
      this.logger.error(
        { err, eventId: ev.eventId, trigger: ev.trigger },
        'AutomationEngine form.submitted error',
      );
    }
  }

  async fireAutomations(
    registrationId: string,
    eventId: string,
    trigger: string,
    ruleIds?: string[],
  ): Promise<void> {
    const registration = await this.registrations.findById(registrationId);
    if (!registration) {
      this.logger.warn({ registrationId, eventId }, 'Registration not found for automation');
      return;
    }

    await this.dispatchTrigger(
      eventId,
      trigger,
      {
        registrationId,
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
      },
      ruleIds,
    );
  }

  /**
   * Fires automations for a contact that may not have a Registration row
   * (post-event / NPS submissions). Cross-form triggers use this path.
   */
  async fireForContact(
    eventId: string,
    trigger: string,
    contact: { name: string; email: string; phone: string },
    ruleIds?: string[],
  ): Promise<void> {
    await this.dispatchTrigger(eventId, trigger, contact, ruleIds);
  }

  private async dispatchTrigger(
    eventId: string,
    trigger: string,
    contact: { registrationId?: string; name: string; email: string; phone: string },
    ruleIds?: string[],
  ): Promise<void> {
    const rules = await this.automations.findActiveTriggerRules(eventId, trigger, ruleIds);

    if (!rules.length) return;

    const event = await this.eventRepo.findAutomationContext(eventId);

    if (!event) {
      this.logger.warn({ eventId }, 'Event not found for automation');
      return;
    }

    // `instancia` carrega o token Whatsapp da instância (auth por token).
    const instancia = event.whatsappToken ?? undefined;

    for (const rule of rules) {
      const vars = this.renderer.buildVariables({
        registration: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
        },
        event: {
          title: event.title,
          eventDate: event.eventDate,
          location: event.location,
          capacity: event.capacity,
          dressCode: event.dressCode,
          groupLink: event.groupLink,
        },
      });

      const renderedBody = this.renderer.render(rule.template.body, vars);
      const renderedSubject = rule.template.subject
        ? this.renderer.render(rule.template.subject, vars)
        : undefined;

      // O convite .ics é gerado pelo MessageDispatchWorker quando o corpo contém o
      // marcador {{invite}} (ICS_MARKER) — ele regenera a partir do evento (com endDate).
      // Não geramos ics aqui para não duplicar a lógica.
      const recipient = rule.template.channel === 'email' ? contact.email : contact.phone;
      const dedupKey = contact.registrationId
        ? undefined
        : `${eventId}:${(contact.email || contact.phone).toLowerCase()}:${rule.templateId}:${trigger}`;

      await this.outbox.enqueue(
        {
          eventId: event.id,
          ownerId: event.ownerId,
          registrationId: contact.registrationId,
          templateId: rule.templateId,
          trigger,
          dedupKey,
          channel: rule.template.channel,
          recipient,
          instancia: instancia ?? undefined,
          renderedBody,
          renderedSubject,
        },
        // Espaça os disparos de WhatsApp entre contatos distintos (anti-ban).
        instancia ? { paceInstancia: instancia } : undefined,
      );
    }
  }
}
