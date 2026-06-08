import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { RegistrationsService } from '@services/registrations/registrations.service';

@ApiTags('Public')
@Controller('public/events')
export class PublicRegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post(':slug/registrations')
  @ApiOperation({ summary: 'Realizar inscrição em evento público' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true, example: { name: 'João Silva', email: 'joao@email.com' } } })
  @ApiResponse({ status: 201, description: 'Inscrição criada' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  create(@Param('slug') slug: string, @Body() answers: Record<string, unknown>) {
    return this.registrations.createPublic(slug, answers);
  }
}
