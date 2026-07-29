import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

const FETCH_TIMEOUT_MS = 20_000;

/**
 * Restrição temporária imposta pelo WhatsApp ao número (não é erro da API).
 * Ex.: erro 463 / `WHATSAPP_REACHOUT_TIMELOCK` — conta bloqueada para iniciar
 * novas conversas por volume/qualidade. Não adianta retentar antes de `until`;
 * o worker trata isso como não-retentável para não martelar um chip restrito.
 */
export class WhatsappRestrictionError extends Error {
  constructor(
    message: string,
    readonly providerCode: number,
    readonly until: Date | null,
  ) {
    super(message);
    this.name = 'WhatsappRestrictionError';
  }
}

@Injectable()
export class UazapiAdapter {
  private readonly baseUrl: string;
  private readonly typingEnabled: boolean;
  private readonly typingMin: number;
  private readonly typingMax: number;
  private readonly typingPerChar: number;
  private readonly typingMaxTotal: number;
  private readonly logger = new Logger(UazapiAdapter.name);

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('UAZAPI_API_URL')!;
    this.typingEnabled = config.get<boolean>('WA_TYPING_ENABLED') ?? true;
    this.typingMin = config.get<number>('WA_TYPING_MIN_MS') ?? 1500;
    this.typingMax = config.get<number>('WA_TYPING_MAX_MS') ?? 4000;
    this.typingPerChar = config.get<number>('WA_TYPING_MS_PER_CHAR') ?? 40;
    this.typingMaxTotal = config.get<number>('WA_TYPING_MAX_TOTAL_MS') ?? 15000;
  }

  private typingDelay(textLength: number): number {
    if (!this.typingEnabled) return 0;
    const base = randomInt(this.typingMin, this.typingMax + 1);
    return Math.min(base + textLength * this.typingPerChar, this.typingMaxTotal);
  }

  // Classifica a falha de um /send. Corpo com provider_code 463 ou
  // error_key WHATSAPP_REACHOUT_TIMELOCK → restrição do WhatsApp (não-retentável),
  // carregando o `until` do timelock. Qualquer outra falha → BadGateway (retentável).
  private buildSendError(status: number, errorText: string): Error {
    try {
      const body = JSON.parse(errorText) as {
        provider_code?: number;
        error_key?: string;
        details?: { reachout_timelock?: { until?: string } };
      };
      if (body?.provider_code === 463 || body?.error_key === 'WHATSAPP_REACHOUT_TIMELOCK') {
        const untilStr = body?.details?.reachout_timelock?.until;
        const until = untilStr ? new Date(untilStr) : null;
        return new WhatsappRestrictionError(
          `WhatsApp restriction (463) — reachout timelock até ${untilStr ?? 'desconhecido'}`,
          463,
          until && !Number.isNaN(until.getTime()) ? until : null,
        );
      }
    } catch {
      // corpo não-JSON: cai no erro genérico abaixo
    }
    return new BadGatewayException(`Uazapi API error (${status}): ${errorText}`);
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadGatewayException('Uazapi API timeout');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  splitParts(body: string): string[] {
    return body
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  // Lê o id da mensagem no provedor da resposta de envio, para correlacionar o
  // webhook de status (messages_update) com a mensagem enviada.
  private extractMessageId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    const id = o.messageid ?? o.id ?? o.messageId;
    return typeof id === 'string' ? id : null;
  }

  // A Uazapi identifica a instância pelo header `token` (um por instância),
  // diferente da Evolution que usava o nome da instância no path da URL.
  // Retorna o providerMessageId representativo (última parte enviada) ou null.
  async sendWhatsApp(
    token: string,
    to: string,
    body: string,
    opts?: {
      startIndex?: number;
      onPartSent?: (index: number) => void | Promise<void>;
      trackId?: string;
    },
  ): Promise<string | null> {
    const parts = this.splitParts(body);
    const start = opts?.startIndex ?? 0;

    let lastMessageId: string | null = null;
    for (let i = start; i < parts.length; i++) {
      lastMessageId = await this.sendPart(token, to, parts[i], opts?.trackId);
      if (opts?.onPartSent) await opts.onPartSent(i);
    }
    return lastMessageId;
  }

  private async sendPart(
    token: string,
    to: string,
    text: string,
    trackId?: string,
  ): Promise<string | null> {
    const url = `${this.baseUrl}/send/text`;

    const delay = this.typingDelay(text.length);
    const payload: {
      number: string;
      text: string;
      delay?: number;
      track_id?: string;
      track_source?: string;
    } = { number: to, text };
    if (delay > 0) payload.delay = delay;
    if (trackId) {
      payload.track_id = trackId;
      payload.track_source = 'sed';
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ status: response.status, error: errorText }, 'Uazapi API error');
      throw this.buildSendError(response.status, errorText);
    }
    return this.extractMessageId(await response.json().catch(() => null));
  }

  async sendMedia(
    token: string,
    to: string,
    mediaUrl: string,
    mediatype: 'image' | 'video' | 'audio' | 'document',
    mimetype: string,
    fileName: string,
    caption?: string,
    trackId?: string,
  ): Promise<string | null> {
    const url = `${this.baseUrl}/send/media`;
    const payload: {
      number: string;
      type: 'image' | 'video' | 'audio' | 'document';
      mimetype: string;
      file: string;
      docName: string;
      text?: string;
      track_id?: string;
      track_source?: string;
    } = { number: to, type: mediatype, mimetype, file: mediaUrl, docName: fileName };
    if (caption) payload.text = caption;
    if (trackId) {
      payload.track_id = trackId;
      payload.track_source = 'sed';
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ status: response.status, error: errorText }, 'Uazapi API sendMedia error');
      throw this.buildSendError(response.status, errorText);
    }
    return this.extractMessageId(await response.json().catch(() => null));
  }

  // Registra/atualiza o webhook da instância (recebe eventos de status de entrega).
  async setWebhook(token: string, url: string, events: string[]): Promise<void> {
    const endpoint = `${this.baseUrl}/webhook`;
    const response = await this.fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ url, events, action: 'add', enabled: true }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ status: response.status, error: errorText }, 'Uazapi API setWebhook error');
      throw new BadGatewayException(`Uazapi API error (${response.status}): ${errorText}`);
    }
  }

  async fetchGroups(token: string): Promise<{ id: string; subject: string }[]> {
    const url = `${this.baseUrl}/group/list?noparticipants=true`;
    const response = await this.fetchWithTimeout(url, {
      headers: { token },
    });
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ status: response.status, error: errorText }, 'Uazapi API fetchGroups error');
      throw new BadGatewayException(`Uazapi API error (${response.status}): ${errorText}`);
    }
    const data = (await response.json()) as {
      groups?: Array<{
        JID?: string;
        jid?: string;
        id?: string;
        Name?: string;
        name?: string;
        subject?: string;
      }>;
    };
    return (data.groups ?? []).map((g) => ({
      id: g.JID ?? g.jid ?? g.id ?? '',
      subject: g.Name ?? g.name ?? g.subject ?? '',
    }));
  }

  // Estado de conexão da instância (GET /instance/status). Retorna a string de
  // status (p.ex. "connected") ou null se indisponível. Diferente dos outros
  // métodos, NÃO lança em erro/timeout: quem chama trata null como desconectado,
  // para uma instância offline não derrubar a listagem inteira.
  async getInstanceStatus(token: string): Promise<string | null> {
    const url = `${this.baseUrl}/instance/status`;
    try {
      const response = await this.fetchWithTimeout(url, { headers: { token } });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          { status: response.status, error: errorText },
          'Uazapi API instanceStatus error',
        );
        return null;
      }
      const data = (await response.json()) as {
        status?: string;
        instance?: { status?: string };
      };
      // Shape defensivo: status no topo ou aninhado em `instance`.
      return data.status ?? data.instance?.status ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: msg }, 'Uazapi API instanceStatus failure');
      return null;
    }
  }
}
