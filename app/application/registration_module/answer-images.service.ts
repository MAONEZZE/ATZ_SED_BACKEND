import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { STORAGE_PORT, StoragePort } from '@domain/shared/i-storage';

/** `data:image/jpeg;base64,...` — o formato que o front manda hoje. */
const DATA_URI_RE = /^data:([a-z0-9.+/-]+);base64,(.*)$/is;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Teto do binário DEPOIS de decodificar. A maior imagem já gravada tem ~4,8 MB
 * (6,4 MB em base64), então 5 MB aceita todo o histórico. Não é configurável de
 * propósito: ninguém pediu o botão.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Onde a imagem vive no bucket. `formId` ausente = edição pelo painel, que não
 * passa por um formulário específico (o inscrito não pertence a um só).
 */
export interface AnswerImageScope {
  eventId: string;
  formId?: string;
}

/**
 * Imagem de resposta de formulário vai para o bucket; `answers` guarda só a URL.
 *
 * Antes disso o campo `type: image` era persistido como data URI base64 dentro do
 * JSON: `registrations` chegou a 104 MB (a segunda maior tabela do schema tinha
 * 1 MB), o CSV levava base64 na coluna e o payload do Pipedrive também.
 *
 * A conversão é disparada pelo **valor**, não pelo tipo do campo: qualquer
 * `data:` URI em qualquer resposta é materializada, e mime que não é imagem
 * permitida é recusado. Isso cobre o caso em que o label da resposta divergiu do
 * campo configurado e, de graça, impede que outros blobs entrem no JSON.
 */
@Injectable()
export class AnswerImageService {
  private readonly logger = new Logger(AnswerImageService.name);

  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devolve uma cópia de `answers` com todo data URI trocado pela URL pública.
   *
   * Idempotente: valor que já é URL passa reto — é o que permite chamar tanto na
   * submissão pública quanto na edição pelo painel sem duplicar upload.
   */
  async materialize(
    answers: Record<string, unknown>,
    scope: AnswerImageScope,
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = { ...answers };

    for (const [key, value] of Object.entries(answers)) {
      if (typeof value === 'string') {
        out[key] = await this.materializeValue(value, key, scope);
        continue;
      }
      // Array cobre campo que aceita mais de um arquivo; qualquer outro tipo
      // (número, boolean, objeto) não carrega data URI.
      if (Array.isArray(value) && value.some((v) => this.isDataUri(v))) {
        out[key] = await Promise.all(
          value.map((v) =>
            typeof v === 'string' ? this.materializeValue(v, key, scope) : Promise.resolve(v),
          ),
        );
      }
    }

    return out;
  }

  private isDataUri(value: unknown): boolean {
    return typeof value === 'string' && DATA_URI_RE.test(value);
  }

  private async materializeValue(
    value: string,
    label: string,
    scope: AnswerImageScope,
  ): Promise<string> {
    const match = DATA_URI_RE.exec(value);
    if (!match) return value;

    const mime = match[1].toLowerCase();
    const extension = EXTENSION_BY_MIME[mime];
    if (!extension) {
      throw new BadRequestException(
        `Campo "${label}" deve ser uma imagem JPEG, PNG ou WebP`,
      );
    }

    const binary = Buffer.from(match[2], 'base64');
    if (binary.length === 0) {
      throw new BadRequestException(`Campo "${label}" tem imagem inválida`);
    }
    if (binary.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `Campo "${label}" excede o tamanho máximo de imagem (${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`,
      );
    }

    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder = this.config.get<string>('SUPABASE_STORAGE_BUCKET_UPLOADS') ?? 'registration-uploads';
    // Sem registrationId no caminho: na submissão pública o inscrito pode ainda
    // não existir quando a imagem sobe.
    const path = `${folder}/${scope.eventId}/${scope.formId ?? 'painel'}/${randomUUID()}.${extension}`;

    const { url } = await this.storage.upload(bucket, path, binary, mime);
    this.logger.log(`Imagem de resposta materializada: ${path} (${binary.length} bytes)`);
    return url;
  }
}
