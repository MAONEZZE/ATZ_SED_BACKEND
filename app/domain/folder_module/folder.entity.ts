import { EntityBase } from '@domain/shared/entity.base';

/**
 * Pasta do painel. Pertence a um perfil (não é compartilhada) e pode viver
 * dentro de outra pasta. `order` posiciona a pasta entre os irmãos do mesmo
 * `parentId` — não é global.
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
  ) {
    super(id);
  }

  isRoot(): boolean {
    return this.parentId === null;
  }
}
