import { CollaboratorEntity } from './collaborator.entity';

export const COLLABORATOR_REPOSITORY_PORT = Symbol('COLLABORATOR_REPOSITORY_PORT');

/**
 * Projeção de leitura da tela de colaboradores: o vínculo mais os dados do
 * perfil que a lista exibe. Não é a entidade — a entidade não conhece nome nem
 * foto de perfil — então vive como tipo próprio da porta.
 */
export interface CollaboratorWithProfile {
  id: string;
  eventId: string;
  profileId: string;
  createdAt: Date;
  profile: {
    id: string;
    name: string | null;
    email: string;
    photoUrl: string | null;
  };
}

export interface CollaboratorRepositoryPort {
  list(eventId: string): Promise<CollaboratorWithProfile[]>;
  isCollaborator(eventId: string, profileId: string): Promise<boolean>;
  /** Idempotente: re-adicionar um colaborador existente não é erro. */
  upsert(eventId: string, profileId: string): Promise<CollaboratorEntity>;
  /** Retorna quantos vínculos foram removidos — 0 significa que não existia. */
  remove(eventId: string, profileId: string): Promise<number>;
}
