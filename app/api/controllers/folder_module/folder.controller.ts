import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { FolderService } from '@application/folder_module/folder.service';
import { FolderResourceType } from '@domain/folder_module/folder-resource-type';
import { FolderScope } from '@domain/folder_module/i-repository-folder';
import {
  CreateFolderDto,
  ListFoldersQueryDto,
  ReorderFoldersDto,
  UpdateFolderDto,
} from '@api/dto/folder_module/folder.dto';

/**
 * Pastas do painel do usuário: as que não moram dentro de nenhum evento. As que
 * moram num evento (e por isso acompanham o compartilhamento) ficam em
 * `EventFolderController`, sob `/events/:eventId/folders`.
 */
@ApiTags('Folders')
@ApiBearerAuth()
@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly folders: FolderService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pastas do painel por tipo (árvore, com children[])' })
  @ApiResponse({ status: 200, description: 'Pastas raiz com as subpastas embutidas' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListFoldersQueryDto) {
    return this.folders.tree(this.scope(user.id, query.resourceType));
  }

  @Post()
  @ApiOperation({ summary: 'Criar pasta no painel' })
  @ApiResponse({ status: 201, description: 'Pasta criada (order = fim do escopo irmão)' })
  @ApiResponse({ status: 400, description: 'Tipo incompatível com pasta de painel' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFolderDto) {
    return this.folders.create(this.scope(user.id, dto.resourceType), dto.name, dto.parentId);
  }

  // Antes do PATCH /:id — declarada depois, a rota 'reorder' cairia no :id.
  @Patch('reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reordenar pastas irmãs (drag & drop): order = índice na lista de ids' })
  @ApiResponse({ status: 204, description: 'Ordem reescrita' })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderFoldersDto) {
    return this.folders.reorder(this.scope(user.id, dto.resourceType), dto.ids);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomear ou mover pasta (parentId: null = raiz)' })
  @ApiParam({ name: 'id', description: 'UUID da pasta' })
  @ApiResponse({ status: 200, description: 'Pasta atualizada' })
  @ApiResponse({ status: 400, description: 'Ciclo ou profundidade máxima excedida' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folders.update(id, { ownerId: user.id, eventId: null }, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Deletar pasta — subpastas sobem para o pai e os registros são desassociados',
  })
  @ApiParam({ name: 'id', description: 'UUID da pasta' })
  @ApiResponse({ status: 204, description: 'Pasta deletada; nenhum registro é apagado' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.folders.delete(id, { ownerId: user.id, eventId: null });
  }

  // Tipo ausente = 'event': é o que as chamadas de antes do folder genérico mandam.
  private scope(ownerId: string, resourceType?: FolderResourceType): FolderScope {
    return { ownerId, eventId: null, resourceType: resourceType ?? 'event' };
  }
}
