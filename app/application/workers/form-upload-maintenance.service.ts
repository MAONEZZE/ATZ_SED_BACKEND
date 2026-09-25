import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FormDocumentsService } from '@application/registration_module/form-documents.service';

const MAX_TEMP_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FormUploadMaintenanceService {
  private readonly logger = new Logger(FormUploadMaintenanceService.name);

  constructor(private readonly documents: FormDocumentsService) {}

  @Cron(process.env.FORM_UPLOAD_PRUNE_CRON || '0 6 * * *')
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - MAX_TEMP_AGE_MS);
    try {
      const count = await this.documents.deleteTemporaryOlderThan(cutoff);
      this.logger.log(`Uploads temporários removidos: ${count}`);
    } catch (err) {
      this.logger.error({ err }, 'Falha ao limpar uploads temporários de formulário');
    }
  }
}
