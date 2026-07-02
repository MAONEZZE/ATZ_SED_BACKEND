import { RegistrationsController } from '../../app/api/controllers/registrations/registrations_routes/registrations.controller';

function make() {
  const registrations = {
    findAll: jest.fn().mockResolvedValue([]),
    updateAnswers: jest.fn().mockResolvedValue({}),
  };
  const formFields = {
    exportLabels: jest.fn().mockResolvedValue([]),
    validationFields: jest.fn().mockResolvedValue([]),
  };
  const ctrl = new RegistrationsController(registrations as any, formFields as any);
  return { ctrl, registrations, formFields };
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

  it('exportCsv only reads dynamic registration-kind labels', async () => {
    const { ctrl, formFields } = make();
    await ctrl.exportCsv('evt-1', fakeRes() as any);
    expect(formFields.exportLabels).toHaveBeenCalledWith('evt-1', 'registration', true);
  });

  it('updateAnswers only reads registration-kind validation fields', async () => {
    const { ctrl, formFields } = make();
    await ctrl.updateAnswers('evt-1', 'reg-1', { answers: {} } as any);
    expect(formFields.validationFields).toHaveBeenCalledWith('evt-1', 'registration');
  });
});
