import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { EvolutionInstancesService } from '@modules/evolution-instances/evolution-instances.service';

@ApiTags('Evolution Instances')
@ApiBearerAuth()
@Controller('evolution-instances')
@UseGuards(JwtAuthGuard)
export class EvolutionInstancesController {
  constructor(private readonly evolutionInstances: EvolutionInstancesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar instâncias Evolution disponíveis' })
  @ApiResponse({ status: 200, description: 'Lista de instâncias (id + apelido)' })
  list() {
    return this.evolutionInstances.list();
  }
}
