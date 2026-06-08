import { Controller, Get, Patch, Param, Body, UseGuards, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { buildRegistrationsCsv } from '@services/registrations/registrations-csv';
import { FunnelStatus } from '@domain/registrations/entities/registration.entity';
import { UpdateRegistrationStatusDto } from '../registrations_dto/update-registration-status.dto';
import { PrismaService } from '@database/prisma/prisma.service';
import { PaginationQueryDto, Paginated } from '@api/common/pagination';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller('events/:eventId/registrations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class RegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar inscrições do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'] })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome ou email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de inscrições' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: FunnelStatus,
    @Query('search') search?: string,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.registrations.findAllPaginated(
      eventId,
      page,
      limit,
      status,
      search,
    );
    return { data, total, page, limit };
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar inscrições em CSV' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Arquivo CSV', content: { 'text/csv': {} } })
  async exportCsv(
    @Param('eventId') eventId: string,
    @Res() res: Response,
    @Query('status') status?: FunnelStatus,
    @Query('search') search?: string,
  ) {
    const [regs, formFields] = await Promise.all([
      this.registrations.findAll(eventId, status, search),
      this.prisma.formField.findMany({
        where: { eventId, isFixed: false },
        orderBy: { order: 'asc' },
        select: { label: true },
      }),
    ]);
    const csv = buildRegistrationsCsv(regs, formFields);
    const date = new Date().toISOString().slice(0, 10);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="inscricoes-${eventId}-${date}.csv"`)
      .send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar inscrição por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Inscrição encontrada' })
  findOne(@Param('id') id: string) {
    return this.registrations.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status da inscrição (funil)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Status atualizado' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrations.updateStatus(id, dto.status, user.id);
  }
}
