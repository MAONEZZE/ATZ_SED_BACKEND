import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  FORM_RESPONSE_REPOSITORY_PORT,
  FormResponseRepositoryPort,
  FormResponseWithContext,
} from '@domain/form_response_module/i-repository-form-response';
import { hydrateAnswerLabels } from '@domain/shared/answer-validation';
import { FormFieldService } from '@application/form_field_module/form-field.service';

const MAX_BATCH = 500;

@Injectable()
export class FormResponseService {
  constructor(
    @Inject(FORM_RESPONSE_REPOSITORY_PORT)
    private readonly repo: FormResponseRepositoryPort,
    private readonly formFields: FormFieldService,
  ) {}

  /** `formId` ausente = respostas de todos os formulários do evento. */
  async listPaginated(
    eventId: string,
    page: number,
    limit: number,
    formId?: string,
    search?: string,
  ) {
    const { data, total } = await this.repo.findAllByEventPaginated(
      eventId,
      { skip: (page - 1) * limit, take: limit },
      formId,
      search,
    );
    return { data: await this.hydrateRows(data), total };
  }

  /**
   * Só ids explícitos: o front manda exatamente o que foi selecionado na tela.
   * Apaga a resposta e nada mais — inscrito vinculado (formulário não-anônimo)
   * continua existindo; excluir inscrito é o endpoint de registrations.
   */
  async deleteMany(ids: string[], eventId: string): Promise<number> {
    if (ids.length === 0) throw new BadRequestException('Informe ao menos um id');
    if (ids.length > MAX_BATCH) {
      throw new BadRequestException(`Máximo de ${MAX_BATCH} respostas por requisição`);
    }
    return this.repo.deleteMany(ids, eventId);
  }

  /** Cru (id-keyed): usado pela exportação CSV, que já lê `answers` por `field.id`. */
  exportRows(eventId: string, formId?: string, search?: string) {
    return this.repo.findAllByEvent(eventId, formId, search);
  }

  /** Hidrata `answers` (id→label atual), agrupando por `formId` para não repetir a query. */
  private async hydrateRows(rows: FormResponseWithContext[]): Promise<FormResponseWithContext[]> {
    const formIds = [...new Set(rows.map((r) => r.formId))];
    if (formIds.length === 0) return rows;

    const fieldsByForm = new Map(
      await Promise.all(
        formIds.map(
          async (formId) => [formId, await this.formFields.exportLabels(formId)] as const,
        ),
      ),
    );

    return rows.map((row) => ({
      ...row,
      answers: hydrateAnswerLabels(fieldsByForm.get(row.formId) ?? [], row.answers),
    }));
  }
}
