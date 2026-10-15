import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEventDto } from '@api/dto/event_module/create-event.dto';
import { UpdateEventDto } from '@api/dto/event_module/update-event.dto';

async function slugErrors(cls: new () => object, slug: unknown) {
  const dto = plainToInstance(cls, { title: 'Evento', slug });
  return (await validate(dto)).filter((e) => e.property === 'slug');
}

describe('Event DTO slug', () => {
  it('accepts an absent slug (gerado automaticamente)', async () => {
    const dto = plainToInstance(CreateEventDto, { title: 'Evento' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['meu-evento-2026', 'abc', 'a1-b2'])('accepts %s', async (slug) => {
    expect(await slugErrors(CreateEventDto, slug)).toHaveLength(0);
    expect(await slugErrors(UpdateEventDto, slug)).toHaveLength(0);
  });

  it.each(['Ab', 'ab', 'com espaço', '-x-', 'ação', 'Maiuscula', 'a--b', 'a'.repeat(101)])(
    'rejects %s',
    async (slug) => {
      expect(await slugErrors(CreateEventDto, slug)).not.toHaveLength(0);
      expect(await slugErrors(UpdateEventDto, slug)).not.toHaveLength(0);
    },
  );
});
