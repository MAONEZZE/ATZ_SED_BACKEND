import { EntityBase } from '@domain/shared/entity.base';

/** Gatilhos aceitos, espelhando o enum `AutomationTrigger` do banco. */
export const AUTOMATION_TRIGGERS = [
  'on_registration',
  'on_approval',
  'on_rejection',
  'recurring',
  'on_form_submitted',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

/**
 * Regra que dispara uma mensagem a partir de um acontecimento do evento.
 *
 * `recurring` é o gatilho fora da curva: em vez de reagir a um acontecimento,
 * roda por agenda, e por isso é o único que exige `cron` + `timezone`.
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
    /** Só no gatilho `on_form_submitted`: qual formulário dispara a regra. */
    public readonly formId: string | null,
    public readonly delayMinutes: number | null,
    public readonly cron: string | null,
    public readonly timezone: string | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
  ) {
    super(id);
  }

  isRecurring(): boolean {
    return AutomationRuleEntity.isRecurring(this.trigger);
  }

  /** `on_form_submitted` é escopado por formulário, então exige `formId`. */
  static requiresForm(trigger: string): boolean {
    return trigger === 'on_form_submitted';
  }

  static isRecurring(trigger: string): boolean {
    return trigger === 'recurring';
  }

  /**
   * Envio imediato é o que não tem espera. Regras gravadas com 0 existem e
   * significam o mesmo que null — daí os dois contarem como imediato.
   */
  isImmediate(): boolean {
    return this.delayMinutes === null || this.delayMinutes === 0;
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
