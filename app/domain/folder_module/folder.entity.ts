import { EntityBase } from '@domain/shared/entity.base';
import { FolderResourceType } from './folder-resource-type';

/**
 * Pasta do painel. Pode viver dentro de outra pasta (`parentId`); `order`
 * posiciona a pasta entre os irmãos do mesmo `parentId` — não é global.
 *
 * Dois eixos de escopo: `resourceType` diz que tipo de registro ela organiza, e
 * `eventId` diz onde ela mora. `eventId` nulo é pasta do painel do dono (só o
 * criador vê). Preenchido, a pasta vive dentro do evento e acompanha o evento no
 * compartilhamento — aí `ownerId` é só quem criou, e quem autoriza escrita é o
 * papel do usuário no evento.
 */
export class FolderEntity extends EntityBase {
  constructor(
    id: string,
    public readonly ownerId: string,
    public name: string,
    public parentId: string | null,
    public order: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly resourceType: FolderResourceType,
    public readonly eventId: string | null,
  ) {
    super(id);
  }

  isRoot(): boolean {
    return this.parentId === null;
  }

  /** Pasta que mora dentro de um evento, e não no painel do dono. */
  livesInEvent(): boolean {
    return this.eventId !== null;
  }
}
