import { FolderEntity } from './folder.entity';

export const FOLDER_REPOSITORY_PORT = Symbol('FOLDER_REPOSITORY_PORT');

export interface CreateFolderData {
  ownerId: string;
  name: string;
  parentId?: string | null;
}

/** Chave ausente deixa a coluna intacta. `parentId: null` move para a raiz. */
export interface UpdateFolderData {
  name?: string;
  parentId?: string | null;
}

export interface FolderRepositoryPort {
  /** Todas as pastas do dono, achatadas e já ordenadas (order, createdAt) — a árvore é montada no service. */
  listByOwner(ownerId: string): Promise<FolderEntity[]>;

  /** O dono é parte da consulta: sem ele um id conhecido devolveria pasta de outra conta. */
  findByIdForOwner(id: string, ownerId: string): Promise<FolderEntity | null>;

  /** `order` nasce no fim do escopo irmão (max + 1). */
  create(data: CreateFolderData): Promise<FolderEntity>;

  update(id: string, data: UpdateFolderData): Promise<FolderEntity>;

  /** Promove as subpastas ao pai da pasta removida e desassocia os eventos (FK SET NULL). */
  delete(id: string): Promise<void>;

  /** Reescreve `order` na ordem dos ids, numa transação. Ignora id que não é do dono. */
  reorder(ownerId: string, ids: string[]): Promise<void>;
}
