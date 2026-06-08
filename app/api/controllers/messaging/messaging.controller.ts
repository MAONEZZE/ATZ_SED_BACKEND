import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
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
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { SendMessageDto } from './messaging_dto/send-message.dto';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('events/:eventId/messaging')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualSend: ManualSendService,
  ) {}

  @Post('send')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enviar mensagem manual' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 202, description: 'Mensagem enfileirada para envio' })
  send(
    @Param('eventId') eventId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.manualSend.send({ ...dto, eventId }, user.id);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Listar logs de mensagens' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de registros (padrão: 100)' })
  @ApiResponse({ status: 200, description: 'Lista de logs' })
  async getLogs(@Param('eventId') eventId: string, @Query('limit') limit?: string) {
    return this.prisma.messageLog.findMany({
      // eventId direto cobre destinatários avulsos (registrationId null);
      // OR via registration cobre logs antigos sem event_id backfilled
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
