import { Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { WhatsappAdapter } from './whatsapp.adapter';
import { PipedriveAdapter } from './pipedrive.adapter';

@Module({
  providers: [ResendAdapter, WhatsappAdapter, PipedriveAdapter],
  exports: [ResendAdapter, WhatsappAdapter, PipedriveAdapter],
})
export class IntegrationsModule {}
