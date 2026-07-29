import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { UazapiAdapter } from '@infra/integrations/uazapi.adapter';
import { UazapiInstancesService } from '@modules/uazapi-instances/uazapi-instances.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(
    private readonly uazapi: UazapiAdapter,
    private readonly uazapiInstances: UazapiInstancesService,
  ) {}

  @Get('groups')
  @ApiOperation({ summary: 'Listar grupos WhatsApp da instância' })
  @ApiQuery({ name: 'instanceId', required: true, description: 'ID da instância Uazapi' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { properties: { id: { type: 'string' }, subject: { type: 'string' } } } } })
  async getGroups(@Query('instanceId') instanceId: string) {
    if (!instanceId) throw new BadRequestException('instanceId é obrigatório');
    const token = await this.uazapiInstances.getToken(instanceId);
    return this.uazapi.fetchGroups(token);
  }
}
