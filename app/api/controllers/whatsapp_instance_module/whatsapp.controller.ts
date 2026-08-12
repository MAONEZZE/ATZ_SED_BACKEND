import { Controller, Get, Query, UseGuards, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { WHATSAPP_PORT, WhatsappPort } from '@domain/shared/i-whatsapp';
import { WhatsappInstancesService } from '@application/whatsapp_instance_module/whatsapp-instances.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(
    @Inject(WHATSAPP_PORT) private readonly whatsapp: WhatsappPort,
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
