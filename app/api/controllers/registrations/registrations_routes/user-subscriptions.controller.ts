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
import { PrismaService } from '@database/prisma/prisma.service';
import { PaginationQueryDto, Paginated } from '@api/common/pagination';
import { UserSubscriptionsService } from '@services/registrations/user-subscriptions.service';
import { buildUserSubscriptionsCsv } from '@services/registrations/user-subscriptions-csv';

@ApiTags('User Subscriptions')
@ApiBearerAuth()
@Controller('events/:eventId/user-subscriptions')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class UserSubscriptionsController {
  constructor(
    private readonly userSubscriptions: UserSubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar inscritos consolidados (inscrição + pós-evento + NPS)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome, email ou telefone' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de inscritos consolidados' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('search') search?: string,
  ): Promise<Paginated<object>> {
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

  @Get('export')
  @ApiOperation({ summary: 'Exportar inscritos consolidados em CSV' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome, email ou telefone' })
  @ApiResponse({ status: 200, description: 'Arquivo CSV', content: { 'text/csv': {} } })
  async exportCsv(
    @Param('eventId') eventId: string,
    @Res() res: Response,
    @Query('search') search?: string,
  ) {
    const [rows, registration, postEvent, nps] = await Promise.all([
      this.userSubscriptions.findAllByEvent(eventId, search),
      this.prisma.formField.findMany({
        where: { eventId, isFixed: false, kind: 'registration' },
        orderBy: { order: 'asc' },
        select: { label: true },
      }),
      this.prisma.formField.findMany({
        where: { eventId, kind: 'post_event' },
        orderBy: { order: 'asc' },
        select: { label: true },
      }),
      this.prisma.formField.findMany({
        where: { eventId, kind: 'nps' },
        orderBy: { order: 'asc' },
        select: { label: true },
      }),
    ]);

    const csv = buildUserSubscriptionsCsv(rows, { registration, postEvent, nps });
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="inscritos-${eventId}.csv"`)
      .send(csv);
  }
}
