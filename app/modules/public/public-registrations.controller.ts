import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { RegistrationsService } from '@modules/registrations/registrations.service';
import { PublicEventsService } from '@modules/events/public-events.service';

@ApiTags('Public')
@Controller('public/events')
export class PublicRegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly publicEvents: PublicEventsService,
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
  @ApiResponse({ status: 400, description: 'Campo obrigatório ausente, capacidade esgotada ou autorização de imagem obrigatória' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  async create(@Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    // `send_to_pipedrive`/`image_authorization` are control flags, not form
    // answers — strip them out. When omitted, the event/owner-level default
    // decides (handled in the service).
    const { send_to_pipedrive, image_authorization, ...answers } = body;
    const flag = typeof send_to_pipedrive === 'boolean' ? send_to_pipedrive : undefined;
    const imageAuthorization = typeof image_authorization === 'boolean' ? image_authorization : undefined;
    const fields = await this.publicEvents.getSubmissionFields(slug, 'registration');
    return this.registrations.createPublic(slug, answers, fields, flag, imageAuthorization);
  }
}
