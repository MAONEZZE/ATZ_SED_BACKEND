import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubmitFormResponseDto } from '@api/dto/form_module/form.dto';

const VALIDATOR_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

describe('SubmitFormResponseDto', () => {
  it('accepts phone and answers', async () => {
    const dto = plainToInstance(
      SubmitFormResponseDto,
      { phone: '11999998888', answers: { nome: 'João', email: 'joao@email.com' } },
      { excludeExtraneousValues: false },
    );
    expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
  });

  it('rejects an unknown property', async () => {
    const dto = plainToInstance(SubmitFormResponseDto, {
      phone: '11999998888',
      answers: { nome: 'João' },
      unknownField: 'x',
    });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an empty phone', async () => {
    const dto = plainToInstance(SubmitFormResponseDto, {
      phone: '',
      answers: { nome: 'João' },
    });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });
});
