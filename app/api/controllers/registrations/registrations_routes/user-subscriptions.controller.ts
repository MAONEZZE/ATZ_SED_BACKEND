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
import { UserSubscriptionsService } from '@services/registrations/user-subscriptions.service';
import { FormFieldsService } from '@services/events/form-fields.service';
import { buildUserSubscriptionsCsv } from '@services/registrations/user-subscriptions-csv';

@ApiTags('User Subscriptions')
@ApiBearerAuth()
@Controller('events/:eventId/user-subscriptions')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class UserSubscriptionsController {
  constructor(
    private readonly userSubscriptions: UserSubscriptionsService,
    private readonly formFields: FormFieldsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar inscritos consolidados (inscrição + pós-evento + NPS; format=csv exporta CSV)',
  })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome, email ou telefone' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista paginada (JSON) ou arquivo CSV' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('search') search?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Paginated<object> | string> {
    if (format === 'csv') {
      const [rows, registration, postEvent, nps] = await Promise.all([
        this.userSubscriptions.findAllByEvent(eventId, search),
        this.formFields.exportLabels(eventId, 'registration', true),
        this.formFields.exportLabels(eventId, 'post_event'),
        this.formFields.exportLabels(eventId, 'nps'),
      ]);
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader('Content-Disposition', `attachment; filename="inscritos-${eventId}.csv"`);
      return buildUserSubscriptionsCsv(rows, { registration, postEvent, nps });
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.userSubscriptions.findAllPaginated(
      eventId,
      page,
      limit,
      search,
    );
    return { data, total, page, limit };
  }
}
