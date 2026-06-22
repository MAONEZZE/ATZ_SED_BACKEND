import { Module } from '@nestjs/common';
import { REGISTRATION_REPOSITORY_PORT } from '@domain/registrations/ports/registration-repository.port';
import { USER_SUBSCRIPTION_REPOSITORY_PORT } from '@domain/registrations/ports/user-subscription-repository.port';
import { PrismaRegistrationRepository } from './prisma-registration.repository';
import { PrismaUserSubscriptionRepository } from './prisma-user-subscription.repository';

@Module({
  providers: [
    {
      provide: REGISTRATION_REPOSITORY_PORT,
      useClass: PrismaRegistrationRepository,
    },
    {
      provide: USER_SUBSCRIPTION_REPOSITORY_PORT,
      useClass: PrismaUserSubscriptionRepository,
    },
  ],
  exports: [REGISTRATION_REPOSITORY_PORT, USER_SUBSCRIPTION_REPOSITORY_PORT],
})
export class RegistrationsDbModule {}
