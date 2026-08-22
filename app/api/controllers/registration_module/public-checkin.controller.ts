import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegistrationService } from '@application/registration_module/registration.service';
import { CheckInDto } from '@api/dto/registration_module/registration-batch.dto';

@ApiTags('Public')
@Controller('public')
export class PublicCheckinController {
  constructor(private readonly registrations: RegistrationService) {}

  // Check-in por telefone, sem evento no caminho: o backend descobre o evento
  // pela data mais próxima de hoje entre as inscrições daquele telefone.
  // Rota pública (só o ThrottlerGuard global), como as demais.
  @Post('checkin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check-in público por telefone (evento resolvido pela data)' })
  @ApiResponse({ status: 200, description: 'Presença marcada; devolve a inscrição e o evento' })
  @ApiResponse({ status: 400, description: 'Telefone inválido' })
  @ApiResponse({ status: 404, description: 'Nenhuma inscrição com esse telefone' })
  checkIn(@Body() dto: CheckInDto) {
    return this.registrations.checkIn(dto.phone);
  }
}
