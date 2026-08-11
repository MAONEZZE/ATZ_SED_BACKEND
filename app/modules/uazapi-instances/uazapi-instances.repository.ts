import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class UazapiInstancesRepository extends PrismaRepositoryBase {
  list() {
    return this.prisma.uazapiInstance.findMany({
      select: { id: true, nickname: true, token: true },
      orderBy: { nickname: 'asc' },
    });
  }

  async findTokenById(id: string): Promise<string | null> {
    const row = await this.prisma.uazapiInstance.findUnique({
      where: { id },
      select: { token: true },
    });
    return row?.token ?? null;
  }

  findById(id: string): Promise<{ id: string; token: string | null } | null> {
    return this.prisma.uazapiInstance.findUnique({
      where: { id },
      select: { id: true, token: true },
    });
  }
}
