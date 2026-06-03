// TODO: Uncomment after Task 3 (Prisma setup) installs @prisma/client and runs `prisma generate`
// import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';
//
// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
//   private readonly logger = new Logger(PrismaService.name);
//
//   async onModuleInit(): Promise<void> {
//     await this.$connect();
//     this.logger.log('Database connected');
//   }
//
//   async onModuleDestroy(): Promise<void> {
//     await this.$disconnect();
//   }
// }

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

/** Stub until Task 3 runs `prisma generate` and @prisma/client is available. */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // TODO: replace with await this.$connect() after Task 3
    this.logger.log('PrismaService stub — database not yet connected');
  }

  async onModuleDestroy(): Promise<void> {
    // TODO: replace with await this.$disconnect() after Task 3
  }
}
