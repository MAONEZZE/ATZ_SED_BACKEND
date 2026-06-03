import { Module } from '@nestjs/common';
import { AI_PORT } from '@domain/ai/ports/ai.port';
import { GeminiAdapter } from './gemini.adapter';

@Module({
  providers: [{ provide: AI_PORT, useClass: GeminiAdapter }],
  exports: [AI_PORT],
})
export class AiModule {}
