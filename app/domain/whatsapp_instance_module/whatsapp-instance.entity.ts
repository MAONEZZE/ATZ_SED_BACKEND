import { EntityBase } from '@domain/shared/entity.base';

/**
 * Uma instância (número) conectada do lado do fornecedor de WhatsApp. A
 * plataforma não cria instância — ela é provisionada lá fora e cadastrada aqui.
 *
 * `token` é o que identifica a instância nas chamadas ao fornecedor, e é
 * anulável porque uma instância pode estar cadastrada antes de ter sido
 * conectada. Sem token não há como falar com ela.
 */
export class WhatsappInstanceEntity extends EntityBase {
  constructor(
    id: string,
    public readonly nickname: string,
    public readonly token: string | null,
  ) {
    super(id);
  }

  /** Só há token utilizável se houver conteúdo — string vazia não serve. */
  hasToken(): boolean {
    return this.token !== null && this.token.trim().length > 0;
  }
}
