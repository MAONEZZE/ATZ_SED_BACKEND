import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class ProfileRepository extends PrismaRepositoryBase {
  findByUserId(userId: string) {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  findById(id: string) {
    return this.prisma.profile.findUnique({ where: { id } });
  }

  create(data: Prisma.ProfileUncheckedCreateInput) {
    return this.prisma.profile.create({ data });
  }

  update(userId: string, data: Prisma.ProfileUncheckedUpdateInput) {
    return this.prisma.profile.update({ where: { userId }, data });
  }
}
