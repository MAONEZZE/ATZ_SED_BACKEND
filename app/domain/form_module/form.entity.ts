import { EntityBase } from '@domain/shared/entity.base';

/**
 * Um formulário do evento. Desde 2026-08-17 um evento tem **N** formulários (os
 * 3 tipos fixos registration/post_event/nps morreram): a identidade pública é o
 * par `(eventId, slug)`, único no banco, e `order` define a posição na listagem.
 *
 * Campos públicos com o nome das colunas: o formulário é serializado direto
 * como corpo da resposta.
 */
export class FormEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly order: number,
    public readonly description: string | null,
    public readonly postRegistrationMessage: string | null,
    public readonly linkPostSubscription: string | null,
    public readonly requireImageAuthorization: boolean,
    public readonly sendToPipedrive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  /** Slug a partir do nome: é o que vai na URL pública do formulário. */
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
