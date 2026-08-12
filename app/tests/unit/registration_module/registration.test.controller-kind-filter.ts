import { RegistrationController } from '@api/controllers/registration_module/registration.controller';

function make() {
  const registrations = {
    findAll: jest.fn().mockResolvedValue([]),
    updateAnswers: jest.fn().mockResolvedValue({}),
  };
  const formFields = {
    exportLabels: jest.fn().mockResolvedValue([]),
    validationFields: jest.fn().mockResolvedValue([]),
  };
  const ctrl = new RegistrationController(registrations as any, formFields as any);
  return { ctrl, registrations, formFields };
}

function fakeRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('RegistrationController kind filter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('CSV export (format=csv) only reads dynamic registration-kind labels', async () => {
    const { ctrl, formFields } = make();
    await ctrl.findAll('evt-1', { format: 'csv' } as any, fakeRes() as any);
    expect(formFields.exportLabels).toHaveBeenCalledWith('evt-1', 'registration', true);
  });

  it('updateAnswers only reads registration-kind validation fields', async () => {
    const { ctrl, formFields } = make();
    await ctrl.updateAnswers('evt-1', 'reg-1', { answers: {} } as any);
    expect(formFields.validationFields).toHaveBeenCalledWith('evt-1', 'registration');
  });
});
