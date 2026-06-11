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
  NotFoundException,
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
import { CreateTemplateDto, UpdateTemplateDto } from '../templates_dto/template.dto';
import { PaginationQueryDto, Paginated, paginationToSkip } from '@api/common/pagination';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('events/:eventId/templates')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class TemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar templates do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({
    name: 'include',
    required: false,
    enum: ['automation'],
    description: 'Incluir regras de automação',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de templates' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query('include') include?: string,
    @Query() pagination?: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    const where = { eventId };
    const total = await this.prisma.messageTemplate.count({ where });

    if (include !== 'automation') {
      const data = await this.prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      });
      return { data, total, page, limit };
    }

    const templates = await this.prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { automationRules: true },
      skip,
      take: limit,
    });
    // Relation is 1:N but the UI assumes at most one rule per template
    const data = templates.map(({ automationRules, ...template }) => ({
      ...template,
      automation: automationRules[0]
        ? {
            id: automationRules[0].id,
            trigger: automationRules[0].trigger,
            delayMinutes: automationRules[0].delayMinutes,
            active: automationRules[0].active,
          }
        : null,
    }));
    return { data, total, page, limit };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, eventId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Post()
  @ApiOperation({ summary: 'Criar template' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Template criado' })
  create(@Param('eventId') eventId: string, @Body() dto: CreateTemplateDto) {
    return this.prisma.messageTemplate.create({
      data: {
        eventId,
        name: dto.name,
        channel: dto.channel as any,
        subject: dto.subject,
        body: dto.body,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar template' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template atualizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const existing = await this.prisma.messageTemplate.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.channel !== undefined && { channel: dto.channel as any }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.body !== undefined && { body: dto.body }),
      },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar template' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 204, description: 'Template deletado' })
  async delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    const existing = await this.prisma.messageTemplate.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.messageTemplate.delete({ where: { id } });
  }
}
