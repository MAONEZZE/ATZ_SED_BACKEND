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
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { AutomationService } from '@application/automation_module/automation.service';
import {
  CreateAutomationDto,
  ListAutomationsQueryDto,
  ReorderAutomationsDto,
  UpdateAutomationDto,
} from '@api/dto/automation_module/automation.dto';
import { Paginated } from '@api/dto/shared/pagination';

@ApiTags('Automations')
@ApiBearerAuth()
@Controller('events/:eventId/automations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class AutomationController {
  constructor(private readonly automations: AutomationService) {}

  @Get()
  @ApiOperation({ summary: 'Listar automações do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'folderId',
    required: false,
    type: String,
    description: "Filtra por pasta. 'null' retorna só as regras fora de pasta.",
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de automações' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: ListAutomationsQueryDto,
  ): Promise<Paginated<object>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // A query string carrega a literal 'null' para pedir só as regras fora de
    // pasta; ausente é "sem filtro".
    const folderId = query.folderId === 'null' ? null : query.folderId;
    const { data, total } = await this.automations.listPaginated(eventId, page, limit, folderId);
    return { data, total, page, limit };
  }

  // Antes do PATCH /:id — declarada depois, 'reorder' cairia no :id.
  @Patch('reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reordenar automações dentro de uma pasta (drag & drop)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 204, description: 'Ordem reescrita' })
  @ApiResponse({ status: 404, description: 'Pasta não encontrada' })
  reorder(@Param('eventId') eventId: string, @Body() dto: ReorderAutomationsDto) {
    return this.automations.reorder(eventId, dto.folderId ?? null, dto.ids);
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
