import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsIn,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { SendMessageDto } from '../messaging/messaging_dto/send-message.dto';
import { PaginationQueryDto, Paginated, paginationToSkip } from '@api/common/pagination';

class CreateGlobalTemplateDto {
  @ApiProperty({ example: 'Confirmação de inscrição' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: ['whatsapp', 'email'], example: 'email' })
  @IsEnum(['whatsapp', 'email'])
  channel!: string;

  @ApiPropertyOptional({ example: 'Sua inscrição foi confirmada!' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Olá {{name}}, sua inscrição foi confirmada.' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ description: 'Config visual (blob opaco). Só e-mail preenche.' })
  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['minimalista', 'profissional', 'acolhedor', 'elegante'] })
  @IsOptional()
  @IsIn(['minimalista', 'profissional', 'acolhedor', 'elegante'])
  styleKey?: string;

  @ApiPropertyOptional({
    example: 'uuid-do-evento',
    description: 'Vincula o template a um evento (opcional). Sem valor = template global.',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}

class UpdateGlobalTemplateDto {
  @ApiPropertyOptional({ example: 'Confirmação de inscrição' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: ['whatsapp', 'email'], example: 'email' })
  @IsOptional()
  @IsEnum(['whatsapp', 'email'])
  channel?: string;

  @ApiPropertyOptional({ example: 'Sua inscrição foi confirmada!' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Olá {{name}}, sua inscrição foi confirmada.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @ApiPropertyOptional({ description: 'Config visual (blob opaco). Só e-mail preenche.' })
  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['minimalista', 'profissional', 'acolhedor', 'elegante'] })
  @IsOptional()
  @IsIn(['minimalista', 'profissional', 'acolhedor', 'elegante'])
  styleKey?: string;

  @ApiPropertyOptional({
    example: 'uuid-do-evento',
    description: 'Vincula/desvincula o template de um evento. null = desvincular.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.eventId !== null)
  @IsUUID()
  eventId?: string | null;
}

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class GlobalMessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualSend: ManualSendService,
  ) {}

  // Garante que o evento a vincular pertence (ou é acessível) ao usuário.
  private async assertEventAccess(eventId: string, userId: string): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }],
      },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');
  }

  @Post('messaging/send')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enviar mensagem — eventId opcional no body' })
  @ApiResponse({ status: 202, description: 'Mensagem(ns) enfileirada(s)' })
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manualSend.send(dto, user.id);
  }

  @Post('messaging/templates')
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar template' })
  @ApiResponse({ status: 201, description: 'Template criado' })
  async createTemplate(
    @Body() dto: CreateGlobalTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.eventId) await this.assertEventAccess(dto.eventId, user.id);
    return this.prisma.messageTemplate.create({
      data: {
        ownerId: user.id,
        name: dto.name,
        channel: dto.channel as any,
        subject: dto.subject,
        body: dto.body,
        layoutConfig:
          dto.layoutConfig != null
            ? (dto.layoutConfig as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        styleKey: dto.styleKey ?? null,
        eventId: dto.eventId ?? null,
      },
    });
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'eventId',
    required: false,
    type: String,
    description: "Filtra por evento vinculado. 'null' retorna só os templates globais.",
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de templates' })
  async findTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
    @Query('eventId') eventId?: string,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    const where: Prisma.MessageTemplateWhereInput = {
      ownerId: user.id,
      ...(eventId === 'null' ? { eventId: null } : eventId ? { eventId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.messageTemplate.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async findTemplate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualizar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template atualizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.messageTemplate.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!existing) throw new NotFoundException('Template not found');
    if (dto.eventId) await this.assertEventAccess(dto.eventId, user.id);
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.channel !== undefined && { channel: dto.channel as any }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.layoutConfig !== undefined && {
          layoutConfig:
            dto.layoutConfig != null
              ? (dto.layoutConfig as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        }),
        ...(dto.styleKey !== undefined && { styleKey: dto.styleKey }),
        ...(dto.eventId !== undefined && { eventId: dto.eventId }),
      },
    });
  }

  @Delete('templates/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 204, description: 'Template deletado' })
  async deleteTemplate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const existing = await this.prisma.messageTemplate.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.messageTemplate.delete({ where: { id } });
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
    const where = {
      event: {
        OR: [{ ownerId: user.id }, { collaborators: { some: { profileId: user.id } } }],
      },
    };
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
    const where = {
      OR: [
        {
          event: {
            OR: [{ ownerId: user.id }, { collaborators: { some: { profileId: user.id } } }],
          },
        },
        { ownerId: user.id },
      ],
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
