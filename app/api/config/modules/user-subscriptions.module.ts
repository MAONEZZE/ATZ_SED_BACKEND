import { Module } from '@nestjs/common';
import { UserSubscriptionsController } from '@api/controllers/user_subscription_module/user-subscriptions.controller';
import { UserSubscriptionsService } from '@application/user_subscription_module/user-subscriptions.service';
import { UserSubscriptionsDbModule } from '@infra/repositories/user_subscription_module/user-subscriptions-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { FormFieldsModule } from '@api/config/modules/form-fields.module';

@Module({
  imports: [UserSubscriptionsDbModule, GuardsModule, FormFieldsModule],
  controllers: [UserSubscriptionsController],
  providers: [UserSubscriptionsService],
  exports: [UserSubscriptionsService],
})
export class UserSubscriptionsModule {}
