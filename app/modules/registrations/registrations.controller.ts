import { Controller, Get, Patch, Param, Body, UseGuards, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';
import { RegistrationsService } from '@modules/registrations/registrations.service';
import { FormFieldsService } from '@modules/events/form-fields.service';
import { buildRegistrationsCsv } from '@modules/registrations/registrations-csv';
import { FunnelStatus } from '@modules/registrations/entities/registration.entity';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { UpdateRegistrationAnswersDto } from './dto/update-registration-answers.dto';
import { PaginationQueryDto, Paginated } from '@shared/pagination';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller('events/:eventId/registrations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class RegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly formFields: FormFieldsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar inscrições do evento (format=csv exporta CSV)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome ou email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista paginada (JSON) ou arquivo CSV' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: FunnelStatus,
    @Query('search') search?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Paginated<object> | string> {
    if (format === 'csv') {
      const [regs, formFields] = await Promise.all([
        this.registrations.findAll(eventId, status, search),
        this.formFields.exportLabels(eventId, 'registration', true),
      ]);
      const date = new Date().toISOString().slice(0, 10);
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader(
        'Content-Disposition',
        `attachment; filename="inscricoes-${eventId}-${date}.csv"`,
      );
      return buildRegistrationsCsv(regs, formFields);
    }

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

  @Get(':id')
  @ApiOperation({ summary: 'Buscar inscrição por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Inscrição encontrada' })
  findOne(@Param('id') id: string) {
    return this.registrations.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar respostas da inscrição' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Inscrição atualizada' })
  @ApiResponse({ status: 400, description: 'Campo obrigatório ausente' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  async updateAnswers(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationAnswersDto,
  ) {
    const formFields = await this.formFields.validationFields(eventId, 'registration');
    return this.registrations.updateAnswers(id, eventId, dto.answers, formFields);
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
