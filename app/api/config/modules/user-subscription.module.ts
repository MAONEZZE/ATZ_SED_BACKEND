import { Module } from '@nestjs/common';
import { UserSubscriptionController } from '@api/controllers/user_subscription_module/user-subscription.controller';
import { UserSubscriptionService } from '@application/user_subscription_module/user-subscription.service';
import { UserSubscriptionDbModule } from '@infra/repositories/user_subscription_module/user-subscription-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { FormFieldModule } from '@api/config/modules/form-field.module';

@Module({
  imports: [UserSubscriptionDbModule, GuardsModule, FormFieldModule],
  controllers: [UserSubscriptionController],
  providers: [UserSubscriptionService],
  exports: [UserSubscriptionService],
})
export class UserSubscriptionModule {}
