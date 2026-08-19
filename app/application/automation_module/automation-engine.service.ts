import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AUTOMATION_REPOSITORY_PORT,
  AutomationRepositoryPort,
} from '@domain/automation_module/i-repository-automation';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@domain/registration_module/i-repository-registration';
import { OutboxService } from '@application/outbox_module/outbox.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import { RegistrationStatusChanged } from '@domain/registration_module/registration-status-changed.event';
import { FormSubmitted } from '@domain/registration_module/form-submitted.event';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';

const TRIGGER_MAP: Partial<Record<string, string>> = {
  pending: 'on_registration',
  approved: 'on_approval',
  rejected: 'on_rejection',
};

@Injectable()
export class AutomationEngine {
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY_PORT)
    private readonly automations: AutomationRepositoryPort,
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
      // Regra com formulários só vale para quem entrou por um deles; regra sem
      // (lista vazia) vale para qualquer origem.
      const rules = await this.automations.findActiveTriggerRules(ev.eventId, trigger);
      const ruleIds = rules
        .filter((r) => AutomationRuleEntity.matchesForm(r.formIds, ev.formId))
        .map((r) => r.id);
      if (!ruleIds.length) return;
      await this.fireAutomations(ev.registrationId, ev.eventId, trigger, ruleIds);
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
      await this.fireForForm(ev.eventId, ev.formId, ev.contact);
    } catch (err) {
      this.logger.error(
        { err, eventId: ev.eventId, formId: ev.formId },
        'AutomationEngine form.submitted error',
      );
    }
  }

  /**
   * Gatilho `on_form_submitted`: as regras do evento são filtradas pelo
   * formulário respondido, então cada formulário dispara só as suas.
   */
  async fireForForm(
    eventId: string,
    formId: string,
    contact: { name: string; email: string; phone: string },
  ): Promise<void> {
    const rules = await this.automations.findActiveTriggerRules(eventId, 'on_form_submitted');
    const ruleIds = rules
      .filter((r) => AutomationRuleEntity.matchesForm(r.formIds, formId))
      .map((r) => r.id);
    if (!ruleIds.length) return;
    await this.dispatchTrigger(eventId, 'on_form_submitted', contact, ruleIds);
  }

  async fireAutomations(
    registrationId: string,
    eventId: string,
    trigger: string,
    ruleIds?: string[],
    occurrenceKey?: string,
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
      occurrenceKey,
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
    occurrenceKey?: string,
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
      // O formulário entra na chave: o mesmo template em dois formulários são
      // dois envios, não um repetido.
      // `formIds` não entra na chave: com N formulários por regra, duas regras
      // com o mesmo template não coexistem mais (trava única event+trigger+
      // template) — o motivo de precisar do formulário na chave desapareceu.
      // occurrenceKey vem do job.timestamp do scheduler (fixado na criação do
      // job): retry da mesma ocorrência reusa o mesmo timestamp e cai no
      // mesmo dedupKey; a ocorrência seguinte tem timestamp novo.
      const occurrence = occurrenceKey ? `:${occurrenceKey}` : '';
      const dedupKey = contact.registrationId
        ? `${contact.registrationId}:${rule.templateId}:${trigger}${occurrence}`
        : `${eventId}:${(contact.email || contact.phone).toLowerCase()}:${rule.templateId}:${trigger}${occurrence}`;

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
