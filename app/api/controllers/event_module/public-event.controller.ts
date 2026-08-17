import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PublicEventService } from '@application/event_module/public-event.service';

@ApiTags('Public')
@Controller('public/events')
export class PublicEventController {
  constructor(private readonly publicEvents: PublicEventService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Buscar evento público por slug' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Evento publicado' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  getPublicEvent(@Param('slug') slug: string) {
    return this.publicEvents.getPublicEvent(slug);
  }

}
