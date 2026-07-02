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
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';
import { EventsService } from '@modules/events/events.service';
import { EventLifecycleService } from '@modules/events/event-lifecycle.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto, UpdateEventStatusDto } from './dto/update-event.dto';
import { PaginationQueryDto, Paginated } from '@shared/pagination';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
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
  @ApiResponse({ status: 200, description: 'Lista paginada de eventos' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.eventsService.findAllPaginated(user.id, page, limit);
    return { data, total, page, limit };
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Buscar evento por ID' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Evento encontrado' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findById(id);
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

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar evento' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 204, description: 'Evento deletado' })
  delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
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
