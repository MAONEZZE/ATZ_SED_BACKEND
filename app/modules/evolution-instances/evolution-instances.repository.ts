import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class EvolutionInstancesRepository extends PrismaRepositoryBase {
  list() {
    return this.prisma.evolutionInstance.findMany({
      select: { id: true, nickname: true },
      orderBy: { nickname: 'asc' },
    });
  }
}
