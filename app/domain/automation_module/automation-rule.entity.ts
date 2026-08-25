import { EntityBase } from '@domain/shared/entity.base';

/** Gatilhos aceitos, espelhando o enum `AutomationTrigger` do banco. */
export const AUTOMATION_TRIGGERS = [
  'on_registration',
  'on_approval',
  'on_rejection',
  'recurring',
  'on_form_submitted',
  'on_date',
  'on_date_form_field',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

/** Hora do disparo mensal de `on_date_form_field` quando a regra não define `sendTime`. */
export const DEFAULT_SEND_TIME = '09:00';

/**
 * Regra que dispara uma mensagem a partir de um acontecimento do evento.
 *
 * `recurring`, `on_date` e `on_date_form_field` são os gatilhos fora da curva:
 * em vez de reagir a um acontecimento, rodam por agenda. `recurring` repete por
 * cron (exige `cron` + `timezone`); `on_date` dispara uma vez só, no instante de
 * `sendAt`; `on_date_form_field` dispara todo mês, por inscrito, no dia-do-mês
 * que a pessoa respondeu num campo `on_date_automation_field` — hora vem de
 * `sendTime` (default `09:00`) no `timezone` da regra.
 *
 * Qualquer gatilho aceita mais de uma regra ativa no mesmo evento, desde que
 * usem templates diferentes (ex: aprovação mandando e-mail e WhatsApp). Repetir
 * o mesmo template no mesmo gatilho é recusado com 409 — as duas linhas
 * colidiriam no `dedupKey` do outbox e a segunda nunca sairia.
 *
 * Campos públicos com o nome das colunas: as listagens são serializadas direto
 * como corpo da resposta.
 */
export class AutomationRuleEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly templateId: string,
    public readonly trigger: AutomationTrigger,
    /**
     * Formulários que disparam a regra. Vazio = todos os formulários do evento,
     * dinamicamente (formulário criado depois já dispara). Os 7 gatilhos aceitam
     * `formIds`; obrigatório e não-vazio em `on_form_submitted` e `on_date_form_field`
     * (`requiresForm`).
     */
    public readonly formIds: string[],
    public readonly delayMinutes: number | null,
    public readonly cron: string | null,
    public readonly timezone: string | null,
    public readonly active: boolean,
    /** Pasta que organiza a regra. Sempre uma pasta do mesmo evento. */
    public readonly folderId: string | null,
    /** Posição manual dentro da pasta (ou da raiz). */
    public readonly order: number,
    public readonly createdAt: Date,
    /** Instante do disparo único de `on_date`, em UTC. */
    public readonly sendAt: Date | null = null,
    /** Preenchido no claim do sweeper: regra já disparada não dispara de novo. */
    public readonly firedAt: Date | null = null,
    /** Hora do disparo mensal de `on_date_form_field`, "HH:mm". Só esse gatilho usa. */
    public readonly sendTime: string | null = null,
    /** Nome próprio da regra. `null` = a UI cai no nome do template. */
    public readonly name: string | null = null,
  ) {
    super(id);
  }

  isRecurring(): boolean {
    return AutomationRuleEntity.isRecurring(this.trigger);
  }

  /**
   * `on_form_submitted` e `on_date_form_field` não fazem sentido sem saber QUAL
   * formulário: o primeiro é o próprio evento que dispara a regra; o segundo
   * precisa do formulário pra resolver o campo de data. Os outros 5 gatilhos
   * aceitam `formIds` como escopo opcional (vazio = todos).
   */
  static requiresForm(trigger: string): boolean {
    return trigger === 'on_form_submitted' || trigger === 'on_date_form_field';
  }

  /**
   * Critério de escopo por formulário quando o gatilho não nasce de uma
   * submissão: em vez do formulário que originou a inscrição (`matchesForm`),
   * vale a participação — o inscrito respondeu (tem `FormResponse`) algum dos
   * formulários da regra. `on_registration` e `on_form_submitted` ficam de
   * fora: para eles o formulário da submissão já resolve, no mesmo instante do
   * disparo.
   */
  static scopedByResponse(trigger: string): boolean {
    return (
      trigger === 'on_approval' ||
      trigger === 'on_rejection' ||
      trigger === 'recurring' ||
      trigger === 'on_date' ||
      trigger === 'on_date_form_field'
    );
  }

  /** Lista vazia = todos; caso contrário só quem entrou por um dos formulários. */
  static matchesForm(formIds: string[], formId: string | null): boolean {
    return formIds.length === 0 || (formId !== null && formIds.includes(formId));
  }

  static isRecurring(trigger: string): boolean {
    return trigger === 'recurring';
  }

  /** Disparo único numa data marcada na regra, igual para todos os inscritos. */
  static isDate(trigger: string): boolean {
    return trigger === 'on_date';
  }

  /** Recorrência mensal por inscrito, calculada a partir do formulário — sem agenda materializada. */
  static isDateFormField(trigger: string): boolean {
    return trigger === 'on_date_form_field';
  }

  /**
   * Envio imediato é o que não tem espera. Regras gravadas com 0 existem e
   * significam o mesmo que null — daí os dois contarem como imediato.
   */
  isImmediate(): boolean {
    return this.delayMinutes === null || this.delayMinutes === 0;
  }

  /** Um gatilho de data sem data nunca dispararia. */
  static requiresSendAt(trigger: string, sendAt?: Date | null): boolean {
    return AutomationRuleEntity.isDate(trigger) && !sendAt;
  }

  /** Um gatilho recorrente sem agenda nunca dispararia. */
  static requiresSchedule(
    trigger: string,
    cron?: string | null,
    timezone?: string | null,
  ): boolean {
    return AutomationRuleEntity.isRecurring(trigger) && (!cron?.trim() || !timezone?.trim());
  }
}
