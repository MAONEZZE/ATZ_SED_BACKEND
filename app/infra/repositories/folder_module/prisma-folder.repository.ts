import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FolderEntity } from '@domain/folder_module/folder.entity';
import { FolderResourceType } from '@domain/folder_module/folder-resource-type';
import {
  CreateFolderData,
  FolderRepositoryPort,
  FolderScope,
  UpdateFolderData,
} from '@domain/folder_module/i-repository-folder';

type FolderRow = {
  id: string;
  ownerId: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  resourceType: FolderResourceType;
  eventId: string | null;
};

@Injectable()
export class PrismaFolderRepository extends PrismaRepositoryBase implements FolderRepositoryPort {
  private toEntity(row: FolderRow): FolderEntity {
    return new FolderEntity(
      row.id,
      row.ownerId,
      row.name,
      row.parentId,
      row.order,
      row.createdAt,
      row.updatedAt,
      row.resourceType,
      row.eventId,
    );
  }

  /**
   * Único lugar que traduz escopo em `where`, e a peça que faz o
   * compartilhamento funcionar: pasta do painel filtra pelo dono, pasta de
   * evento filtra pelo evento e ignora quem criou.
   */
  private scopeWhere(scope: FolderScope) {
    return {
      resourceType: scope.resourceType,
      ...(scope.eventId !== null
        ? { eventId: scope.eventId }
        : { ownerId: scope.ownerId, eventId: null }),
    };
  }

  async listByScope(scope: FolderScope): Promise<FolderEntity[]> {
    const rows = await this.prisma.folder.findMany({
      where: this.scopeWhere(scope),
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: string): Promise<FolderEntity | null> {
    const row = await this.prisma.folder.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  /** Posição no fim dos irmãos de `parentId`, dentro do escopo. */
  private async nextOrder(scope: FolderScope, parentId: string | null): Promise<number> {
    const last = await this.prisma.folder.findFirst({
      where: { ...this.scopeWhere(scope), parentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return last ? last.order + 1 : 0;
  }

  async create(data: CreateFolderData): Promise<FolderEntity> {
    const parentId = data.parentId ?? null;
    const row = await this.prisma.folder.create({
      data: {
        ownerId: data.ownerId,
        resourceType: data.resourceType,
        eventId: data.eventId,
        name: data.name,
        parentId,
        order: await this.nextOrder(data, parentId),
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: UpdateFolderData): Promise<FolderEntity> {
    // Trocar de pai reposiciona a pasta no fim dos irmãos do destino. Sem isso
    // ela levaria o `order` antigo, colidiria com quem já está lá e a ordem
    // exibida cairia no desempate por createdAt.
    let order: number | undefined;
    if (data.parentId !== undefined) {
      const current = await this.prisma.folder.findUnique({
        where: { id },
        select: { ownerId: true, resourceType: true, eventId: true, parentId: true },
      });
      // Só recalcula quando o pai muda de fato: renomear não mexe na posição, e
      // mandar o mesmo pai de novo também não.
      if (current && current.parentId !== data.parentId) {
        order = await this.nextOrder(current, data.parentId);
      }
    }

    const row = await this.prisma.folder.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(order !== undefined && { order }),
      },
    });
    return this.toEntity(row);
  }

  // As subpastas sobem para o pai da pasta removida (a FK sozinha as jogaria na
  // raiz). Os registros que estavam na pasta (eventos, templates, regras) são
  // desassociados pelo ON DELETE SET NULL das FKs folder_id.
  async delete(id: string): Promise<void> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      select: { parentId: true },
    });
    await this.prisma.$transaction([
      this.prisma.folder.updateMany({
        where: { parentId: id },
        data: { parentId: folder?.parentId ?? null },
      }),
      this.prisma.folder.delete({ where: { id } }),
    ]);
  }

  // `parentId` no where é guarda, não filtro: id de outro nível (ou de outro
  // escopo) é ignorado em vez de receber um `order` que não significa nada entre
  // os irmãos dele.
  async reorder(scope: FolderScope, parentId: string | null, ids: string[]): Promise<void> {
    const where = { ...this.scopeWhere(scope), parentId };
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.folder.updateMany({ where: { id, ...where }, data: { order: index } }),
      ),
    );
  }
}
