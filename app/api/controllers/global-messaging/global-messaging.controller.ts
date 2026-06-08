import { Controller, Get, Post, Body, HttpCode, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { SendMessageDto } from '../messaging/messaging_dto/send-message.dto';

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class GlobalMessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualSend: ManualSendService,
  ) {}

  @Post('messaging/send')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enviar mensagem — eventId opcional no body' })
  @ApiResponse({ status: 202, description: 'Mensagem(ns) enfileirada(s)' })
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manualSend.send(dto, user.id);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de todos os eventos do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de templates com evento' })
  findTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.messageTemplate.findMany({
      where: { event: { ownerId: user.id } },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('automations')
  @ApiOperation({ summary: 'Listar automações de todos os eventos do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de automações com evento e template' })
  findAutomations(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.automationRule.findMany({
      where: { event: { ownerId: user.id } },
      include: {
        event: { select: { id: true, title: true } },
        template: { select: { id: true, name: true, channel: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('messaging/logs')
  @ApiOperation({ summary: 'Listar logs de mensagens de todos os eventos do usuário' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de registros (padrão: 200)' })
  @ApiResponse({ status: 200, description: 'Lista de logs com evento' })
  findLogs(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.prisma.messageLog.findMany({
      where: { event: { ownerId: user.id } },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 200,
    });
  }
}
