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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { EventsService } from '@services/events/events.service';
import { CreateEventDto } from '../events_dto/create-event.dto';
import { UpdateEventDto, UpdateEventStatusDto } from '../events_dto/update-event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, {
      ...dto,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
    });
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  findOne(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, {
      ...dto,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
    });
  }

  @Patch(':id/status')
  @UseGuards(OwnershipGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateEventStatusDto) {
    return this.eventsService.updateStatus(id, dto.status);
  }

  @Post(':id/cover')
  @UseGuards(OwnershipGuard)
  @UseInterceptors(FileInterceptor('file'))
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
  ) {
    return this.eventsService.uploadCover(id, file.buffer, file.mimetype);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }
}
