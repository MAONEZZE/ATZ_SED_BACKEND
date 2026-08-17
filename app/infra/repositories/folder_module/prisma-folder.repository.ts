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

  async create(data: CreateFolderData): Promise<FolderEntity> {
    const parentId = data.parentId ?? null;
    const last = await this.prisma.folder.findFirst({
      where: { ...this.scopeWhere(data), parentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const row = await this.prisma.folder.create({
      data: {
        ownerId: data.ownerId,
        resourceType: data.resourceType,
        eventId: data.eventId,
        name: data.name,
        parentId,
        order: last ? last.order + 1 : 0,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: UpdateFolderData): Promise<FolderEntity> {
    const row = await this.prisma.folder.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
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

  async reorder(scope: FolderScope, ids: string[]): Promise<void> {
    const where = this.scopeWhere(scope);
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.folder.updateMany({ where: { id, ...where }, data: { order: index } }),
      ),
    );
  }
}
