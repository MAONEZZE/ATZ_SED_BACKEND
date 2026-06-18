import { FormFieldsController } from '../../app/api/controllers/events/events_routes/form-fields.controller';

function makeController() {
  const prisma = {
    formField: {
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  return { ctrl: new FormFieldsController(prisma as any), prisma };
}

describe('FormFieldsController kind support', () => {
  beforeEach(() => jest.clearAllMocks());

  it('default kind registration on create when omitted', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.create('evt-1', { label: 'Nome', type: 'text' });
    expect(prisma.formField.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'registration' }) }),
    );
  });

  it('passes post_event kind on create', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.create('evt-1', { label: 'Nota', type: 'text', kind: 'post_event' } as any);
    expect(prisma.formField.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'post_event' }) }),
    );
  });

  it('filters findAll by kind when given', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.findAll('evt-1', {}, 'post_event');
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });

  it('findAll without kind uses where with only eventId (no stray kind key)', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.findAll('evt-1', {});
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1' } }),
    );
    expect(prisma.formField.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ kind: expect.anything() }) }),
    );
  });
});
