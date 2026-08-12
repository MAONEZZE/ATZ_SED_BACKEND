import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { ProfileEntity } from '@domain/profile_module/profile.entity';
import {
  CreateProfileData,
  ProfileRepositoryPort,
  UpdateProfileData,
} from '@domain/profile_module/i-repository-profile';

type ProfileRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaProfileRepository extends PrismaRepositoryBase implements ProfileRepositoryPort {
  private toEntity(row: ProfileRow): ProfileEntity {
    return new ProfileEntity(
      row.id,
      row.userId,
      row.name,
      row.email,
      row.photoUrl,
      row.createdAt,
      row.updatedAt,
    );
  }

  async findByUserId(userId: string): Promise<ProfileEntity | null> {
    const row = await this.prisma.profile.findUnique({ where: { userId } });
    return row ? this.toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<ProfileEntity | null> {
    const row = await this.prisma.profile.findFirst({ where: { email } });
    return row ? this.toEntity(row) : null;
  }

  async create(data: CreateProfileData): Promise<ProfileEntity> {
    return this.toEntity(await this.prisma.profile.create({ data }));
  }

  async update(userId: string, data: UpdateProfileData): Promise<ProfileEntity> {
    const payload: Prisma.ProfileUncheckedUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
    };
    return this.toEntity(await this.prisma.profile.update({ where: { userId }, data: payload }));
  }
}
