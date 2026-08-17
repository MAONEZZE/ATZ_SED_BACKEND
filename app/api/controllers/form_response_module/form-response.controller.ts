import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { FormResponseService } from '@application/form_response_module/form-response.service';
import { FormFieldService } from '@application/form_field_module/form-field.service';
import { buildFormResponsesCsv } from '@application/form_response_module/form-response-csv';
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista paginada (JSON) ou arquivo CSV' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query('formId') formId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Paginated<object> | string> {
    if (format === 'csv') {
      // As colunas dinâmicas são os campos do formulário, então o CSV é por
      // formulário: sem formId não há cabeçalho coerente.
      const [rows, fields] = await Promise.all([
        this.responses.exportRows(eventId, formId),
        formId ? this.formFields.exportLabels(formId) : Promise.resolve([]),
      ]);
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader('Content-Disposition', `attachment; filename="respostas-${eventId}.csv"`);
      return buildFormResponsesCsv(rows, fields);
    }

    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const { data, total } = await this.responses.listPaginated(eventId, p, l, formId);
    return { data, total, page: p, limit: l };
  }
}
