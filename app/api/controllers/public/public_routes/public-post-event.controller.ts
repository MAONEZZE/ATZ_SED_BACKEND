import { Controller, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { PublicEventsService } from '@services/events/public-events.service';
import { SubmitPostEventDto } from '../public_dto/submit-post-event.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicPostEventController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly publicEvents: PublicEventsService,
  ) {}

  @Post(':slug/post-event/responses')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar respostas do formulário pós-evento' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Resposta registrada' })
  @ApiResponse({ status: 400, description: 'Evento inválido ou campo obrigatório ausente' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  async submit(@Param('slug') slug: string, @Body() dto: SubmitPostEventDto) {
    const fields = await this.publicEvents.getSubmissionFields(slug, 'post_event');
    await this.registrations.submitPostEvent(slug, dto.identifier, dto.answers, fields);
    return { ok: true };
  }
}
