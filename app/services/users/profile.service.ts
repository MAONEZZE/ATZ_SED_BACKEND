import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProfileRepository } from '@database/users/profile.repository';
import { STORAGE_PORT, StoragePort } from '@domain/shared/ports/storage.port';

export interface UpdateProfileInput {
  name?: string;
  evolutionInstance?: string;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly repo: ProfileRepository,
    private readonly config: ConfigService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async getByUser(userId: string) {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async update(userId: string, input: UpdateProfileInput) {
    await this.getByUser(userId);
    return this.repo.update(userId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.evolutionInstance !== undefined && { evolutionInstance: input.evolutionInstance }),
    });
  }

  /** Idempotent: returns the existing profile or creates one from the auth identity. */
  async ensure(user: { id: string; email: string }) {
    const existing = await this.repo.findByUserId(user.id);
    if (existing) return existing;
    return this.repo.create({
      id: user.id,
      userId: user.id,
      name: user.email.split('@')[0],
      email: user.email,
    });
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
    if (profile.photoUrl) {
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
