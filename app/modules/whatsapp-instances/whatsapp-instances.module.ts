import { Global, Module } from '@nestjs/common';
import { WhatsappInstancesController } from './whatsapp-instances.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappInstancesService } from './whatsapp-instances.service';
import { WhatsappInstancesRepository } from './whatsapp-instances.repository';
import { GuardsModule } from '@api/config/modules/guards.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { OutboxModule } from '@domain/outbox_module/outbox.module';

@Global()
@Module({
  imports: [GuardsModule, AdaptersModule, OutboxModule],
  controllers: [WhatsappInstancesController, WhatsappWebhookController],
  providers: [WhatsappInstancesService, WhatsappInstancesRepository],
  exports: [WhatsappInstancesService, WhatsappInstancesRepository],
})
export class WhatsappInstancesModule {}
