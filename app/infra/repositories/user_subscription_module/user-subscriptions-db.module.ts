import { Global, Module } from '@nestjs/common';
import { USER_SUBSCRIPTION_REPOSITORY_PORT } from '@domain/user_subscription_module/i-repository-user-subscription';
import { PrismaUserSubscriptionRepository } from './prisma-user-subscription.repository';

@Global()
@Module({
  providers: [
    { provide: USER_SUBSCRIPTION_REPOSITORY_PORT, useClass: PrismaUserSubscriptionRepository },
  ],
  exports: [USER_SUBSCRIPTION_REPOSITORY_PORT],
})
export class UserSubscriptionsDbModule {}
