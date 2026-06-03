import { Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { EvolutionAdapter } from './evolution.adapter';

@Module({
  providers: [ResendAdapter, EvolutionAdapter],
  exports: [ResendAdapter, EvolutionAdapter],
})
export class IntegrationsModule {}
