import { EntityBase } from '@domain/shared/entity.base';

/**
 * Respostas do formulário pós-evento de uma inscrição. O par com a inscrição é
 * único (`@@unique([registrationId])`): responder de novo sobrescreve.
 *
 * A escrita não mora aqui — quem grava é `upsertPostEventResponse` no
 * registration_module, no mesmo fluxo em que a inscrição é resolvida. Este
 * módulo é o lado de leitura (listagem e exportação).
 */
export class PostEventResponseEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly registrationId: string,
    private readonly rawAnswers: unknown,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  /**
   * `answers` é coluna Json, então chega como `unknown` e pode ser null quando a
   * resposta foi criada sem payload. Quem consome espera sempre um objeto.
   */
  get answers(): Record<string, unknown> {
    if (!this.rawAnswers || typeof this.rawAnswers !== 'object') return {};
    return this.rawAnswers as Record<string, unknown>;
  }
}
