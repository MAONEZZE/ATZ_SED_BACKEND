import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PROFILE_REPOSITORY_PORT,
  ProfileRepositoryPort,
  UpdateProfileData,
} from '@domain/profile_module/i-repository-profile';
import { ProfileEntity } from '@domain/profile_module/profile.entity';
import { STORAGE_PORT, StoragePort } from '@domain/shared/i-storage';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY_PORT) private readonly repo: ProfileRepositoryPort,
    private readonly config: ConfigService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async getByUser(userId: string) {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async update(userId: string, input: UpdateProfileData) {
    await this.getByUser(userId);
    return this.repo.update(userId, input);
  }

  /** Idempotent: returns the existing profile or creates one from the auth identity. */
  async ensure(user: {
    id: string;
    email: string;
  }): Promise<{ profile: ProfileEntity; created: boolean }> {
    const existing = await this.repo.findByUserId(user.id);
    if (existing) return { profile: existing, created: false };
    const profile = await this.repo.create({
      id: user.id,
      userId: user.id,
      name: ProfileEntity.defaultNameFromEmail(user.email),
      email: user.email,
    });
    return { profile, created: true };
  }

  async uploadPhoto(userId: string, file: { buffer: Buffer; mimetype: string }) {
    const profile = await this.getByUser(userId);
    const { bucket, folder } = this.photoLocation();
    const path = `${folder}/${profile.id}/photo`;
    const { url } = await this.storage.upload(bucket, path, file.buffer, file.mimetype);
    return this.repo.update(userId, { photoUrl: url });
  }

  async deletePhoto(userId: string) {
    const profile = await this.getByUser(userId);
    if (profile.hasPhoto()) {
      const { bucket, folder } = this.photoLocation();
      const path = `${folder}/${profile.id}/photo`;
      try {
        await this.storage.delete(bucket, path);
      } catch {}
    }
    return this.repo.update(userId, { photoUrl: null });
  }

  private photoLocation() {
    return {
      bucket: this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED',
      folder: this.config.get<string>('SUPABASE_STORAGE_BUCKET_PROFILE_PHOTOS') ?? 'profile-photo',
    };
  }
}
