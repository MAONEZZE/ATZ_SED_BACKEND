import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { EvolutionAdapter } from '@infra/integrations/evolution.adapter';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly evolution: EvolutionAdapter) {}

  @Get('groups')
  @ApiOperation({ summary: 'Listar grupos WhatsApp da instância' })
  @ApiQuery({ name: 'instancia', required: true, description: 'Nome da instância Evolution' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { properties: { id: { type: 'string' }, subject: { type: 'string' } } } } })
  async getGroups(@Query('instancia') instancia: string) {
    if (!instancia) throw new BadRequestException('instancia é obrigatório');
    return this.evolution.fetchGroups(instancia);
  }
}
