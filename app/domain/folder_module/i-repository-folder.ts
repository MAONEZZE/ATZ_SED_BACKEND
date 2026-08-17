import { FolderEntity } from './folder.entity';
import { FolderResourceType } from './folder-resource-type';

export const FOLDER_REPOSITORY_PORT = Symbol('FOLDER_REPOSITORY_PORT');

/**
 * Onde a pasta mora. `eventId` nulo é o painel do dono, e aí `ownerId` é o
 * filtro; preenchido, a pasta vive no evento e o filtro é o evento — é isso que
 * faz a pasta acompanhar o evento no compartilhamento em vez de ficar presa a
 * quem a criou.
 */
export interface FolderAccess {
  ownerId: string;
  eventId: string | null;
}

/** Recorte de uma consulta de pastas: onde mora (`FolderAccess`) mais o tipo. */
export interface FolderScope extends FolderAccess {
  resourceType: FolderResourceType;
}

export interface CreateFolderData {
  ownerId: string;
  resourceType: FolderResourceType;
  eventId: string | null;
  name: string;
  parentId?: string | null;
}

/** Chave ausente deixa a coluna intacta. `parentId: null` move para a raiz. */
export interface UpdateFolderData {
  name?: string;
  parentId?: string | null;
}

export interface FolderRepositoryPort {
  /** Pastas do escopo, achatadas e já ordenadas (order, createdAt) — a árvore é montada no service. */
  listByScope(scope: FolderScope): Promise<FolderEntity[]>;

  /**
   * Sem filtro de escopo: pasta que vive num evento é alcançável por
   * colaborador, então quem autoriza é o service (que compara o escopo da linha
   * com o da requisição).
   */
  findById(id: string): Promise<FolderEntity | null>;

  /** `order` nasce no fim do escopo irmão (max + 1, dentro do mesmo escopo e parentId). */
  create(data: CreateFolderData): Promise<FolderEntity>;

  update(id: string, data: UpdateFolderData): Promise<FolderEntity>;

  /**
   * Promove as subpastas ao pai da pasta removida e desassocia os registros que
   * estavam nela (eventos, templates e regras — todas as FKs `folder_id` são
   * SET NULL).
   */
  delete(id: string): Promise<void>;

  /** Reescreve `order` na ordem dos ids, numa transação. Ignora id fora do escopo. */
  reorder(scope: FolderScope, ids: string[]): Promise<void>;
}
