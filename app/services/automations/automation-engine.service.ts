import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@database/prisma/prisma.service';
import { OutboxService } from '@services/messaging/outbox.service';
import { TemplateRenderer } from './template-renderer.service';
import { RegistrationStatusChanged } from '@domain/registrations/entities/registration-status-changed.event';
import { FormSubmitted } from '@domain/registrations/entities/form-submitted.event';

const TRIGGER_MAP: Partial<Record<string, string>> = {
  pending: 'on_registration',
  approved: 'on_approval',
  rejected: 'on_rejection',
};

@Injectable()
export class AutomationEngine {
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
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
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
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
    const rules = await this.prisma.automationRule.findMany({
      where: {
        eventId,
        trigger: trigger as any,
        active: true,
        // Disparo imediato: delayMinutes null OU 0 (robustez contra regras gravadas com 0).
        ...(ruleIds
          ? { id: { in: ruleIds } }
          : { OR: [{ delayMinutes: null }, { delayMinutes: 0 }] }),
      },
      include: { template: true },
    });

    if (!rules.length) return;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { owner: true },
    });

    if (!event) {
      this.logger.warn({ eventId }, 'Event not found for automation');
      return;
    }

    const instancia = event.evolutionInstance ?? event.owner.evolutionInstance ?? undefined;

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
