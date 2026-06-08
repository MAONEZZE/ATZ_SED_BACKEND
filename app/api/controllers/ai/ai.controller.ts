import { Controller, Post, Body, UseGuards, HttpCode, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { AI_PORT, AiPort } from '@domain/ai/ports/ai.port';
import { GenerateEmailStyleDto } from './ai.dto';

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
}
