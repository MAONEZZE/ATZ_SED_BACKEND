import { BadRequestException } from '@nestjs/common';
import { FormResponseService } from '@application/form_response_module/form-response.service';
import { FormFieldService } from '@application/form_field_module/form-field.service';

function makeService(deleted = 0) {
  const repo = { deleteMany: jest.fn().mockResolvedValue(deleted) };
  const formFields = { exportLabels: jest.fn() } as unknown as FormFieldService;
  return { service: new FormResponseService(repo as never, formFields), repo };
}

describe('FormResponseService.deleteMany', () => {
  it('returns how many rows were actually removed', async () => {
    const { service } = makeService(3);
    await expect(service.deleteMany(['r1', 'r2', 'r3'], 'evt-1')).resolves.toBe(3);
  });

  // Id inexistente ou de outro evento não casa no WHERE: o lote não falha
  // inteiro por um id velho, só não conta.
  it('reports only the ids that matched, without throwing on the others', async () => {
    const { service } = makeService(1);
    await expect(service.deleteMany(['meu', 'de-outro-evento'], 'evt-1')).resolves.toBe(1);
  });

  it('scopes the delete to the event', async () => {
    const { service, repo } = makeService(1);
    await service.deleteMany(['r1'], 'evt-1');
    expect(repo.deleteMany).toHaveBeenCalledWith(['r1'], 'evt-1');
  });

  it('rejects an empty batch before touching the repository', async () => {
    const { service, repo } = makeService();
    await expect(service.deleteMany([], 'evt-1')).rejects.toThrow(BadRequestException);
    expect(repo.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a batch above 500', async () => {
    const { service, repo } = makeService();
    const ids = Array.from({ length: 501 }, (_, i) => `r${i}`);
    await expect(service.deleteMany(ids, 'evt-1')).rejects.toThrow(BadRequestException);
    expect(repo.deleteMany).not.toHaveBeenCalled();
  });
});
