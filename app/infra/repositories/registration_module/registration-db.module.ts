import { Global, Module } from '@nestjs/common';
import { REGISTRATION_REPOSITORY_PORT } from '@domain/registration_module/i-repository-registration';
import { PrismaRegistrationRepository } from './prisma-registration.repository';

@Global()
@Module({
  providers: [{ provide: REGISTRATION_REPOSITORY_PORT, useClass: PrismaRegistrationRepository }],
  exports: [REGISTRATION_REPOSITORY_PORT],
})
export class RegistrationDbModule {}
