import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { WhatsappInstanceService } from '@application/whatsapp_instance_module/whatsapp-instance.service';

@ApiTags('Whatsapp Instances')
@ApiBearerAuth()
@Controller('whatsapp-instances')
@UseGuards(JwtAuthGuard)
export class WhatsappInstanceController {
  constructor(private readonly whatsappInstances: WhatsappInstanceService) {}

  @Get()
  @ApiOperation({ summary: 'Listar as instâncias Whatsapp liberadas para o usuário' })
  @ApiResponse({
    status: 200,
    description:
      'Lista de instâncias (id + apelido + active). Só as da lista fixa do usuário (`profile_whatsapp_instances`) — vazia se ele não tem nenhuma liberada.',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsappInstances.list(user.id);
  }

  @Post(':id/webhook')
  @ApiOperation({ summary: 'Registrar webhook de status de entrega desta instância na Whatsapp' })
  @ApiResponse({ status: 201, description: 'Webhook registrado (retorna a URL configurada)' })
  @ApiResponse({ status: 403, description: 'Instância não liberada para o usuário' })
  registerWebhook(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.whatsappInstances.registerWebhook(id, user.id);
  }
}
