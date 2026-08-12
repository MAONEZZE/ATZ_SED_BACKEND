import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { WhatsappInstanceService } from '@application/whatsapp_instance_module/whatsapp-instance.service';

@ApiTags('Whatsapp Instances')
@ApiBearerAuth()
@Controller('whatsapp-instances')
@UseGuards(JwtAuthGuard)
export class WhatsappInstanceController {
  constructor(private readonly whatsappInstances: WhatsappInstanceService) {}

  @Get()
  @ApiOperation({ summary: 'Listar instâncias Whatsapp disponíveis' })
  @ApiResponse({ status: 200, description: 'Lista de instâncias (id + apelido + active)' })
  list() {
    return this.whatsappInstances.list();
  }

  @Post(':id/webhook')
  @ApiOperation({ summary: 'Registrar webhook de status de entrega desta instância na Whatsapp' })
  @ApiResponse({ status: 201, description: 'Webhook registrado (retorna a URL configurada)' })
  registerWebhook(@Param('id') id: string) {
    return this.whatsappInstances.registerWebhook(id);
  }
}
