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
  NotFoundException,
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
import { PrismaService } from '@database/prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from '../automations_dto/automation.dto';
import { PaginationQueryDto, Paginated, paginationToSkip } from '@api/common/pagination';

@ApiTags('Automations')
@ApiBearerAuth()
@Controller('events/:eventId/automations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class AutomationsController {
  constructor(private readonly prisma: PrismaService) {}

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
    const skip = paginationToSkip(page, limit);
    const where = { eventId };
    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        include: { template: { select: { id: true, name: true, channel: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar automação por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da automação' })
  @ApiResponse({ status: 200, description: 'Automação encontrada' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  async findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, eventId },
      include: { template: true },
    });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  @Post()
  @ApiOperation({ summary: 'Criar automação' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Automação criada' })
  @ApiResponse({ status: 404, description: 'Template não encontrado no evento' })
  async create(@Param('eventId') eventId: string, @Body() dto: CreateAutomationDto) {
    // Verify template belongs to this event
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: dto.templateId, eventId },
    });
    if (!template) throw new NotFoundException('Template not found in this event');

    return this.prisma.automationRule.create({
      data: {
        eventId,
        templateId: dto.templateId,
        trigger: dto.trigger as any,
        delayMinutes: dto.delayMinutes,
        active: dto.active ?? true,
      },
      include: { template: { select: { id: true, name: true, channel: true } } },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar automação' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da automação' })
  @ApiResponse({ status: 200, description: 'Automação atualizada' })
  @ApiResponse({ status: 404, description: 'Automação não encontrada' })
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Automation rule not found');

    if (dto.templateId) {
      const template = await this.prisma.messageTemplate.findFirst({
        where: { id: dto.templateId, eventId },
      });
      if (!template) throw new NotFoundException('Template not found in this event');
    }

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.templateId && { templateId: dto.templateId }),
        ...(dto.trigger && { trigger: dto.trigger as any }),
        ...(dto.delayMinutes !== undefined && { delayMinutes: dto.delayMinutes }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: { template: { select: { id: true, name: true, channel: true } } },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar automação' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da automação' })
  @ApiResponse({ status: 204, description: 'Automação deletada' })
  async delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Automation rule not found');
    await this.prisma.automationRule.delete({ where: { id } });
  }
}
