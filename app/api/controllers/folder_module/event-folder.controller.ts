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
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
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
 * Pastas que moram dentro de um evento — templates de mensagem e regras de
 * automação daquele evento. Ficam aqui, e não em `/folders`, porque assim
 * acompanham o evento no compartilhamento em vez de ficarem presas ao perfil que
 * as criou.
 *
 * O `OwnershipGuard` já resolve a permissão pelo verbo: GET exige papel `read`,
 * qualquer escrita exige `invited` — ou seja, `admin` e `invited` organizam,
 * `read` só olha.
 */
@ApiTags('Folders')
@ApiBearerAuth()
@Controller('events/:eventId/folders')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class EventFolderController {
  constructor(private readonly folders: FolderService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pastas do evento por tipo (árvore, com children[])' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Pastas raiz com as subpastas embutidas' })
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFoldersQueryDto,
  ) {
    return this.folders.tree(this.scope(user.id, eventId, query.resourceType));
  }

  @Post()
  @ApiOperation({ summary: 'Criar pasta dentro do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Pasta criada (order = fim do escopo irmão)' })
  @ApiResponse({ status: 400, description: '`resourceType: event` não vive dentro de um evento' })
  @ApiResponse({ status: 403, description: "Papel 'read' não organiza pastas" })
  create(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFolderDto,
  ) {
    return this.folders.create(
      this.scope(user.id, eventId, dto.resourceType),
      dto.name,
      dto.parentId,
    );
  }

  // Antes do PATCH /:id — declarada depois, a rota 'reorder' cairia no :id.
  @Patch('reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reordenar pastas irmãs do evento' })
  @ApiResponse({ status: 204, description: 'Ordem reescrita' })
  reorder(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderFoldersDto,
  ) {
    return this.folders.reorder(this.scope(user.id, eventId, dto.resourceType), dto.ids);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomear ou mover pasta do evento (parentId: null = raiz)' })
  @ApiParam({ name: 'id', description: 'UUID da pasta' })
  @ApiResponse({ status: 200, description: 'Pasta atualizada' })
  @ApiResponse({ status: 400, description: 'Ciclo ou profundidade máxima excedida' })
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folders.update(id, { ownerId: user.id, eventId }, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Deletar pasta do evento — subpastas sobem e os registros são desassociados',
  })
  @ApiParam({ name: 'id', description: 'UUID da pasta' })
  @ApiResponse({ status: 204, description: 'Pasta deletada; nenhum registro é apagado' })
  delete(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.folders.delete(id, { ownerId: user.id, eventId });
  }

  // `ownerId` aqui é só quem cria: dentro do evento quem autoriza é o papel.
  private scope(
    ownerId: string,
    eventId: string,
    resourceType?: FolderResourceType,
  ): FolderScope {
    return { ownerId, eventId, resourceType: resourceType ?? 'event' };
  }
}
