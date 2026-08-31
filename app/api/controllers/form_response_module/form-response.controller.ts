import { Body, Controller, Delete, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { FormResponseService } from '@application/form_response_module/form-response.service';
import { FormFieldService } from '@application/form_field_module/form-field.service';
import { buildFormResponsesCsv } from '@application/form_response_module/form-response-csv';
import { DeleteFormResponsesDto } from '@api/dto/form_response_module/form-response-batch.dto';
import { ListFormResponsesQueryDto } from '@api/dto/form_response_module/list-form-responses-query.dto';
import { Paginated } from '@api/dto/shared/pagination';

@ApiTags('Form Responses')
@ApiBearerAuth()
@Controller('events/:eventId/form-responses')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormResponseController {
  constructor(
    private readonly responses: FormResponseService,
    private readonly formFields: FormFieldService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar respostas de formulário do evento (format=csv exige formId)',
  })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'formId', required: false, description: 'Filtra por formulário' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Busca por nome, email ou telefone do inscrito',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Máximo 100' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista paginada (JSON) ou arquivo CSV' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: ListFormResponsesQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Paginated<object> | string> {
    const { formId, search, format } = query;
    if (format === 'csv') {
      // As colunas dinâmicas são os campos do formulário, então o CSV é por
      // formulário: sem formId não há cabeçalho coerente.
      const [rows, fields] = await Promise.all([
        this.responses.exportRows(eventId, formId, search),
        formId ? this.formFields.exportLabels(formId) : Promise.resolve([]),
      ]);
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader('Content-Disposition', `attachment; filename="respostas-${eventId}.csv"`);
      return buildFormResponsesCsv(rows, fields);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.responses.listPaginated(
      eventId,
      page,
      limit,
      formId,
      search,
    );
    return { data, total, page, limit };
  }

  @Delete()
  @ApiOperation({ summary: 'Deletar respostas em massa (por ids explícitos, máx. 500)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({
    status: 200,
    description:
      '{ deleted: n } — ids inexistentes ou de outro evento são ignorados. Não apaga o inscrito vinculado.',
  })
  @ApiResponse({
    status: 400,
    description: 'ids ausente, vazio, com UUID inválido ou acima de 500',
  })
  deleteMany(
    @Param('eventId') eventId: string,
    @Body() dto: DeleteFormResponsesDto,
  ): Promise<{ deleted: number }> {
    return this.responses.deleteMany(dto.ids, eventId).then((deleted) => ({ deleted }));
  }
}
