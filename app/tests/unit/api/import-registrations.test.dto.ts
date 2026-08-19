import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ImportRegistrationItemDto,
  ImportRegistrationsDto,
} from '@api/dto/registration_module/import-registrations.dto';

describe('ImportRegistrationItemDto', () => {
  it('accepts an item with phone only', async () => {
    const dto = plainToInstance(ImportRegistrationItemDto, { nome: 'Fulano', telefone: '11999998888' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts an item with email only', async () => {
    const dto = plainToInstance(ImportRegistrationItemDto, { nome: 'Fulano', email: 'fulano@email.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an item with only nome (no phone, no email)', async () => {
    const dto = plainToInstance(ImportRegistrationItemDto, { nome: 'Fulano' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'nome')).toBe(true);
  });
});

describe('ImportRegistrationsDto.formId', () => {
  it('accepts a well-formed request with formId', async () => {
    const dto = plainToInstance(ImportRegistrationsDto, {
      formId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      registrations: [{ nome: 'Fulano', email: 'fulano@x.com' }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a request without formId', async () => {
    const dto = plainToInstance(ImportRegistrationsDto, {
      registrations: [{ nome: 'Fulano', email: 'fulano@x.com' }],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'formId')).toBe(true);
  });

  it('rejects more than 500 registrations', async () => {
    const dto = plainToInstance(ImportRegistrationsDto, {
      formId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      registrations: Array.from({ length: 501 }, (_, i) => ({
        nome: `Fulano ${i}`,
        email: `fulano${i}@x.com`,
      })),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'registrations')).toBe(true);
  });
});
