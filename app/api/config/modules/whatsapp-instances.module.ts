import { Global, Module } from '@nestjs/common';
import { WhatsappInstancesController } from '@api/controllers/whatsapp_instance_module/whatsapp-instances.controller';
import { WhatsappWebhookController } from '@api/controllers/whatsapp_instance_module/whatsapp-webhook.controller';
import { WhatsappController } from '@api/controllers/whatsapp_instance_module/whatsapp.controller';
import { WhatsappInstancesService } from '@application/whatsapp_instance_module/whatsapp-instances.service';
import { WhatsappInstancesDbModule } from '@infra/repositories/whatsapp_instance_module/whatsapp-instances-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { AdaptersModule } from '@api/config/modules/adapters.module';
import { OutboxModule } from '@api/config/modules/outbox.module';

@Global()
@Module({
  imports: [GuardsModule, AdaptersModule, OutboxModule, WhatsappInstancesDbModule],
  controllers: [WhatsappInstancesController, WhatsappWebhookController, WhatsappController],
  providers: [WhatsappInstancesService],
  exports: [WhatsappInstancesService],
})
export class WhatsappInstancesModule {}
