import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateAutomationDto,
  UpdateAutomationDto,
} from '@api/dto/automation_module/automation.dto';

const delayBody = (over: Record<string, unknown> = {}) => ({
  templateId: 'tpl-1',
  trigger: 'on_event_delay',
  delayDirection: 'before',
  delayValue: 2,
  delayUnit: 'hours',
  ...over,
});

const propsWithError = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(CreateAutomationDto, body))).map((e) => e.property);

describe('CreateAutomationDto — on_event_delay', () => {
  it('accepts a complete delay', async () => {
    expect(await validate(plainToInstance(CreateAutomationDto, delayBody()))).toHaveLength(0);
  });

  it('accepts a partial UpdateAutomationDto with only delayValue', async () => {
    const dto = plainToInstance(UpdateAutomationDto, { delayValue: 3 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['delayValue', { delayValue: 0 }],
    ['delayValue', { delayValue: 1.5 }],
    ['delayUnit', { delayUnit: 'weeks' }],
    ['delayDirection', { delayDirection: 'during' }],
    ['delayUnit', { delayUnit: undefined }],
  ])('rejects invalid %s', async (property, over) => {
    expect(await propsWithError(delayBody(over))).toContain(property);
  });

  it('does not demand delay fields for other triggers', async () => {
    const dto = plainToInstance(CreateAutomationDto, {
      templateId: 'tpl-1',
      trigger: 'on_approval',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
