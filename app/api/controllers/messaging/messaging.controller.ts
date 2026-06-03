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
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';

@Controller('events/:eventId/messaging')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MessagingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async getLogs(
    @Param('eventId') eventId: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.messageLog.findMany({
      where: { registration: { eventId } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Sse('logs/stream')
  streamLogs(@Param('eventId') eventId: string): Observable<MessageEvent> {
    return interval(3000).pipe(
      switchMap(() =>
        this.prisma.messageLog.findMany({
          where: { registration: { eventId } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ),
      map((logs) => ({ data: JSON.stringify(logs) }) as MessageEvent),
    );
  }
}
