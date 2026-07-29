import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { UazapiInstancesService } from '@modules/uazapi-instances/uazapi-instances.service';

@ApiTags('Uazapi Instances')
@ApiBearerAuth()
@Controller('uazapi-instances')
@UseGuards(JwtAuthGuard)
export class UazapiInstancesController {
  constructor(private readonly uazapiInstances: UazapiInstancesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar instâncias Uazapi disponíveis' })
  @ApiResponse({ status: 200, description: 'Lista de instâncias (id + apelido + active)' })
  list() {
    return this.uazapiInstances.list();
  }

  @Post(':id/webhook')
  @ApiOperation({ summary: 'Registrar webhook de status de entrega desta instância na Uazapi' })
  @ApiResponse({ status: 201, description: 'Webhook registrado (retorna a URL configurada)' })
  registerWebhook(@Param('id') id: string) {
    return this.uazapiInstances.registerWebhook(id);
  }
}
