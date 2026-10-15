import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { EventController } from '@api/controllers/event_module/event.controller';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { GlobalExceptionFilter } from '@api/config/filters/http-exception.filter';
import { EventService } from '@application/event_module/event.service';
import { EventLifecycleService } from '@application/event_module/event-lifecycle.service';
import { PrismaEventRepository } from '@infra/repositories/event_module/prisma-event.repository';
import { PrismaService } from '@infra/prisma/prisma.service';

/**
 * POST/PATCH /events com slug ponta a ponta: DTO + ValidationPipe e filtro
 * global iguais ao main.ts, service e repositório reais. Só o Prisma é um
 * store em memória que aplica o @unique de `slug` (P2002), como o banco.
 */

type Row = Record<string, unknown> & { id: string; slug: string };

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`slug`)',
    {
      code: 'P2002',
      clientVersion: 'test',
    },
  );
}

function makeFakePrisma() {
  const rows = new Map<string, Row>();
  let seq = 0;
  // Simula a corrida: a checagem do service não vê o slug, mas o banco já o tem.
  let hideSlugOnNextLookup = false;

  const baseRow = (): Omit<Row, 'id' | 'slug'> => ({
    ownerId: 'owner-1',
    title: 'Evento',
    status: 'draft',
    coverUrl: null,
    location: null,
    capacity: null,
    dressCode: null,
    groupLink: null,
    eventDate: null,
    endDate: null,
    whatsappInstanceId: null,
    whatsappToken: null,
    lastEditedById: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    recurrenceUntil: null,
    folderId: null,
    order: 0,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  });

  const slugTaken = (slug: string, exceptId?: string) =>
    [...rows.values()].some((r) => r.slug === slug && r.id !== exceptId);

  const event = {
    findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) => {
      if (where.id) return Promise.resolve(rows.get(where.id) ?? null);
      if (hideSlugOnNextLookup) {
        hideSlugOnNextLookup = false;
        return Promise.resolve(null);
      }
      return Promise.resolve([...rows.values()].find((r) => r.slug === where.slug) ?? null);
    }),
    create: jest.fn(({ data }: { data: Row }) => {
      if (slugTaken(data.slug)) return Promise.reject(uniqueViolation());
      const row: Row = { ...baseRow(), ...data, id: `evt-${++seq}` };
      rows.set(row.id, row);
      return Promise.resolve(row);
    }),
    update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const current = rows.get(where.id);
      if (!current) return Promise.reject(new Error('Record not found'));
      if (data.slug && slugTaken(data.slug, where.id)) return Promise.reject(uniqueViolation());
      const row = { ...current, ...data } as Row;
      rows.set(row.id, row);
      return Promise.resolve(row);
    }),
  };

  return {
    prisma: { event } as unknown as PrismaService,
    rows,
    seed(slug: string, extra: Partial<Row> = {}): Row {
      const row: Row = { ...baseRow(), ...extra, id: `evt-${++seq}`, slug };
      rows.set(row.id, row);
      return row;
    },
    simulateRace() {
      hideSlugOnNextLookup = true;
    },
  };
}

type EventBody = { slug: string; title: string };
const body = (res: request.Response) => res.body as EventBody;

const authAs = (userId: string) => ({
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest<{ user: unknown }>().user = { id: userId };
    return true;
  },
});

describe('POST/PATCH /events slug (HTTP)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof makeFakePrisma>;

  beforeEach(async () => {
    db = makeFakePrisma();
    const repo = new PrismaEventRepository(db.prisma);
    const eventService = new EventService(
      repo,
      {} as never,
      {} as never,
      { isAllowedForProfile: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      { get: jest.fn() } as never,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [EventController],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: EventLifecycleService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authAs('owner-1'))
      .overrideGuard(OwnershipGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /events', () => {
    it('generates the slug from the title when slug is omitted', async () => {
      const res = await http().post('/events').send({ title: 'Meu Evento Incrível' }).expect(201);

      expect(body(res).slug).toMatch(/^meu-evento-incrivel-[0-9A-F]{6}$/);
    });

    it('stores a custom slug literally, without suffix', async () => {
      const res = await http()
        .post('/events')
        .send({ title: 'Meu Evento', slug: 'meu-evento-2026' })
        .expect(201);

      expect(body(res).slug).toBe('meu-evento-2026');
      expect([...db.rows.values()].map((r) => r.slug)).toEqual(['meu-evento-2026']);
    });

    it.each([
      ['uppercase', 'Meu-Evento'],
      ['accent', 'evento-ação'],
      ['space', 'meu evento'],
      ['leading hyphen', '-evento'],
      ['trailing hyphen', 'evento-'],
      ['double hyphen', 'meu--evento'],
      ['underscore', 'meu_evento'],
      ['too short', 'ab'],
      ['too long', 'a'.repeat(101)],
      ['empty', ''],
      ['not a string', 123],
    ])('rejects an invalid slug (%s) with 400', async (_case, slug) => {
      const res = await http().post('/events').send({ title: 'Evento', slug }).expect(400);

      expect(JSON.stringify(res.body)).toContain('slug');
      expect(db.rows.size).toBe(0);
    });

    it('accepts boundary lengths (3 and 100)', async () => {
      await http().post('/events').send({ title: 'Evento', slug: 'abc' }).expect(201);
      await http()
        .post('/events')
        .send({ title: 'Evento', slug: 'a'.repeat(100) })
        .expect(201);
    });

    it('returns 409 when the slug is already used by another event', async () => {
      db.seed('slug-ocupado');

      const res = await http()
        .post('/events')
        .send({ title: 'Evento', slug: 'slug-ocupado' })
        .expect(409);

      expect(JSON.stringify(res.body)).toContain('Slug already in use');
      expect(db.rows.size).toBe(1);
    });

    it('returns 409 (not 500) when the unique constraint wins a race', async () => {
      db.seed('slug-ocupado');
      db.simulateRace();

      const res = await http()
        .post('/events')
        .send({ title: 'Evento', slug: 'slug-ocupado' })
        .expect(409);

      expect(JSON.stringify(res.body)).toContain('Slug already in use');
    });
  });

  describe('PATCH /events/:id', () => {
    it('changes the slug', async () => {
      const evt = db.seed('slug-antigo');

      const res = await http().patch(`/events/${evt.id}`).send({ slug: 'slug-novo' }).expect(200);

      expect(body(res).slug).toBe('slug-novo');
      expect(db.rows.get(evt.id)?.slug).toBe('slug-novo');
    });

    it('accepts re-sending the event own current slug', async () => {
      const evt = db.seed('meu-slug');

      const res = await http()
        .patch(`/events/${evt.id}`)
        .send({ slug: 'meu-slug', title: 'Outro título' })
        .expect(200);

      expect(body(res).slug).toBe('meu-slug');
      expect(body(res).title).toBe('Outro título');
    });

    it('keeps the slug when only the title changes', async () => {
      const evt = db.seed('slug-fixo');

      const res = await http()
        .patch(`/events/${evt.id}`)
        .send({ title: 'Título Totalmente Novo' })
        .expect(200);

      expect(body(res).slug).toBe('slug-fixo');
    });

    it('allows changing the slug of a published event', async () => {
      const evt = db.seed('publicado', { status: 'published' });

      await http().patch(`/events/${evt.id}`).send({ slug: 'publicado-novo' }).expect(200);

      expect(db.rows.get(evt.id)?.slug).toBe('publicado-novo');
    });

    it.each([
      ['uppercase', 'Slug-Novo'],
      ['accent', 'promoção'],
      ['too short', 'ab'],
      ['double hyphen', 'a--b'],
    ])('rejects an invalid slug (%s) with 400 and keeps the old one', async (_case, slug) => {
      const evt = db.seed('slug-antigo');

      await http().patch(`/events/${evt.id}`).send({ slug }).expect(400);

      expect(db.rows.get(evt.id)?.slug).toBe('slug-antigo');
    });

    it('returns 409 when the slug belongs to another event and keeps the old one', async () => {
      db.seed('slug-do-outro');
      const evt = db.seed('slug-antigo');

      const res = await http()
        .patch(`/events/${evt.id}`)
        .send({ slug: 'slug-do-outro' })
        .expect(409);

      expect(JSON.stringify(res.body)).toContain('Slug already in use');
      expect(db.rows.get(evt.id)?.slug).toBe('slug-antigo');
    });

    it('returns 409 (not 500) when the unique constraint wins a race', async () => {
      db.seed('slug-do-outro');
      const evt = db.seed('slug-antigo');
      db.simulateRace();

      await http().patch(`/events/${evt.id}`).send({ slug: 'slug-do-outro' }).expect(409);

      expect(db.rows.get(evt.id)?.slug).toBe('slug-antigo');
    });
  });
});
