import { Controller, Get, Query, UseGuards, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { WHATSAPP_PORT, WhatsappPort } from '@domain/shared/i-whatsapp';
import { WhatsappInstanceService } from '@application/whatsapp_instance_module/whatsapp-instance.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(
    @Inject(WHATSAPP_PORT) private readonly whatsapp: WhatsappPort,
    private readonly whatsappInstances: WhatsappInstanceService,
  ) {}

  @Get('groups')
  @ApiOperation({ summary: 'Listar grupos WhatsApp da instância' })
  @ApiQuery({ name: 'instanceId', required: true, description: 'ID da instância Whatsapp' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'array',
      items: { properties: { id: { type: 'string' }, subject: { type: 'string' } } },
    },
  })
  async getGroups(
    @Query('instanceId') instanceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!instanceId) throw new BadRequestException('instanceId é obrigatório');
    const token = await this.whatsappInstances.getToken(instanceId, user.id);
    return this.whatsapp.fetchGroups(token);
  }
}
