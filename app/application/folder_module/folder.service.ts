import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FolderEntity } from '@domain/folder_module/folder.entity';
import {
  FOLDER_REPOSITORY_PORT,
  FolderRepositoryPort,
} from '@domain/folder_module/i-repository-folder';

/** Pasta com as filhas embutidas — formato de leitura do GET /folders. */
export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  children: FolderNode[];
}

/** Aninhamento acima disso é erro de uso (ou ciclo que a FK não pega). */
const MAX_DEPTH = 10;

@Injectable()
export class FolderService {
  constructor(
    @Inject(FOLDER_REPOSITORY_PORT) private readonly repo: FolderRepositoryPort,
  ) {}

  async tree(ownerId: string): Promise<FolderNode[]> {
    const folders = await this.repo.listByOwner(ownerId);
    const nodes = new Map<string, FolderNode>(
      folders.map((f) => [
        f.id,
        {
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          order: f.order,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          children: [],
        },
      ]),
    );

    const roots: FolderNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(ownerId: string, name: string, parentId?: string | null): Promise<FolderEntity> {
    if (parentId) await this.assertDepthAvailable(parentId, ownerId);
    return this.repo.create({ ownerId, name, parentId });
  }

  async update(
    id: string,
    ownerId: string,
    input: { name?: string; parentId?: string | null },
  ): Promise<FolderEntity> {
    await this.findOne(id, ownerId);
    if (input.parentId) {
      if (input.parentId === id) throw new BadRequestException('A pasta não pode ser pai de si mesma');
      await this.assertNotDescendant(id, input.parentId, ownerId);
    }
    return this.repo.update(id, input);
  }

  async delete(id: string, ownerId: string): Promise<void> {
    await this.findOne(id, ownerId);
    await this.repo.delete(id);
  }

  reorder(ownerId: string, ids: string[]): Promise<void> {
    return this.repo.reorder(ownerId, ids);
  }

  private async findOne(id: string, ownerId: string): Promise<FolderEntity> {
    const folder = await this.repo.findByIdForOwner(id, ownerId);
    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }

  /**
   * Sobe a corrente de pais a partir de `parentId`. Serve para as duas guardas:
   * encontrar `movingId` no caminho significa ciclo, e estourar MAX_DEPTH
   * significa aninhamento demais.
   */
  private async climb(parentId: string, ownerId: string, movingId?: string): Promise<void> {
    let current: string | null = parentId;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      if (current === null) return;
      if (movingId && current === movingId) {
        throw new BadRequestException('A pasta não pode ser movida para dentro de uma subpasta dela');
      }
      const parent = await this.findOne(current, ownerId);
      current = parent.parentId;
    }
    throw new BadRequestException(`Profundidade máxima de pastas é ${MAX_DEPTH}`);
  }

  private assertNotDescendant(id: string, newParentId: string, ownerId: string): Promise<void> {
    return this.climb(newParentId, ownerId, id);
  }

  private assertDepthAvailable(parentId: string, ownerId: string): Promise<void> {
    return this.climb(parentId, ownerId);
  }
}
