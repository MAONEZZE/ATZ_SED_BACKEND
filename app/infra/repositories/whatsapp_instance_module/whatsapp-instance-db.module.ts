import { Global, Module } from '@nestjs/common';
import { WHATSAPP_INSTANCE_REPOSITORY_PORT } from '@domain/whatsapp_instance_module/i-repository-whatsapp-instance';
import { PrismaWhatsappInstanceRepository } from './prisma-whatsapp-instance.repository';

@Global()
@Module({
  providers: [
    { provide: WHATSAPP_INSTANCE_REPOSITORY_PORT, useClass: PrismaWhatsappInstanceRepository },
  ],
  exports: [WHATSAPP_INSTANCE_REPOSITORY_PORT],
})
export class WhatsappInstanceDbModule {}
