import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { WhatsappAdapter } from '@api/adapters/whatsapp.adapter';
import { WhatsappInstancesService } from '@application/whatsapp_instance_module/whatsapp-instances.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappAdapter,
    private readonly whatsappInstances: WhatsappInstancesService,
  ) {}

  @Get('groups')
  @ApiOperation({ summary: 'Listar grupos WhatsApp da instância' })
  @ApiQuery({ name: 'instanceId', required: true, description: 'ID da instância Whatsapp' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { properties: { id: { type: 'string' }, subject: { type: 'string' } } } } })
  async getGroups(@Query('instanceId') instanceId: string) {
    if (!instanceId) throw new BadRequestException('instanceId é obrigatório');
    const token = await this.whatsappInstances.getToken(instanceId);
    return this.whatsapp.fetchGroups(token);
  }
}
