import { Controller, Post, Body, UseGuards, Res, HttpCode, Inject } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { AI_PORT, AiPort } from '@domain/ai/ports/ai.port';
import { GenerateEmailStyleDto, LandingChatDto } from './ai.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(@Inject(AI_PORT) private readonly ai: AiPort) {}

  @Post('email-style')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gerar variações de estilo para email (Gemini)' })
  @ApiResponse({ status: 200, description: 'Variações de estilo geradas' })
  generateEmailStyle(@Body() dto: GenerateEmailStyleDto) {
    return this.ai.generateEmailStyles(dto.content);
  }

  @Post('landing-chat')
  @ApiOperation({ summary: 'Chat IA para landing page (SSE streaming)' })
  @ApiResponse({ status: 200, description: 'Stream SSE com chunks de texto', content: { 'text/event-stream': {} } })
  async landingChat(@Body() dto: LandingChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.ai.streamLandingChat(dto.message, dto.landing)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI stream error';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}
