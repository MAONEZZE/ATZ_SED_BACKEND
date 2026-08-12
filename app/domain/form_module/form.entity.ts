import { EntityBase } from '@domain/shared/entity.base';
import { FormKind } from '@domain/shared/form-kind.type';

/**
 * Metadados de um escopo de formulário de um evento. Identidade real é o par
 * `(eventId, kind)`, único no banco — o `id` existe para as chaves estrangeiras
 * dos campos.
 *
 * Um formulário é materializado na primeira vez que alguém o acessa, então
 * existir não quer dizer estar preenchido.
 *
 * Campos públicos com o nome das colunas: o formulário é serializado direto
 * como corpo da resposta.
 */
export class FormEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly kind: FormKind,
    public readonly description: string | null,
    public readonly postRegistrationMessage: string | null,
    public readonly linkPostSubscription: string | null,
    public readonly requireImageAuthorization: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  /** Recém-materializado: nenhum dos campos editáveis foi preenchido ainda. */
  isBlank(): boolean {
    return (
      !this.description?.trim() &&
      !this.postRegistrationMessage?.trim() &&
      !this.linkPostSubscription?.trim()
    );
  }
}
