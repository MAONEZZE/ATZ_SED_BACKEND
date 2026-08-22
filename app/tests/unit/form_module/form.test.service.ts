import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FormService } from '@application/form_module/form.service';
import { FormEntity } from '@domain/form_module/form.entity';

const DATE = new Date('2026-08-17T12:00:00Z');

function form(
  id: string,
  name: string,
  slug: string,
  order = 0,
  anonymous = false,
): FormEntity {
  return new FormEntity(
    id,
    'evt-1',
    name,
    slug,
    order,
    null,
    null,
    null,
    false,
    false,
    anonymous,
    DATE,
    DATE,
  );
}

function make(forms: FormEntity[] = []) {
  const bySlug = new Map(forms.map((f) => [f.slug, f]));
  const repo = {
    listByEvent: jest.fn().mockResolvedValue(forms),
    findByIdAndEvent: jest
      .fn()
      .mockImplementation((id: string, eventId: string) =>
        Promise.resolve(forms.find((f) => f.id === id && f.eventId === eventId) ?? null),
      ),
    findByEventAndSlug: jest
      .fn()
      .mockImplementation((_e: string, slug: string) => Promise.resolve(bySlug.get(slug) ?? null)),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'form-new', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    delete: jest.fn().mockResolvedValue(undefined),
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new FormService(repo as any), repo };
}

describe('FormService.create', () => {
  it('derives the public slug from the name', async () => {
    const { service, repo } = make();

    await service.create('evt-1', { name: 'Pesquisa de Satisfação' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', slug: 'pesquisa-de-satisfacao' }),
    );
  });

  // O slug é a chave pública dentro do evento: dois formulários com o mesmo nome
  // colidiriam na URL.
  it('409s when the slug already exists in the event', async () => {
    const { service, repo } = make([form('form-1', 'NPS', 'nps')]);

    await expect(service.create('evt-1', { name: 'NPS' })).rejects.toThrow(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a name that produces an empty slug', async () => {
    const { service } = make();

    await expect(service.create('evt-1', { name: '!!!' })).rejects.toThrow(BadRequestException);
  });

  it('rejects anonymous combined with requireImageAuthorization', async () => {
    const { service, repo } = make();

    await expect(
      service.create('evt-1', { name: 'Voto', anonymous: true, requireImageAuthorization: true }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects anonymous combined with sendToPipedrive', async () => {
    const { service, repo } = make();

    await expect(
      service.create('evt-1', { name: 'Voto', anonymous: true, sendToPipedrive: true }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('FormService.update', () => {
  it('rewrites the slug when the name changes', async () => {
    const { service, repo } = make([form('form-1', 'NPS', 'nps')]);

    await service.update('form-1', 'evt-1', { name: 'Pós-evento' });

    expect(repo.update).toHaveBeenCalledWith(
      'form-1',
      expect.objectContaining({ name: 'Pós-evento', slug: 'pos-evento' }),
    );
  });

  it('keeps the slug when the name is unchanged', async () => {
    const { service, repo } = make([form('form-1', 'NPS', 'nps')]);

    await service.update('form-1', 'evt-1', { description: 'nova descrição' });

    const [, data] = repo.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(data).not.toHaveProperty('slug');
  });

  it('409s when the new name collides with another form of the event', async () => {
    const { service, repo } = make([form('form-1', 'NPS', 'nps'), form('form-2', 'Pós', 'pos')]);

    await expect(service.update('form-2', 'evt-1', { name: 'NPS' })).rejects.toThrow(
      ConflictException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('404s a form of another event', async () => {
    const { service } = make([]);

    await expect(service.update('form-1', 'evt-1', { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  // anonymous nem está no shape de UpdateFormData (imutável); a trava aqui é a
  // outra ponta: não deixar as flags incompatíveis ligarem num form já anônimo.
  it('rejects turning on sendToPipedrive for an anonymous form', async () => {
    const { service, repo } = make([form('form-1', 'Voto', 'voto', 0, true)]);

    await expect(
      service.update('form-1', 'evt-1', { sendToPipedrive: true }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects turning on requireImageAuthorization for an anonymous form', async () => {
    const { service, repo } = make([form('form-1', 'Voto', 'voto', 0, true)]);

    await expect(
      service.update('form-1', 'evt-1', { requireImageAuthorization: true }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('FormService.primary', () => {
  // Sem os 3 tipos fixos, "o formulário do evento" passou a ser o de menor order
  // — é ele que alimenta a página pública e as colunas do CSV de inscritos.
  it('returns the first form by order', async () => {
    const { service } = make([form('form-1', 'Inscrição', 'inscricao', 0), form('form-2', 'NPS', 'nps', 1)]);

    await expect(service.primary('evt-1')).resolves.toMatchObject({ id: 'form-1' });
  });

  it('returns null when the event has no form', async () => {
    const { service } = make([]);

    await expect(service.primary('evt-1')).resolves.toBeNull();
  });
});

describe('FormService.delete', () => {
  it('checks the form belongs to the event before deleting', async () => {
    const { service, repo } = make([]);

    await expect(service.delete('form-1', 'evt-1')).rejects.toThrow(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes a form of the event', async () => {
    const { service, repo } = make([form('form-1', 'NPS', 'nps')]);

    await service.delete('form-1', 'evt-1');

    expect(repo.delete).toHaveBeenCalledWith('form-1');
  });
});
