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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';
import { ManualSendService } from '@modules/messaging/manual-send.service';
import { TemplatesService } from '@modules/messaging/templates.service';
import { MessageLogsService } from '@modules/messaging/message-logs.service';
import { AutomationsService } from '@modules/automations/automations.service';
import { MessageAttachmentsService } from '@modules/messaging/message-attachments.service';
import { SendMessageDto } from './dto/send-message.dto';
import {
  CreateGlobalTemplateDto,
  UpdateGlobalTemplateDto,
} from './dto/global-template.dto';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import { PaginationQueryDto, Paginated } from '@shared/pagination';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class GlobalMessagingController {
  constructor(
    private readonly manualSend: ManualSendService,
    private readonly templates: TemplatesService,
    private readonly logs: MessageLogsService,
    private readonly automations: AutomationsService,
    private readonly attachments: MessageAttachmentsService,
  ) {}

  @Post('messages')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enviar mensagem — eventId opcional no body' })
  @ApiResponse({ status: 202, description: 'Mensagem(ns) enfileirada(s)' })
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manualSend.send(dto, user.id);
  }

  @Post('messages/attachments')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  @ApiOperation({ summary: 'Upload de anexo para envio de mensagem' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, description: 'Anexo enviado; use o path no POST /messages' })
  uploadAttachment(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_ATTACHMENT_BYTES }),
          new FileTypeValidator({
            fileType:
              /(image\/(jpeg|png|webp|gif))|(application\/pdf)|(application\/msword)|(application\/vnd\.openxmlformats-officedocument\.[\w.-]+)|(application\/vnd\.ms-(excel|powerpoint))|(video\/mp4)|(audio\/(mpeg|ogg))/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.upload(user.id, file);
  }

  @Post('messaging/templates')
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar template' })
  @ApiResponse({ status: 201, description: 'Template criado' })
  createTemplate(@Body() dto: CreateGlobalTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.create(user.id, dto);
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
    @Query() query: ListTemplatesQueryDto,
  ): Promise<Paginated<object>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.templates.list(user.id, query.eventId, page, limit);
    return { data, total, page, limit };
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  findTemplate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.findOne(user.id, id);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualizar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template atualizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.templates.update(user.id, id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 204, description: 'Template deletado' })
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.delete(user.id, id);
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
    const { data, total } = await this.automations.listForUser(user.id, page, limit);
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
    const { data, total } = await this.logs.listForUser(user.id, page, limit);
    return { data, total, page, limit };
  }
}
