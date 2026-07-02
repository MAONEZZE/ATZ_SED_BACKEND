import { Controller, Get, Param, UseGuards, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
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
import { MessageLogsService } from '@services/messaging/message-logs.service';
import { PaginationQueryDto, Paginated } from '@api/common/pagination';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('events/:eventId/message-logs')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MessagingController {
  constructor(private readonly logs: MessageLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar logs de mensagens do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs' })
  async getLogs(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.logs.listForEvent(eventId, page, limit);
    return { data, total, page, limit };
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Stream SSE de logs de mensagens (polling 3s)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({
    status: 200,
    description: 'Server-Sent Events stream',
    content: { 'text/event-stream': {} },
  })
  streamLogs(@Param('eventId') eventId: string): Observable<MessageEvent> {
    return interval(3000).pipe(
      switchMap(() => this.logs.streamForEvent(eventId)),
      map((logs) => ({ data: JSON.stringify(logs) })),
    );
  }
}
