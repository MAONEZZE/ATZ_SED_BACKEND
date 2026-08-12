import { Module } from '@nestjs/common';
import { EMAIL_PORT } from '@domain/shared/i-email';
import { WHATSAPP_PORT } from '@domain/shared/i-whatsapp';
import { CRM_PORT } from '@domain/shared/i-crm';
import { ResendAdapter } from '@infra/adapters/resend.adapter';
import { WhatsappAdapter } from '@infra/adapters/whatsapp.adapter';
import { PipedriveAdapter } from '@infra/adapters/pipedrive.adapter';

@Module({
  providers: [
    { provide: EMAIL_PORT, useClass: ResendAdapter },
    { provide: WHATSAPP_PORT, useClass: WhatsappAdapter },
    { provide: CRM_PORT, useClass: PipedriveAdapter },
  ],
  exports: [EMAIL_PORT, WHATSAPP_PORT, CRM_PORT],
})
export class AdaptersModule {}
