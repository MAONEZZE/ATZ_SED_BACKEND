import { Global, Module } from '@nestjs/common';
import { WhatsappInstanceController } from '@api/controllers/whatsapp_instance_module/whatsapp-instance.controller';
import { WhatsappWebhookController } from '@api/controllers/whatsapp_instance_module/whatsapp-webhook.controller';
import { WhatsappController } from '@api/controllers/whatsapp_instance_module/whatsapp.controller';
import { WhatsappInstanceService } from '@application/whatsapp_instance_module/whatsapp-instance.service';
import { WhatsappInstanceDbModule } from '@infra/repositories/whatsapp_instance_module/whatsapp-instance-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { AdaptersModule } from '@api/config/modules/adapters.module';
import { OutboxModule } from '@api/config/modules/outbox.module';

@Global()
@Module({
  imports: [GuardsModule, AdaptersModule, OutboxModule, WhatsappInstanceDbModule],
  controllers: [WhatsappInstanceController, WhatsappWebhookController, WhatsappController],
  providers: [WhatsappInstanceService],
  exports: [WhatsappInstanceService],
})
export class WhatsappInstanceModule {}
