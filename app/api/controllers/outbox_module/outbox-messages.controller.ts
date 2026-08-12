import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@api/controllers/shared/authenticated-user.entity';
import { ManualSendService } from '@application/outbox_module/manual-send.service';
import { MessageAttachmentsService } from '@application/outbox_module/message-attachments.service';
import { SendMessageDto } from '@api/dto/outbox_module/send-message.dto';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class OutboxMessagesController {
  constructor(
    private readonly manualSend: ManualSendService,
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
}
