import { ProfileEntity } from './profile.entity';

export const PROFILE_REPOSITORY_PORT = Symbol('PROFILE_REPOSITORY_PORT');

export interface CreateProfileData {
  id: string;
  userId: string;
  name: string;
  email: string;
}

/** Campos alteráveis do perfil. Chave ausente deixa a coluna intacta;
 * `photoUrl: null` remove a foto. */
export interface UpdateProfileData {
  name?: string;
  photoUrl?: string | null;
}

export interface ProfileRepositoryPort {
  /** Consulta pela identidade de autenticação, não pela chave da tabela. */
  findByUserId(userId: string): Promise<ProfileEntity | null>;
  findByEmail(email: string): Promise<ProfileEntity | null>;
  create(data: CreateProfileData): Promise<ProfileEntity>;
  update(userId: string, data: UpdateProfileData): Promise<ProfileEntity>;
}
