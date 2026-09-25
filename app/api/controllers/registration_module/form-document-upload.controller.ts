import {
  Controller,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FormDocumentsService } from '@application/registration_module/form-documents.service';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const uploadBody = {
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
};

function uploadPipe() {
  return new ParseFilePipe({
    validators: [new MaxFileSizeValidator({ maxSize: MAX_DOCUMENT_BYTES })],
  });
}

@ApiTags('Public')
@Controller('public/forms')
export class PublicFormDocumentUploadController {
  constructor(private readonly documents: FormDocumentsService) {}

  @Post(':formId/fields/:fieldId/uploads')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 10 * 60 * 1000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  @ApiOperation({ summary: 'Upload temporário de documento para uma resposta pública' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadBody)
  upload(
    @Param('formId') formId: string,
    @Param('fieldId') fieldId: string,
    @UploadedFile(uploadPipe()) file: Express.Multer.File,
  ) {
    return this.documents.uploadTemporary(formId, fieldId, file);
  }
}

@ApiTags('Forms')
@ApiBearerAuth()
@Controller('events/:eventId/forms')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormDocumentUploadController {
  constructor(private readonly documents: FormDocumentsService) {}

  @Post(':formId/fields/:fieldId/uploads')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  @ApiOperation({ summary: 'Upload de documento pelo painel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadBody)
  upload(
    @Param('eventId') eventId: string,
    @Param('formId') formId: string,
    @Param('fieldId') fieldId: string,
    @UploadedFile(uploadPipe()) file: Express.Multer.File,
  ) {
    return this.documents.uploadFinal(eventId, formId, fieldId, file);
  }
}
