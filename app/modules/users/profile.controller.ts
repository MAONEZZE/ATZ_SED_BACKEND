import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';
import { ProfileService } from '@modules/users/profile.service';
import { UpdateProfileDto } from './dto/profile.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Buscar perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil do usuário' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getByUser(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar perfil' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Criar perfil se não existir (upsert idempotente)' })
  @ApiResponse({ status: 201, description: 'Perfil criado' })
  @ApiResponse({ status: 200, description: 'Perfil já existia' })
  async ensureProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { profile, created } = await this.profiles.ensure(user);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return profile;
  }

  @Post('me/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload de foto de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({ status: 201, description: 'Foto enviada' })
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.profiles.uploadPhoto(user.id, file);
  }

  @Delete('me/photo')
  @ApiOperation({ summary: 'Remover foto de perfil' })
  @ApiResponse({ status: 200, description: 'Foto removida' })
  deletePhoto(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.deletePhoto(user.id);
  }
}
