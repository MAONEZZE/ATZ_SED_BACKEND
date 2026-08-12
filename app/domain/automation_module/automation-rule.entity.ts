import { EntityBase } from '@domain/shared/entity.base';

/** Gatilhos aceitos, espelhando o enum `AutomationTrigger` do banco. */
export const AUTOMATION_TRIGGERS = [
  'on_registration',
  'on_post_event',
  'on_nps',
  'on_approval',
  'on_rejection',
  'recurring',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

/**
 * Regra que dispara uma mensagem a partir de um acontecimento do evento.
 *
 * `recurring` é o gatilho fora da curva: em vez de reagir a um acontecimento,
 * roda por agenda, e por isso é o único que exige `cron` + `timezone` e o único
 * que pode conviver com outras regras ativas do mesmo gatilho.
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

  /**
   * Fora do `recurring`, dois gatilhos iguais ativos no mesmo evento mandariam
   * a mensagem em duplicidade.
   */
  static allowsDuplicateActive(trigger: string): boolean {
    return AutomationRuleEntity.isRecurring(trigger);
  }
}
