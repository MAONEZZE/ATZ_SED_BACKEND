import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PublicEventsService } from '@modules/events/public-events.service';

@ApiTags('Public')
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly publicEvents: PublicEventsService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Buscar evento público por slug' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Evento publicado' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  getPublicEvent(@Param('slug') slug: string) {
    return this.publicEvents.getPublicEvent(slug);
  }

  @Get(':slug/form-fields')
  @ApiOperation({ summary: 'Buscar campos do formulário de inscrição (público)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Campos do formulário' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  getFormFields(@Param('slug') slug: string) {
    return this.publicEvents.getPublicFormFields(slug, 'registration', false);
  }

  @Get(':slug/post-event/form-fields')
  @ApiOperation({ summary: 'Buscar campos do formulário pós-evento (público)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Campos do formulário pós-evento' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  getPostEventFields(@Param('slug') slug: string) {
    return this.publicEvents.getPublicFormFields(slug, 'post_event', true);
  }

  @Get(':slug/nps/form-fields')
  @ApiOperation({ summary: 'Buscar campos do formulário NPS (público)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Campos do formulário NPS' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  getNpsFields(@Param('slug') slug: string) {
    return this.publicEvents.getPublicFormFields(slug, 'nps', true);
  }
}
