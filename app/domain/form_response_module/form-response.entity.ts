import { EntityBase } from '@domain/shared/entity.base';

/**
 * Resposta de um inscrito a um formulário — a junção N formulários × N pessoas
 * que substituiu `PostEventResponse` em 2026-08-17.
 *
 * Uma resposta por `(formId, registrationId)`: reenviar sobrescreve, que é o que
 * o pós-evento já fazia com o unique por inscrito.
 */
export class FormResponseEntity extends EntityBase {
  constructor(
    id: string,
    public readonly formId: string,
    public readonly eventId: string,
    public readonly registrationId: string,
    public readonly answers: Record<string, unknown>,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }
}
