import { RegistrationsController } from '../../app/api/controllers/registrations/registrations_routes/registrations.controller';

function make() {
  const registrations = {
    findAll: jest.fn().mockResolvedValue([]),
    updateAnswers: jest.fn().mockResolvedValue({}),
  };
  const prisma = { formField: { findMany: jest.fn().mockResolvedValue([]) } };
  const ctrl = new RegistrationsController(registrations as any, prisma as any);
  return { ctrl, registrations, prisma };
}

function fakeRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('RegistrationsController kind filter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exportCsv only reads registration-kind fields', async () => {
    const { ctrl, prisma } = make();
    await ctrl.exportCsv('evt-1', fakeRes() as any);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventId: 'evt-1', kind: 'registration' }),
      }),
    );
  });

  it('updateAnswers only reads registration-kind fields', async () => {
    const { ctrl, prisma } = make();
    await ctrl.updateAnswers('evt-1', 'reg-1', { answers: {} } as any);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventId: 'evt-1', kind: 'registration' }),
      }),
    );
  });
});
