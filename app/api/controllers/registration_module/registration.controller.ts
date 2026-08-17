import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { RegistrationService } from '@application/registration_module/registration.service';
import { FormFieldService } from '@application/form_field_module/form-field.service';
import { FormService } from '@application/form_module/form.service';
import { buildRegistrationsCsv } from '@application/registration_module/registration-csv';
import { UpdateRegistrationStatusDto } from '@api/dto/registration_module/update-registration-status.dto';
import { UpdateRegistrationAnswersDto } from '@api/dto/registration_module/update-registration-answers.dto';
import { ListRegistrationsQueryDto } from '@api/dto/registration_module/list-registrations-query.dto';
import { ImportRegistrationsDto } from '@api/dto/registration_module/import-registrations.dto';
import {
  DeleteRegistrationsDto,
  SetAttendanceDto,
} from '@api/dto/registration_module/registration-batch.dto';
import { Paginated } from '@api/dto/shared/pagination';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller('events/:eventId/registrations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class RegistrationController {
  constructor(
    private readonly registrations: RegistrationService,
    private readonly formFields: FormFieldService,
    private readonly forms: FormService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar inscrições do evento (format=csv exporta CSV)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome ou email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'attended', required: false, type: Boolean, description: 'Filtra por presença' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista paginada (JSON) ou arquivo CSV' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: ListRegistrationsQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Paginated<object> | string> {
    const { status, search, format, attended } = query;
    if (format === 'csv') {
      // As colunas dinâmicas do CSV são os campos do formulário principal do
      // evento (o de menor `order`) — sem os 3 tipos fixos, é ele que faz o papel
      // do antigo kind=registration.
      const primary = await this.forms.primary(eventId);
      const [regs, formFields] = await Promise.all([
        this.registrations.findAll(eventId, status, search, attended),
        primary ? this.formFields.exportLabels(primary.id, true) : Promise.resolve([]),
      ]);
      const date = new Date().toISOString().slice(0, 10);
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader(
        'Content-Disposition',
        `attachment; filename="inscricoes-${eventId}-${date}.csv"`,
      );
      return buildRegistrationsCsv(regs, formFields);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.registrations.findAllPaginated(
      eventId,
      page,
      limit,
      status,
      search,
      attended,
    );
    return { data, total, page, limit };
  }

  @Post('import')
  @ApiOperation({ summary: 'Importar inscrições em lote (ex: planilha)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Resumo da importação: criados/pulados' })
  importMany(
    @Param('eventId') eventId: string,
    @Body() dto: ImportRegistrationsDto,
  ): Promise<{ created: number; skipped: number }> {
    return this.registrations.importMany(eventId, dto.registrations);
  }

  @Delete()
  @ApiOperation({ summary: 'Deletar inscrições em massa (por ids explícitos, máx. 500)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: '{ deleted: n } — apaga também mensagens e logs' })
  deleteMany(
    @Param('eventId') eventId: string,
    @Body() dto: DeleteRegistrationsDto,
  ): Promise<{ deleted: number }> {
    return this.registrations
      .deleteMany(dto.ids, eventId)
      .then((deleted) => ({ deleted }));
  }

  // Antes do PATCH /:id — declarada depois, 'attendance' cairia no :id.
  @Patch('attendance')
  @ApiOperation({ summary: 'Marcar/desmarcar presença em lote (check-in pelo painel)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: '{ updated: n }' })
  setAttendance(
    @Param('eventId') eventId: string,
    @Body() dto: SetAttendanceDto,
  ): Promise<{ updated: number }> {
    return this.registrations
      .setAttendance(dto.ids, eventId, dto.attended)
      .then((updated) => ({ updated }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar inscrição por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Inscrição encontrada' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.registrations.findById(id, eventId);
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
    const primary = await this.forms.primary(eventId);
    const formFields = primary ? await this.formFields.validationFields(primary.id) : [];
    return this.registrations.updateAnswers(id, eventId, dto.answers, formFields);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar inscrição' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 204, description: 'Inscrição apagada (com mensagens e logs dela)' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    return this.registrations.delete(id, eventId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status da inscrição (funil)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Status atualizado' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  updateStatus(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrations.updateStatus(id, eventId, dto.status, user.id);
  }
}
