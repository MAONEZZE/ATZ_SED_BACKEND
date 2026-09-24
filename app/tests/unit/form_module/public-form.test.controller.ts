import { NotFoundException } from '@nestjs/common';
import { PublicFormController } from '@api/controllers/form_module/public-form.controller';
import { FormEntity } from '@domain/form_module/form.entity';

const DATE = new Date('2026-09-24T12:00:00Z');

function form(
  id: string,
  order: number,
  post: { message: string | null; link: string | null },
  anonymous = false,
): FormEntity {
  return new FormEntity(
    id,
    'evt-1',
    `Form ${id}`,
    `form-${id}`,
    order,
    null,
    post.message,
    post.link,
    false,
    false,
    anonymous,
    DATE,
    DATE,
  );
}

function make(forms: FormEntity[] = []) {
  const formService = {
    list: jest.fn().mockResolvedValue(forms),
    findPublic: jest.fn().mockResolvedValue(forms[0]),
  };
  const formFields = { publicFields: jest.fn().mockResolvedValue([]) };
  const publicEvents = {
    getPublicEvent: jest.fn().mockResolvedValue({ id: 'evt-1', status: 'published' }),
  };
  const ctrl = new PublicFormController(
    {} as any,
    formService as any,
    formFields as any,
    publicEvents as any,
  );
  return { ctrl, formService, formFields, publicEvents };
}

const A = { message: 'Obrigado, A!', link: 'https://example.com/a' };
const B = { message: 'Obrigado, B!', link: 'https://example.com/b' };

describe('PublicFormController.listForms post-submit metadata', () => {
  it('returns each form with its own message and link', async () => {
    const { ctrl } = make([form('a', 0, A), form('b', 1, B)]);

    const result = await ctrl.listForms('festa');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'a',
        postRegistrationMessage: A.message,
        linkPostSubscription: A.link,
      }),
      expect.objectContaining({
        id: 'b',
        postRegistrationMessage: B.message,
        linkPostSubscription: B.link,
      }),
    ]);
  });

  // Não existe "formulário principal": reordenar não pode transferir metadados.
  it('keeps metadata bound to the form id when the order changes', async () => {
    const { ctrl } = make([form('b', 0, B), form('a', 1, A)]);

    const result = await ctrl.listForms('festa');
    const byId = Object.fromEntries(result.map((f) => [f.id, f]));

    expect(result.map((f) => f.id)).toEqual(['b', 'a']);
    expect(byId.a).toMatchObject({
      order: 1,
      postRegistrationMessage: A.message,
      linkPostSubscription: A.link,
    });
    expect(byId.b).toMatchObject({
      order: 0,
      postRegistrationMessage: B.message,
      linkPostSubscription: B.link,
    });
  });

  it('returns null for a legacy form without post-submit config', async () => {
    const { ctrl } = make([form('legacy', 0, { message: null, link: null })]);

    const [result] = await ctrl.listForms('festa');

    expect(result.postRegistrationMessage).toBeNull();
    expect(result.linkPostSubscription).toBeNull();
  });

  it('returns message and link for anonymous forms too', async () => {
    const { ctrl } = make([form('anon', 0, A, true)]);

    const [result] = await ctrl.listForms('festa');

    expect(result).toMatchObject({
      anonymous: true,
      postRegistrationMessage: A.message,
      linkPostSubscription: A.link,
    });
  });

  it('lists the forms of the event resolved by the public gate', async () => {
    const { ctrl, formService, publicEvents } = make([]);

    await ctrl.listForms('festa');

    expect(publicEvents.getPublicEvent).toHaveBeenCalledWith('festa');
    expect(formService.list).toHaveBeenCalledWith('evt-1');
  });
});

// getPublicEvent dá 404 para evento inexistente, draft ou cancelled (ver
// event.test.service-public); aqui garantimos que nada do form vaza nesse caso.
describe('PublicFormController public gating', () => {
  it('404s the form list without reading forms when the event is not public', async () => {
    const { ctrl, formService, publicEvents } = make([form('a', 0, A)]);
    publicEvents.getPublicEvent.mockRejectedValue(new NotFoundException('Event not found'));

    await expect(ctrl.listForms('rascunho')).rejects.toThrow(NotFoundException);
    expect(formService.list).not.toHaveBeenCalled();
  });

  it('404s the field list without reading the form when the event is not public', async () => {
    const { ctrl, formService, formFields, publicEvents } = make([form('a', 0, A)]);
    publicEvents.getPublicEvent.mockRejectedValue(new NotFoundException('Event not found'));

    await expect(ctrl.fields('cancelado', 'form-a')).rejects.toThrow(NotFoundException);
    expect(formService.findPublic).not.toHaveBeenCalled();
    expect(formFields.publicFields).not.toHaveBeenCalled();
  });

  it('serves the fields when the event is public', async () => {
    const { ctrl, formFields } = make([form('a', 0, A)]);

    await ctrl.fields('festa', 'form-a');

    expect(formFields.publicFields).toHaveBeenCalledWith('a');
  });
});
