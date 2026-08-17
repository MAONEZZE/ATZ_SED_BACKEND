import { Inject, Injectable } from '@nestjs/common';
import {
  FORM_RESPONSE_REPOSITORY_PORT,
  FormResponseRepositoryPort,
} from '@domain/form_response_module/i-repository-form-response';

@Injectable()
export class FormResponseService {
  constructor(
    @Inject(FORM_RESPONSE_REPOSITORY_PORT)
    private readonly repo: FormResponseRepositoryPort,
  ) {}

  /** `formId` ausente = respostas de todos os formulários do evento. */
  listPaginated(eventId: string, page: number, limit: number, formId?: string) {
    return this.repo.findAllByEventPaginated(
      eventId,
      { skip: (page - 1) * limit, take: limit },
      formId,
    );
  }

  exportRows(eventId: string, formId?: string) {
    return this.repo.findAllByEvent(eventId, formId);
  }
}
