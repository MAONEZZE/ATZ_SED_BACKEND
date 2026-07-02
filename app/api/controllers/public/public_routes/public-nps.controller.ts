import { Controller, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { PublicEventsService } from '@services/events/public-events.service';
import { SubmitNpsDto } from '../public_dto/submit-nps.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicNpsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly publicEvents: PublicEventsService,
  ) {}

  @Post(':slug/nps/responses')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar respostas do formulário NPS' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Resposta registrada' })
  @ApiResponse({ status: 400, description: 'Evento inválido ou campo obrigatório ausente' })
  async submit(@Param('slug') slug: string, @Body() dto: SubmitNpsDto) {
    const fields = await this.publicEvents.getSubmissionFields(slug, 'nps');
    await this.registrations.submitNps(slug, dto.identifier, dto.answers, fields);
    return { ok: true };
  }
}
