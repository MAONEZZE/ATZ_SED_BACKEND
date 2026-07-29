import { Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { UazapiAdapter } from './uazapi.adapter';
import { PipedriveAdapter } from './pipedrive.adapter';

@Module({
  providers: [ResendAdapter, UazapiAdapter, PipedriveAdapter],
  exports: [ResendAdapter, UazapiAdapter, PipedriveAdapter],
})
export class IntegrationsModule {}
