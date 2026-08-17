import { Controller, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { RegistrationService } from '@application/registration_module/registration.service';
import { PublicEventService } from '@application/event_module/public-event.service';
import { CheckInDto } from '@api/dto/registration_module/registration-batch.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicRegistrationController {
  constructor(
    private readonly registrations: RegistrationService,
    private readonly publicEvents: PublicEventService,
  ) {}

  @Post(':slug/registrations')
  @ApiOperation({ summary: 'Realizar inscrição em evento público' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        name: 'João Silva',
        email: 'joao@email.com',
        send_to_pipedrive: true,
        image_authorization: true,
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Inscrição criada' })
  @ApiResponse({
    status: 400,
    description:
      'Campo obrigatório ausente, capacidade esgotada ou autorização de imagem obrigatória',
  })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  async create(@Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    // `send_to_pipedrive`/`image_authorization` are control flags, not form
    // answers — strip them out. When omitted, the event/owner-level default
    // decides (handled in the service).
    const { send_to_pipedrive, image_authorization, ...answers } = body;
    const flag = typeof send_to_pipedrive === 'boolean' ? send_to_pipedrive : undefined;
    const imageAuthorization =
      typeof image_authorization === 'boolean' ? image_authorization : undefined;
    const fields = await this.publicEvents.getSubmissionFields(slug, 'registration');
    return this.registrations.createPublic(slug, answers, fields, flag, imageAuthorization);
  }

  // Check-in pelo QR único do evento: a página pública pede o telefone e marca
  // a presença. Rota pública (só o ThrottlerGuard global), como as demais.
  @Post(':slug/checkin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check-in público por telefone (QR do evento)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Presença marcada' })
  @ApiResponse({ status: 400, description: 'Evento não está aceitando check-in' })
  @ApiResponse({ status: 404, description: 'Nenhuma inscrição com esse telefone' })
  checkIn(@Param('slug') slug: string, @Body() dto: CheckInDto) {
    return this.registrations.checkIn(slug, dto.phone);
  }
}
