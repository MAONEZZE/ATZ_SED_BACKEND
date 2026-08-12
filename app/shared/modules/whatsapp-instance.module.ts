import { Global, Module } from '@nestjs/common';
import { WhatsappInstanceController } from '@api/controllers/whatsapp_instance_module/whatsapp-instance.controller';
import { WhatsappWebhookController } from '@api/controllers/whatsapp_instance_module/whatsapp-webhook.controller';
import { WhatsappController } from '@api/controllers/whatsapp_instance_module/whatsapp.controller';
import { WhatsappInstanceService } from '@application/whatsapp_instance_module/whatsapp-instance.service';
import { WhatsappInstanceDbModule } from '@infra/repositories/whatsapp_instance_module/whatsapp-instance-db.module';
import { GuardsModule } from '@shared/modules/guards.module';
import { AdaptersModule } from '@shared/modules/adapters.module';
import { OutboxModule } from '@shared/modules/outbox.module';

@Global()
@Module({
  imports: [GuardsModule, AdaptersModule, OutboxModule, WhatsappInstanceDbModule],
  controllers: [WhatsappInstanceController, WhatsappWebhookController, WhatsappController],
  providers: [WhatsappInstanceService],
  exports: [WhatsappInstanceService],
})
export class WhatsappInstanceModule {}
