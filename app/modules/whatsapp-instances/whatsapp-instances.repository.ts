import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';

@Injectable()
export class WhatsappInstancesRepository extends PrismaRepositoryBase {
  list() {
    return this.prisma.whatsappInstance.findMany({
      select: { id: true, nickname: true, token: true },
      orderBy: { nickname: 'asc' },
    });
  }

  async findTokenById(id: string): Promise<string | null> {
    const row = await this.prisma.whatsappInstance.findUnique({
      where: { id },
      select: { token: true },
    });
    return row?.token ?? null;
  }

  findById(id: string): Promise<{ id: string; token: string | null } | null> {
    return this.prisma.whatsappInstance.findUnique({
      where: { id },
      select: { id: true, token: true },
    });
  }
}
