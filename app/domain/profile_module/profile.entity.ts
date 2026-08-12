import { EntityBase } from '@domain/shared/entity.base';

/**
 * Perfil de um usuário da plataforma. `id` e `userId` são distintos: `userId`
 * é a identidade no Supabase Auth, e é por ele que o perfil é consultado e
 * atualizado; `id` é a chave da tabela, referenciada pelas demais entidades
 * (dono de evento, colaborador, dono de template).
 */
export class ProfileEntity extends EntityBase {
  constructor(
    id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly photoUrl: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  hasPhoto(): boolean {
    return this.photoUrl !== null && this.photoUrl.length > 0;
  }

  /** Nome inicial de um perfil criado a partir da identidade de autenticação. */
  static defaultNameFromEmail(email: string): string {
    return email.split('@')[0];
  }
}
