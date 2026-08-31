import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DeleteFormResponsesDto } from '@api/dto/form_response_module/form-response-batch.dto';
import { ListFormResponsesQueryDto } from '@api/dto/form_response_module/list-form-responses-query.dto';

const UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('DeleteFormResponsesDto', () => {
  it('accepts a list of uuids', async () => {
    const dto = plainToInstance(DeleteFormResponsesDto, { ids: [UUID, UUID] });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing ids', async () => {
    const dto = plainToInstance(DeleteFormResponsesDto, {});
    expect(await validate(dto)).toHaveLength(1);
  });

  it('rejects an empty ids', async () => {
    const dto = plainToInstance(DeleteFormResponsesDto, { ids: [] });
    expect(await validate(dto)).toHaveLength(1);
  });

  it('rejects an id that is not a uuid', async () => {
    const dto = plainToInstance(DeleteFormResponsesDto, { ids: [UUID, 'nao-e-uuid'] });
    expect(await validate(dto)).toHaveLength(1);
  });

  // O front limita a seleção a 500; o backend não confia nisso.
  it('rejects more than 500 ids', async () => {
    const dto = plainToInstance(DeleteFormResponsesDto, {
      ids: Array.from({ length: 501 }, () => UUID),
    });
    expect(await validate(dto)).toHaveLength(1);
  });
});

// Assimetria que existia com registrations: aqui o limit era lido cru do
// `@Query` e um `limit=100000` virava um SELECT sem teto.
describe('ListFormResponsesQueryDto.limit', () => {
  it('accepts limit at the 100 ceiling', async () => {
    const dto = plainToInstance(ListFormResponsesQueryDto, { limit: '100' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects limit above 100', async () => {
    const dto = plainToInstance(ListFormResponsesQueryDto, { limit: '101' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('transforms the query string into a number', async () => {
    const dto = plainToInstance(ListFormResponsesQueryDto, { page: '2', limit: '50' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });
});
