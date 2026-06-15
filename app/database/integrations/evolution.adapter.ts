import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

@Injectable()
export class EvolutionAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly typingEnabled: boolean;
  private readonly typingMin: number;
  private readonly typingMax: number;
  private readonly typingPerChar: number;
  private readonly typingMaxTotal: number;
  private readonly logger = new Logger(EvolutionAdapter.name);

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('EVOLUTION_API_URL')!;
    this.apiKey = config.get<string>('EVOLUTION_API_KEY')!;
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

  splitParts(body: string): string[] {
    return body
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  async sendWhatsApp(
    instancia: string,
    to: string,
    body: string,
    opts?: { startIndex?: number; onPartSent?: (index: number) => void | Promise<void> },
  ): Promise<void> {
    const parts = this.splitParts(body);
    const start = opts?.startIndex ?? 0;

    for (let i = start; i < parts.length; i++) {
      await this.sendPart(instancia, to, parts[i]);
      if (opts?.onPartSent) await opts.onPartSent(i);
    }
  }

  private async sendPart(instancia: string, to: string, text: string): Promise<void> {
    const url = `${this.baseUrl}/message/sendText/${instancia}`;

    const delay = this.typingDelay(text.length);
    const payload: { number: string; text: string; delay?: number } = { number: to, text };
    if (delay > 0) payload.delay = delay;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        { instancia, status: response.status, error: errorText },
        'Evolution API error',
      );
      throw new Error(`Evolution API error (${response.status}): ${errorText}`);
    }
  }
}
