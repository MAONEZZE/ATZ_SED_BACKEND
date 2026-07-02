import { UserSubscriptionsController } from '../../../app/api/controllers/registrations/registrations_routes/user-subscriptions.controller';

function make() {
  const service = {
    findAllPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findAllByEvent: jest.fn().mockResolvedValue([]),
  };
  const formFields = { exportLabels: jest.fn().mockResolvedValue([]) };
  const ctrl = new UserSubscriptionsController(service as any, formFields as any);
  return { ctrl, service, formFields };
}

function fakeRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('UserSubscriptionsController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the paginated shape and forwards search', async () => {
    const { ctrl, service } = make();
    service.findAllPaginated.mockResolvedValue({ data: [{ id: 'us-1' }], total: 1 });

    const result = await ctrl.findAll('evt-1', { page: 2, limit: 10 }, 'jo');

    expect(service.findAllPaginated).toHaveBeenCalledWith('evt-1', 2, 10, 'jo');
    expect(result).toEqual({ data: [{ id: 'us-1' }], total: 1, page: 2, limit: 10 });
  });

  it('defaults page=1 and limit=20 when omitted', async () => {
    const { ctrl, service } = make();
    await ctrl.findAll('evt-1', {}, undefined);
    expect(service.findAllPaginated).toHaveBeenCalledWith('evt-1', 1, 20, undefined);
  });

  it('CSV export (format=csv) returns CSV with BOM, headers and forwards search', async () => {
    const { ctrl, service, formFields } = make();
    service.findAllByEvent.mockResolvedValue([
      {
        name: 'João',
        email: 'joao@b.com',
        phone: '11999990000',
        sendToPipedrive: true,
        pipedriveStatus: 'sent',
        createdAt: new Date('2026-06-22T19:00:00.000Z'),
        updatedAt: new Date('2026-06-22T19:00:00.000Z'),
        registrationAnswers: { Empresa: 'ACME' },
        postEventAnswers: null,
        npsAnswers: null,
      },
    ]);
    formFields.exportLabels.mockImplementation((_e: string, kind: string) =>
      Promise.resolve(kind === 'registration' ? [{ label: 'Empresa' }] : []),
    );
    const res = fakeRes();

    const sent = await ctrl.findAll('evt-1', {}, 'jo', 'csv', res as any);

    expect(service.findAllByEvent).toHaveBeenCalledWith('evt-1', 'jo');
    expect(formFields.exportLabels).toHaveBeenCalledWith('evt-1', 'registration', true);
    expect(formFields.exportLabels).toHaveBeenCalledWith('evt-1', 'post_event');
    expect(formFields.exportLabels).toHaveBeenCalledWith('evt-1', 'nps');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="inscritos-evt-1.csv"',
    );
    expect(typeof sent).toBe('string');
    expect((sent as string).startsWith('﻿')).toBe(true);
    expect(sent as string).toContain('Inscrição: Empresa');
    expect(sent as string).toContain('João');
  });
});
