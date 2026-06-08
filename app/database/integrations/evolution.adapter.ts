import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EvolutionAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly logger = new Logger(EvolutionAdapter.name);

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('EVOLUTION_API_URL')!;
    this.apiKey = config.get<string>('EVOLUTION_API_KEY')!;
  }

  async sendWhatsApp(instancia: string, to: string, body: string): Promise<void> {
    const url = `${this.baseUrl}/message/sendText/${instancia}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: JSON.stringify({ number: to, text: body }),
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
