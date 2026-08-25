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
import {
  FORM_RESPONSE_REPOSITORY_PORT,
  FormResponseRepositoryPort,
} from '@domain/form_response_module/i-repository-form-response';

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
    @Inject(FORM_RESPONSE_REPOSITORY_PORT)
    private readonly formResponses: FormResponseRepositoryPort,
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
  ) {}

  @OnEvent('registration.status_changed')
  async handleStatusChanged(ev: RegistrationStatusChanged): Promise<void> {
    const trigger = TRIGGER_MAP[ev.newStatus];
    if (!trigger) return;

    try {
      const rules = await this.automations.findActiveTriggerRules(ev.eventId, trigger);
      const ruleIds = await this.filterRulesByForm(rules, trigger, ev);
      if (!ruleIds.length) return;
      await this.fireAutomations(ev.registrationId, ev.eventId, trigger, ruleIds);
    } catch (err) {
      this.logger.error(
        { err, registrationId: ev.registrationId, trigger },
        'AutomationEngine error',
      );
    }
  }

  /**
   * `on_registration` casa pelo formulário da submissão que criou a inscrição
   * (`matchesForm`). `on_approval`/`on_rejection` não nascem de uma submissão —
   * o critério é participação: o inscrito respondeu algum dos formulários da
   * regra. Sem regra escopada (todas com `formIds` vazio), nenhuma consulta
   * extra ao FormResponse.
   */
  private async filterRulesByForm(
    rules: Array<{ id: string; formIds: string[] }>,
    trigger: string,
    ev: RegistrationStatusChanged,
  ): Promise<string[]> {
    if (!AutomationRuleEntity.scopedByResponse(trigger)) {
      return rules
        .filter((r) => AutomationRuleEntity.matchesForm(r.formIds, ev.formId))
        .map((r) => r.id);
    }

    if (!rules.some((r) => r.formIds.length > 0)) {
      return rules.map((r) => r.id);
    }

    const respondedFormIds = await this.formResponses.findFormIdsByRegistration(ev.registrationId);
    return rules
      .filter(
        (r) =>
          r.formIds.length === 0 || r.formIds.some((formId) => respondedFormIds.includes(formId)),
      )
      .map((r) => r.id);
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
    /** Variáveis extra pro template — hoje só `on_date_form_field` usa (`dia_automacao`). */
    extra?: Record<string, string>,
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
      extra,
    );
  }

  private async dispatchTrigger(
    eventId: string,
    trigger: string,
    contact: { registrationId?: string; name: string; email: string; phone: string },
    ruleIds?: string[],
    occurrenceKey?: string,
    extra?: Record<string, string>,
  ): Promise<void> {
    const rules = await this.automations.findActiveTriggerRules(eventId, trigger, ruleIds);

    if (!rules.length) return;

    const event = await this.eventRepo.findAutomationContext(eventId);

    if (!event) {
      this.logger.warn({ eventId }, 'Event not found for automation');
      return;
    }

    // Rascunho ainda está sendo montado; cancelado já avisou o inscrito pelo
    // aviso de cancelamento (que não passa por aqui — vai direto ao outbox).
    // `ended` continua disparando: evento encerrado ainda aceita resposta pública
    // de formulário e inscrição (public-event.service / registration.service), e
    // barrar aqui deixaria a resposta aceita sem a mensagem de confirmação.
    if (event.status === 'draft' || event.status === 'cancelled') {
      this.logger.warn(
        { eventId, trigger, status: event.status },
        'Automation skipped: event is not in a sendable status',
      );
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
        extra,
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
