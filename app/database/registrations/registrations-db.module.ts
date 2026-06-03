import { Module } from '@nestjs/common';
import { REGISTRATION_REPOSITORY_PORT } from '@domain/registrations/ports/registration-repository.port';
import { PrismaRegistrationRepository } from './prisma-registration.repository';

@Module({
  providers: [
    {
      provide: REGISTRATION_REPOSITORY_PORT,
      useClass: PrismaRegistrationRepository,
    },
  ],
  exports: [REGISTRATION_REPOSITORY_PORT],
})
export class RegistrationsDbModule {}
