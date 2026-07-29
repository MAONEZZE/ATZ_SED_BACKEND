import {
  Controller,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatusService } from '@modules/messaging/delivery-status.service';

interface UazapiWebhookBody {
  event?: string;
  instance?: string;
  data?: {
    messageid?: string;
    id?: string;
    status?: string;
    track_id?: string;
    messageTimestamp?: number;
    error?: string;
  };
}

// Rota pública (sem JwtAuthGuard, só ThrottlerGuard global). Protegida por shared
// secret na query/header, verificado contra UAZAPI_WEBHOOK_SECRET.
@ApiTags('Public')
@Controller('public/webhooks/uazapi')
export class UazapiWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly delivery: DeliveryStatusService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Recebe eventos de status da Uazapi (messages_update)' })
  async receive(
    @Query('secret') secretQuery: string | undefined,
    @Headers('x-webhook-secret') secretHeader: string | undefined,
    @Body() body: UazapiWebhookBody,
  ) {
    const expected = this.config.get<string>('UAZAPI_WEBHOOK_SECRET');
    const provided = secretQuery ?? secretHeader;
    if (!expected || provided !== expected) {
      throw new UnauthorizedException('invalid webhook secret');
    }

    // Só tratamos eventos de status de mensagem; demais são ignorados (200 OK).
    if (body?.event === 'status' && body.data) {
      const d = body.data;
      await this.delivery.applyStatusUpdate({
        providerMessageId: d.messageid ?? d.id ?? null,
        trackId: d.track_id ?? null,
        status: d.status ?? '',
        at: d.messageTimestamp ?? null,
        error: d.error ?? null,
      });
    }
    return { ok: true };
  }
}
