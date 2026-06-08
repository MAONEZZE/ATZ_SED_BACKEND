import { Controller, Get, Post, Body, HttpCode, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { SendMessageDto } from '../messaging/messaging_dto/send-message.dto';
import { PaginationQueryDto, Paginated, paginationToSkip } from '@api/common/pagination';

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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de templates com evento' })
  async findTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    const where = { event: { ownerId: user.id } };
    const [data, total] = await Promise.all([
      this.prisma.messageTemplate.findMany({
        where,
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.messageTemplate.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  @Get('automations')
  @ApiOperation({ summary: 'Listar automações de todos os eventos do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de automações com evento e template' })
  async findAutomations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    const where = { event: { ownerId: user.id } };
    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        include: {
          event: { select: { id: true, title: true } },
          template: { select: { id: true, name: true, channel: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  @Get('messaging/logs')
  @ApiOperation({ summary: 'Listar logs de mensagens de todos os eventos do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs com evento' })
  async findLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    // OR: logs tied to user's events + global sends (ownerId set, no eventId)
    const where = {
      OR: [{ event: { ownerId: user.id } }, { ownerId: user.id }],
    };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
