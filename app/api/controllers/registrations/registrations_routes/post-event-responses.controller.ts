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
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PaginationQueryDto, Paginated } from '@api/common/pagination';
import { PostEventResponsesService } from '@services/registrations/post-event-responses.service';
import { FormFieldsService } from '@services/events/form-fields.service';
import { buildPostEventResponsesCsv } from '@services/registrations/post-event-responses-csv';

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
  @ApiOperation({ summary: 'Listar respostas pós-evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de respostas pós-evento' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.postEventResponses.listPaginated(eventId, page, limit);
    return { data, total, page, limit };
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar respostas pós-evento em CSV' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Arquivo CSV', content: { 'text/csv': {} } })
  async exportCsv(@Param('eventId') eventId: string, @Res() res: Response) {
    const [rows, postEventFields] = await Promise.all([
      this.postEventResponses.exportRows(eventId),
      this.formFields.exportLabels(eventId, 'post_event'),
    ]);

    const csv = buildPostEventResponsesCsv(rows, postEventFields);
    const date = new Date().toISOString().slice(0, 10);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="respostas-pos-evento-${eventId}-${date}.csv"`,
      )
      .send(csv);
  }
}
