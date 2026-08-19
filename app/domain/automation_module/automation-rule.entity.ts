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
    /**
     * Formulários que disparam a regra. Vazio = todos os formulários do evento,
     * dinamicamente (formulário criado depois já dispara). Só relevante quando
     * `acceptsForm(trigger)`; obrigatório e não-vazio em `on_form_submitted`.
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
  ) {
    super(id);
  }

  isRecurring(): boolean {
    return AutomationRuleEntity.isRecurring(this.trigger);
  }

  /** `on_form_submitted` é escopado por formulário, então exige `formIds` não-vazio. */
  static requiresForm(trigger: string): boolean {
    return trigger === 'on_form_submitted';
  }

  /**
   * Gatilhos que guardam `formIds`. Em `on_form_submitted` é obrigatório; em
   * `on_registration` é escopo opcional — com formulários, a regra só vale para
   * quem se inscreveu por um deles; sem (lista vazia), vale para qualquer
   * formulário.
   */
  static acceptsForm(trigger: string): boolean {
    return trigger === 'on_form_submitted' || trigger === 'on_registration';
  }

  /** Lista vazia = todos; caso contrário só quem entrou por um dos formulários. */
  static matchesForm(formIds: string[], formId: string | null): boolean {
    return formIds.length === 0 || (formId !== null && formIds.includes(formId));
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
