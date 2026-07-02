import { Controller, Get, Param, UseGuards, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
import { PaginationQueryDto, Paginated } from '@shared/pagination';
import { PostEventResponsesService } from '@modules/registrations/post-event-responses.service';
import { FormFieldsService } from '@modules/events/form-fields.service';
import { buildPostEventResponsesCsv } from '@modules/registrations/post-event-responses-csv';

@ApiTags('Post-Event Responses')
@ApiBearerAuth()
@Controller('events/:eventId/post-event-responses')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class PostEventResponsesController {
  constructor(
    private readonly postEventResponses: PostEventResponsesService,
    private readonly formFields: FormFieldsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar respostas pós-evento (format=csv exporta CSV)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista paginada (JSON) ou arquivo CSV' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Paginated<object> | string> {
    if (format === 'csv') {
      const [rows, postEventFields] = await Promise.all([
        this.postEventResponses.exportRows(eventId),
        this.formFields.exportLabels(eventId, 'post_event'),
      ]);
      const date = new Date().toISOString().slice(0, 10);
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader(
        'Content-Disposition',
        `attachment; filename="respostas-pos-evento-${eventId}-${date}.csv"`,
      );
      return buildPostEventResponsesCsv(rows, postEventFields);
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.postEventResponses.listPaginated(eventId, page, limit);
    return { data, total, page, limit };
  }
}
