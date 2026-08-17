import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { FolderService } from '@application/folder_module/folder.service';
import {
  CreateFolderDto,
  ReorderFoldersDto,
  UpdateFolderDto,
} from '@api/dto/folder_module/folder.dto';

@ApiTags('Folders')
@ApiBearerAuth()
@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly folders: FolderService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pastas do usuário (árvore, com children[])' })
  @ApiResponse({ status: 200, description: 'Pastas raiz com as subpastas embutidas' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.folders.tree(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar pasta' })
  @ApiResponse({ status: 201, description: 'Pasta criada (order = fim do escopo irmão)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFolderDto) {
    return this.folders.create(user.id, dto.name, dto.parentId);
  }

  // Antes do PATCH /:id — declarada depois, a rota 'reorder' cairia no :id.
  @Patch('reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reordenar pastas irmãs (drag & drop): order = índice na lista de ids' })
  @ApiResponse({ status: 204, description: 'Ordem reescrita' })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderFoldersDto) {
    return this.folders.reorder(user.id, dto.ids);
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
    return this.folders.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Deletar pasta — subpastas sobem para o pai e eventos são desassociados',
  })
  @ApiParam({ name: 'id', description: 'UUID da pasta' })
  @ApiResponse({ status: 204, description: 'Pasta deletada; nenhum evento é apagado' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.folders.delete(id, user.id);
  }
}
