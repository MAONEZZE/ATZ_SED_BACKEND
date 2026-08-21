import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAutomationDto } from '@api/dto/automation_module/automation.dto';

describe('CreateAutomationDto.formIds', () => {
  it('accepts an absent formIds (todos os formulários)', async () => {
    const dto = plainToInstance(CreateAutomationDto, { templateId: 'tpl-1', trigger: 'on_approval' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a list of form uuids', async () => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formIds: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-uuid entry in formIds', async () => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formIds: ['not-a-uuid'],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'formIds')).toBe(true);
  });
});

// Não há worker agendado para delay > 0 (removido em 8c8167e e nunca voltou):
// o DTO recusa antes de aceitar uma regra que nunca vai disparar.
describe('CreateAutomationDto.delayMinutes', () => {
  it('accepts an absent delayMinutes', async () => {
    const dto = plainToInstance(CreateAutomationDto, { templateId: 'tpl-1', trigger: 'on_approval' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts delayMinutes: 0 (disparo imediato)', async () => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_approval',
      delayMinutes: 0,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects delayMinutes > 0', async () => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_approval',
      delayMinutes: 30,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'delayMinutes')).toBe(true);
  });
});

describe('CreateAutomationDto.trigger — on_date_form_field', () => {
  it('accepts the new trigger', async () => {
    const dto = plainToInstance(CreateAutomationDto, { templateId: 'tpl-1', trigger: 'on_date_form_field' });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('CreateAutomationDto.sendTime', () => {
  it.each(['09:00', '00:00', '23:59'])('accepts %s', async (value) => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_date_form_field',
      sendTime: value,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['9:00', '24:00', '09:60', '0900'])('rejects %s', async (value) => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_date_form_field',
      sendTime: value,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sendTime')).toBe(true);
  });

  it('is optional', async () => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_date_form_field',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
