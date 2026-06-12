import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { STORAGE_PORT, StoragePort } from '@domain/shared/ports/storage.port';
import { UpdateProfileDto } from '../users_dto/profile.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Buscar perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil do usuário' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar perfil' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.profile.update({
      where: { userId: user.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.evolutionInstance !== undefined && { evolutionInstance: dto.evolutionInstance }),
      },
    });
  }

  @Post('ensure')
  @ApiOperation({ summary: 'Criar perfil se não existir (idempotente)' })
  @ApiResponse({ status: 201, description: 'Perfil criado ou retornado' })
  async ensureProfile(@CurrentUser() user: AuthenticatedUser) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (existing) return existing;

    return this.prisma.profile.create({
      data: {
        // id = auth uid: Event.ownerId (FK → Profile.id) recebe user.id nos
        // controllers e o OwnershipGuard compara com user.id — precisam bater.
        id: user.id,
        userId: user.id,
        name: user.email.split('@')[0],
        email: user.email,
      },
    });
  }

  @Post('me/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload de foto de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({ status: 201, description: 'Foto enviada' })
  async uploadPhoto(
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
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');

    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_PROFILE_PHOTOS') ?? 'profile-photo';
    const path = `${folder}/${profile.id}/photo`;
    const { url } = await this.storage.upload(bucket, path, file.buffer, file.mimetype);

    return this.prisma.profile.update({
      where: { userId: user.id },
      data: { photoUrl: url },
    });
  }

  @Delete('me/photo')
  @ApiOperation({ summary: 'Remover foto de perfil' })
  @ApiResponse({ status: 200, description: 'Foto removida' })
  async deletePhoto(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new NotFoundException('Profile not found');

    if (profile.photoUrl) {
      const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
      const folder =
        this.config.get<string>('SUPABASE_STORAGE_BUCKET_PROFILE_PHOTOS') ?? 'profile-photo';
      // Mesma convenção de path do upload — não parsear a URL pública
      const path = `${folder}/${profile.id}/photo`;
      try {
        await this.storage.delete(bucket, path);
      } catch {
        // Objeto ausente não deve impedir limpar a URL
      }
    }

    return this.prisma.profile.update({
      where: { userId: user.id },
      data: { photoUrl: null },
    });
  }
}
