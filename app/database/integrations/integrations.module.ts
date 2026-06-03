import { Module } from '@nestjs/common';
import { ResendAdapter } from './resend.adapter';
import { EvolutionAdapter } from './evolution.adapter';
import { GeminiAdapter } from './gemini.adapter';

@Module({
  providers: [ResendAdapter, EvolutionAdapter, GeminiAdapter],
  exports: [ResendAdapter, EvolutionAdapter, GeminiAdapter],
})
export class IntegrationsModule {}
