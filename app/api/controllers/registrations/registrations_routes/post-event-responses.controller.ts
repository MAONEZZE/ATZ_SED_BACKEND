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
import { PaginationQueryDto, Paginated, paginationToSkip } from '@api/common/pagination';
import { buildPostEventResponsesCsv } from '@services/registrations/post-event-responses-csv';

@ApiTags('Post-Event Responses')
@ApiBearerAuth()
@Controller('events/:eventId/post-event-responses')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class PostEventResponsesController {
  constructor(private readonly prisma: PrismaService) {}

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
    const skip = paginationToSkip(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.postEventResponse.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          registration: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
      this.prisma.postEventResponse.count({ where: { eventId } }),
    ]);

    return { data, total, page, limit };
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar respostas pós-evento em CSV' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Arquivo CSV', content: { 'text/csv': {} } })
  async exportCsv(@Param('eventId') eventId: string, @Res() res: Response) {
    const [responses, postEventFields] = await Promise.all([
      this.prisma.postEventResponse.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        include: {
          registration: { select: { name: true, email: true, phone: true } },
        },
      }),
      this.prisma.formField.findMany({
        where: { eventId, kind: 'post_event' },
        orderBy: { order: 'asc' },
        select: { label: true },
      }),
    ]);

    const rows = responses.map((r) => ({
      name: r.registration.name,
      email: r.registration.email,
      phone: r.registration.phone,
      answers: (r.answers ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt,
    }));

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
