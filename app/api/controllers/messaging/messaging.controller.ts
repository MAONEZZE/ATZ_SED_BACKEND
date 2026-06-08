import {
  Controller,
  Get,
  Param,
  UseGuards,
  Sse,
  MessageEvent,
  Query,
} from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('events/:eventId/messaging')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MessagingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Listar logs de mensagens do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de registros (padrão: 100)' })
  @ApiResponse({ status: 200, description: 'Lista de logs' })
  async getLogs(@Param('eventId') eventId: string, @Query('limit') limit?: string) {
    return this.prisma.messageLog.findMany({
      where: { OR: [{ eventId }, { eventId: null, registration: { eventId } }] },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Sse('logs/stream')
  @ApiOperation({ summary: 'Stream SSE de logs de mensagens (polling 3s)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Server-Sent Events stream', content: { 'text/event-stream': {} } })
  streamLogs(@Param('eventId') eventId: string): Observable<MessageEvent> {
    return interval(3000).pipe(
      switchMap(() =>
        this.prisma.messageLog.findMany({
          where: { OR: [{ eventId }, { eventId: null, registration: { eventId } }] },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ),
      map((logs) => ({ data: JSON.stringify(logs) })),
    );
  }
}
