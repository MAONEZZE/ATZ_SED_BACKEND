import { EntityBase } from '@domain/shared/entity.base';
import { EventRole } from './event-role.type';

/**
 * Vínculo entre um perfil já cadastrado e um evento do qual ele não é dono.
 * O par (eventId, profileId) é único: adicionar duas vezes é a mesma coisa que
 * adicionar uma.
 */
export class CollaboratorEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly profileId: string,
    public readonly createdAt: Date,
    public readonly role: EventRole = 'invited',
  ) {
    super(id);
  }

  /** O dono do evento já tem acesso total; colaborador é sempre outra pessoa. */
  isOwner(ownerId: string): boolean {
    return this.profileId === ownerId;
  }
}
