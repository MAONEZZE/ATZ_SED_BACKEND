import { Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { EvolutionAdapter } from './evolution.adapter';
import { PipedriveAdapter } from './pipedrive.adapter';

@Module({
  providers: [ResendAdapter, EvolutionAdapter, PipedriveAdapter],
  exports: [ResendAdapter, EvolutionAdapter, PipedriveAdapter],
})
export class IntegrationsModule {}
