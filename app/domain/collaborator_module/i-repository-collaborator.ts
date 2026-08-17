import { CollaboratorEntity } from './collaborator.entity';
import { EventRole } from './event-role.type';

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
  role: EventRole;
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
  /** Idempotente: re-adicionar um colaborador existente atualiza o papel dele. */
  upsert(eventId: string, profileId: string, role: EventRole): Promise<CollaboratorEntity>;
  /** Retorna null quando o vínculo não existe. */
  updateRole(
    eventId: string,
    profileId: string,
    role: EventRole,
  ): Promise<CollaboratorEntity | null>;
  /** Retorna quantos vínculos foram removidos — 0 significa que não existia. */
  remove(eventId: string, profileId: string): Promise<number>;
}
