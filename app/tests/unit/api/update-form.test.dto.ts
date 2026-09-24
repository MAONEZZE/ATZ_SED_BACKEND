import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateFormDto } from '@api/dto/form_module/form.dto';

const VALIDATOR_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(UpdateFormDto, body), VALIDATOR_OPTIONS);
}

describe('UpdateFormDto post-submit fields', () => {
  it('accepts null to clear the link', async () => {
    const dto = plainToInstance(UpdateFormDto, { linkPostSubscription: null });
    expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    expect(dto.linkPostSubscription).toBeNull();
  });

  it('accepts null to clear the message', async () => {
    expect(await errorsFor({ postRegistrationMessage: null })).toHaveLength(0);
  });

  it('accepts a valid URL', async () => {
    expect(await errorsFor({ linkPostSubscription: 'https://example.com/proximos' })).toHaveLength(
      0,
    );
  });

  it('rejects an invalid URL', async () => {
    expect((await errorsFor({ linkPostSubscription: 'nao-e-url' })).length).toBeGreaterThan(0);
  });

  it('rejects a non-string message', async () => {
    expect((await errorsFor({ postRegistrationMessage: 42 })).length).toBeGreaterThan(0);
  });

  // Omitir = não alterar: a chave não pode surgir como null/undefined explícito.
  it('keeps omitted fields out of the payload', async () => {
    const dto = plainToInstance(UpdateFormDto, { name: 'NPS' });
    expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    expect(dto).not.toHaveProperty('linkPostSubscription');
    expect(dto).not.toHaveProperty('postRegistrationMessage');
  });
});
