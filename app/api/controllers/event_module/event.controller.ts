import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { RequireEventRole } from '@api/config/decorators/require-event-role.decorator';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { CurrentEventRole } from '@api/config/decorators/current-event-role.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { EventService } from '@application/event_module/event.service';
import { EventLifecycleService } from '@application/event_module/event-lifecycle.service';
import { CreateEventDto } from '@api/dto/event_module/create-event.dto';
import {
  ReorderEventsDto,
  UpdateEventDto,
  UpdateEventStatusDto,
} from '@api/dto/event_module/update-event.dto';
import { PaginationQueryDto, Paginated } from '@api/dto/shared/pagination';
import { EventRole } from '@domain/collaborator_module/event-role.type';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(
    private readonly eventsService: EventService,
    private readonly lifecycleService: EventLifecycleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar evento' })
  @ApiResponse({ status: 201, description: 'Evento criado' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, {
      ...dto,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      recurrenceUntil: dto.recurrenceUntil ? new Date(dto.recurrenceUntil) : undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar eventos do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'folderId',
    required: false,
    description: "Filtra por pasta. 'null' retorna só os eventos fora de pasta.",
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista paginada de eventos. Cada item traz `myRole` (admin | invited | read): papel do ' +
      'usuário logado naquele evento, para o painel decidir o que renderizar por card.',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
    @Query('folderId') folderId?: string,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    // A query string não carrega null: a literal 'null' pede a raiz, como no
    // filtro de templates. Ausente = sem filtro de pasta.
    const scope = folderId === 'null' ? null : folderId;
    const { data, total } = await this.eventsService.findAllPaginated(
      user.id,
      page,
      limit,
      scope,
    );
    return { data, total, page, limit };
  }

  // Antes do PATCH /:id — declarada depois, a rota 'reorder' cairia no :id.
  @Patch('reorder')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Reordenar eventos dentro de uma pasta (drag & drop): order = índice na lista de ids',
  })
  @ApiResponse({ status: 204, description: 'Ordem reescrita' })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderEventsDto) {
    return this.eventsService.reorder(user.id, dto.folderId ?? null, dto.ids);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Buscar evento por ID' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({
    status: 200,
    description: 'Evento encontrado, com `myRole` (admin | invited | read) do usuário logado',
  })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  // `myRole` é dica de UI: o papel já veio do banco no OwnershipGuard, e é ele
  // que barra a ação de verdade — o valor devolvido aqui não autoriza nada.
  async findOne(@Param('id') id: string, @CurrentEventRole() myRole: EventRole) {
    const event = await this.eventsService.findById(id);
    return Object.assign(event, { myRole });
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Atualizar evento' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Evento atualizado' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventsService.update(
      id,
      {
        ...dto,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        recurrenceUntil: dto.recurrenceUntil ? new Date(dto.recurrenceUntil) : undefined,
      },
      user.id,
    );
  }

  @Patch(':id/status')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary: 'Atualizar status do evento (status=cancelled cancela e opcionalmente notifica)',
  })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Status atualizado' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Cancelamento é uma transição de estado com efeito colateral (notificação),
    // por isso vive no PATCH de status em vez de um POST /cancel dedicado.
    if (dto.status === 'cancelled') {
      return this.lifecycleService.cancel(id, dto.notifyParticipants ?? false, user.id);
    }
    return this.eventsService.updateStatus(id, dto.status, user.id);
  }

  @Post(':id/cover')
  @UseGuards(OwnershipGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload de capa do evento' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({ status: 201, description: 'Capa enviada' })
  uploadCover(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventsService.uploadCover(id, file.buffer, file.mimetype, user.id);
  }

  @Delete(':id/cover')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Remover capa do evento' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Capa removida' })
  deleteCover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.deleteCover(id, user.id);
  }

  // Qualquer papel pode chamar: para invited/read isto desvincula em vez de
  // apagar, então o guard não pode barrar pelo verbo.
  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @RequireEventRole('read')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Deletar evento (dono/admin) ou sair do evento compartilhada (invited/read)',
  })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({
    status: 204,
    description: 'Evento deletado, ou o usuário desvinculado quando o papel não é dono/admin',
  })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.eventsService.delete(id, user.id);
  }

  @Post(':id/duplicate')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Duplicar evento' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Evento duplicado' })
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lifecycleService.duplicate(id, user.id);
  }
}
