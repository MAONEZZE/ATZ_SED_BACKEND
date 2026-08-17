import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FolderEntity } from '@domain/folder_module/folder.entity';
import {
  CreateFolderData,
  FolderRepositoryPort,
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
    );
  }

  async listByOwner(ownerId: string): Promise<FolderEntity[]> {
    const rows = await this.prisma.folder.findMany({
      where: { ownerId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<FolderEntity | null> {
    const row = await this.prisma.folder.findFirst({ where: { id, ownerId } });
    return row ? this.toEntity(row) : null;
  }

  async create(data: CreateFolderData): Promise<FolderEntity> {
    const parentId = data.parentId ?? null;
    const last = await this.prisma.folder.findFirst({
      where: { ownerId: data.ownerId, parentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const row = await this.prisma.folder.create({
      data: {
        ownerId: data.ownerId,
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
  // raiz). Os eventos são desassociados pelo ON DELETE SET NULL da FK.
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

  async reorder(ownerId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.folder.updateMany({ where: { id, ownerId }, data: { order: index } }),
      ),
    );
  }
}
