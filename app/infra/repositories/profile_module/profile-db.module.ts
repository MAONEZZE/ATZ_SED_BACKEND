import { Global, Module } from '@nestjs/common';
import { PROFILE_REPOSITORY_PORT } from '@domain/profile_module/i-repository-profile';
import { PrismaProfileRepository } from './prisma-profile.repository';

@Global()
@Module({
  providers: [{ provide: PROFILE_REPOSITORY_PORT, useClass: PrismaProfileRepository }],
  exports: [PROFILE_REPOSITORY_PORT],
})
export class ProfileDbModule {}
