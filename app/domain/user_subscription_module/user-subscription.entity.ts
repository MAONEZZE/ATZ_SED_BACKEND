import { EntityBase } from '@domain/shared/entity.base';

export type PipedriveStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/**
 * Ficha consolidada de um contato dentro de um evento: junta num só registro as
 * respostas dos três escopos de formulário (inscrição, pós-evento e NPS), que
 * chegam em momentos diferentes.
 *
 * O contato é identificado por e-mail ou telefone, não por conta — quem
 * responde o formulário público não tem cadastro.
 */
export class UserSubscriptionEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly name: string | null,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly registrationAnswers: Record<string, unknown> | null,
    public readonly postEventAnswers: Record<string, unknown> | null,
    public readonly npsAnswers: Record<string, unknown> | null,
    public readonly sendToPipedrive: boolean,
    public readonly pipedriveStatus: PipedriveStatus | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  /** Respondeu os três escopos — a ficha está completa. */
  isComplete(): boolean {
    return (
      this.registrationAnswers !== null &&
      this.postEventAnswers !== null &&
      this.npsAnswers !== null
    );
  }

  /**
   * Marcada para o CRM e ainda não enviada com sucesso. `failed` conta como
   * pendente: uma falha de envio deve poder ser retentada.
   */
  isPendingPipedrive(): boolean {
    return this.sendToPipedrive && this.pipedriveStatus !== 'sent';
  }
}
