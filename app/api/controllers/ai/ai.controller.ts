import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  HttpCode,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { AI_PORT, AiPort } from '@domain/ai/ports/ai.port';
import { GenerateEmailStyleDto, LandingChatDto } from './ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(@Inject(AI_PORT) private readonly ai: AiPort) {}

  @Post('email-style')
  @HttpCode(200)
  generateEmailStyle(@Body() dto: GenerateEmailStyleDto) {
    return this.ai.generateEmailStyles(dto.content);
  }

  @Post('landing-chat')
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
