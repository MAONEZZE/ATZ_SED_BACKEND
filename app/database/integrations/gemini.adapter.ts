import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiPort, GenerateEmailStyleResult } from '@domain/ai/ports/ai.port';

@Injectable()
export class GeminiAdapter implements AiPort {
  private readonly ai: GoogleGenAI;
  private readonly logger = new Logger(GeminiAdapter.name);

  constructor(config: ConfigService) {
    this.ai = new GoogleGenAI({ apiKey: config.get<string>('GEMINI_API_KEY')! });
  }

  async generateEmailStyles(content: string): Promise<GenerateEmailStyleResult> {
    const prompt = `Gere 4 versões de HTML responsivo para email de evento.
Retorne APENAS JSON válido com keys: professional, minimalist, elegant, warm.
Cada value é uma string com HTML completo e responsivo.
Conteúdo do evento: ${content}`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text ?? '';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    try {
      return JSON.parse(cleaned) as GenerateEmailStyleResult;
    } catch {
      this.logger.error({ text }, 'Failed to parse Gemini email style response');
      throw new Error('AI returned invalid JSON for email styles');
    }
  }

  async *streamLandingChat(
    message: string,
    currentLanding: unknown,
  ): AsyncIterable<string> {
    const prompt = `Você é um assistente de edição de landing pages de eventos.
Landing atual (JSON): ${JSON.stringify(currentLanding)}
Instrução: ${message}
Responda com as alterações a aplicar, em JSON.`;

    const stream = await this.ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}
