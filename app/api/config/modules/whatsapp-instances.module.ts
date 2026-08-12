import { Global, Module } from '@nestjs/common';
import { WhatsappInstancesController } from '@api/controllers/whatsapp_instance_module/whatsapp-instances.controller';
import { WhatsappWebhookController } from '@api/controllers/whatsapp_instance_module/whatsapp-webhook.controller';
import { WhatsappController } from '@api/controllers/whatsapp_instance_module/whatsapp.controller';
import { WhatsappInstancesService } from '@application/whatsapp_instance_module/whatsapp-instances.service';
import { WhatsappInstancesRepository } from '@infra/repositories/whatsapp_instance_module/whatsapp-instances.repository';
import { GuardsModule } from '@api/config/modules/guards.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { OutboxModule } from '@api/config/modules/outbox.module';

@Global()
@Module({
  imports: [GuardsModule, AdaptersModule, OutboxModule],
  controllers: [WhatsappInstancesController, WhatsappWebhookController, WhatsappController],
  providers: [WhatsappInstancesService, WhatsappInstancesRepository],
  exports: [WhatsappInstancesService, WhatsappInstancesRepository],
})
export class WhatsappInstancesModule {}
