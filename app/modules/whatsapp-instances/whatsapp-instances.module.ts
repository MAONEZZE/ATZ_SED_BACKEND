import { Global, Module } from '@nestjs/common';
import { WhatsappInstancesController } from './whatsapp-instances.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappInstancesService } from './whatsapp-instances.service';
import { WhatsappInstancesRepository } from './whatsapp-instances.repository';
import { GuardsModule } from '@shared/guards/guards.module';
import { IntegrationsModule } from '@infra/integrations/integrations.module';

@Global()
@Module({
  imports: [GuardsModule, IntegrationsModule],
  controllers: [WhatsappInstancesController, WhatsappWebhookController],
  providers: [WhatsappInstancesService, WhatsappInstancesRepository],
  exports: [WhatsappInstancesService, WhatsappInstancesRepository],
})
export class WhatsappInstancesModule {}
