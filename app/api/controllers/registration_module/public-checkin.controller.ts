import { Controller, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RegistrationService } from '@application/registration_module/registration.service';
import { CheckInDto } from '@api/dto/registration_module/registration-batch.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicCheckinController {
  constructor(private readonly registrations: RegistrationService) {}

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
