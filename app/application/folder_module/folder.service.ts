import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FolderEntity } from '@domain/folder_module/folder.entity';
import {
  FOLDER_REPOSITORY_PORT,
  FolderAccess,
  FolderRepositoryPort,
  FolderScope,
} from '@domain/folder_module/i-repository-folder';

/** Pasta com as filhas embutidas — formato de leitura do GET de pastas. */
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

/**
 * Pastas de qualquer tipo de registro. O escopo (`resourceType` + `eventId`)
 * chega da requisição: rota `/folders` traz o painel do dono, rota
 * `/events/:eventId/folders` traz as pastas que moram no evento.
 *
 * Autorização: pasta do painel é do criador e só dele. Pasta de evento já vem
 * autorizada pelo `OwnershipGuard` da rota aninhada (leitura exige papel `read`,
 * escrita exige `invited`), então aqui só resta confirmar que a pasta pedida
 * mora mesmo no evento da rota — senão um id de outro evento passaria.
 */
@Injectable()
export class FolderService {
  constructor(
    @Inject(FOLDER_REPOSITORY_PORT) private readonly repo: FolderRepositoryPort,
  ) {}

  async tree(scope: FolderScope): Promise<FolderNode[]> {
    this.assertScopeValid(scope);
    const folders = await this.repo.listByScope(scope);
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

  async create(scope: FolderScope, name: string, parentId?: string | null): Promise<FolderEntity> {
    this.assertScopeValid(scope);
    if (parentId) await this.assertDepthAvailable(parentId, scope);
    return this.repo.create({
      ownerId: scope.ownerId,
      resourceType: scope.resourceType,
      eventId: scope.eventId,
      name,
      parentId,
    });
  }

  async update(
    id: string,
    access: FolderAccess,
    input: { name?: string; parentId?: string | null },
  ): Promise<FolderEntity> {
    const folder = await this.findOne(id, access);
    if (input.parentId) {
      if (input.parentId === id) throw new BadRequestException('A pasta não pode ser pai de si mesma');
      await this.assertNotDescendant(id, input.parentId, {
        ...access,
        resourceType: folder.resourceType,
      });
    }
    return this.repo.update(id, input);
  }

  async delete(id: string, access: FolderAccess): Promise<void> {
    await this.findOne(id, access);
    await this.repo.delete(id);
  }

  async reorder(scope: FolderScope, ids: string[]): Promise<void> {
    this.assertScopeValid(scope);
    await this.repo.reorder(scope, ids);
  }

  /**
   * O tipo determina onde a pasta pode morar: evento é organização do painel, e
   * regra de automação só existe dentro de um evento. O banco tem o mesmo CHECK,
   * mas lá o erro sai como falha de constraint em vez de 400.
   */
  private assertScopeValid(scope: FolderScope): void {
    if (scope.resourceType === 'event' && scope.eventId !== null) {
      throw new BadRequestException('Pasta de eventos vive no painel, não dentro de um evento');
    }
    if (scope.resourceType === 'automation_rule' && scope.eventId === null) {
      throw new BadRequestException('Pasta de automações exige um evento');
    }
  }

  /**
   * Carrega a pasta e confirma que ela pertence ao escopo da requisição. Pasta do
   * painel exige ser do criador; pasta de evento exige ser daquele evento (o
   * papel no evento já foi checado pelo guard da rota). Fora do escopo é 404, não
   * 403: quem pergunta não tem por que saber que o id existe.
   */
  private async findOne(id: string, access: FolderAccess, resourceType?: string): Promise<FolderEntity> {
    const folder = await this.repo.findById(id);
    const found =
      folder &&
      folder.eventId === access.eventId &&
      (folder.eventId !== null || folder.ownerId === access.ownerId) &&
      (resourceType === undefined || folder.resourceType === resourceType);
    if (!found) throw new NotFoundException('Folder not found');
    return folder;
  }

  /**
   * Sobe a corrente de pais a partir de `parentId`. Serve para as duas guardas:
   * encontrar `movingId` no caminho significa ciclo, e estourar MAX_DEPTH
   * significa aninhamento demais. Cada nível revalida o escopo, então pasta de
   * outro tipo, outro evento ou outra conta não serve de pai.
   */
  private async climb(parentId: string, scope: FolderScope, movingId?: string): Promise<void> {
    let current: string | null = parentId;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      if (current === null) return;
      if (movingId && current === movingId) {
        throw new BadRequestException('A pasta não pode ser movida para dentro de uma subpasta dela');
      }
      const parent = await this.findOne(current, scope, scope.resourceType);
      current = parent.parentId;
    }
    throw new BadRequestException(`Profundidade máxima de pastas é ${MAX_DEPTH}`);
  }

  private assertNotDescendant(id: string, newParentId: string, scope: FolderScope): Promise<void> {
    return this.climb(newParentId, scope, id);
  }

  private assertDepthAvailable(parentId: string, scope: FolderScope): Promise<void> {
    return this.climb(parentId, scope);
  }
}
