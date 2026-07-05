import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { AutomationsService } from '@modules/automations/automations.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';
import { PaginationQueryDto, Paginated } from '@shared/pagination';

@ApiTags('Automations')
@ApiBearerAuth()
@Controller('events/:eventId/automations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar automações do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de automações' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.automations.listPaginated(eventId, page, limit);
    return { data, total, page, limit };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar automação por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da automação' })
  @ApiResponse({ status: 200, description: 'Automação encontrada' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.automations.findOne(eventId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar automação' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Automação criada' })
  @ApiResponse({ status: 404, description: 'Template não encontrado no evento' })
  create(@Param('eventId') eventId: string, @Body() dto: CreateAutomationDto) {
    return this.automations.create(eventId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar automação' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da automação' })
  @ApiResponse({ status: 200, description: 'Automação atualizada' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automations.update(eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar automação' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da automação' })
  @ApiResponse({ status: 204, description: 'Automação deletada' })
  delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.automations.delete(eventId, id);
  }
}
