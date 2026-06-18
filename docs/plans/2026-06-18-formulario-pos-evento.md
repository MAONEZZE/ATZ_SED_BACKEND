# Formulário pós-evento (QR) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Segundo formulário por evento, acessado por QR único no fim do evento, cujas respostas ligam ao inscrito existente (`Registration`) e servem de proxy de presença.

**Architecture:** Discriminador `kind` em `FormField` (`registration` | `post_event`) reusa o form-builder atual. Nova tabela `PostEventResponse` (1 por `Registration`, upsert idempotente). Fluxo público por `slug`: lista campos `post_event` e recebe submit com `identifier` (email/telefone) que casa com a `Registration`. Validação de campos obrigatórios segue o padrão de `RegistrationsService.updateAnswers` (controller busca os fields e passa pro service).

**Tech Stack:** NestJS, Prisma + PostgreSQL (schema `ATZ_SED`), Jest + ts-jest (unit, mockando prisma/repo).

**Design:** `docs/plans/2026-06-18-formulario-pos-evento-design.md`

**Convenções do repo:**
- Camadas: `app/api/controllers`, `app/services`, `app/domain`, `app/database`.
- Testes em `tests/unit/*.spec.ts`. Rodar tudo: `npm test`. Um arquivo: `npx jest tests/unit/<arquivo>.spec.ts`.
- Migração: `npm run db:migrate -- --name <nome>` (gera + aplica + `prisma generate`). Só gerar client: `npm run db:generate`.
- Aliases TS: `@domain/* @services/* @database/* @api/*`.
- Commits frequentes, 1 por task.

---

## Task 1: Schema — enum `kind`, `FormField.kind`, modelo `PostEventResponse`

**Files:**
- Modify: `app/database/prisma/schema.prisma`
- Migration: gerada por `npm run db:migrate`

**Step 1: Adicionar o enum `FormFieldKind`**

Logo após o enum `FunnelStatus` (linha ~30):

```prisma
enum FormFieldKind {
  registration
  post_event

  @@schema("ATZ_SED")
}
```

**Step 2: Adicionar `kind` em `FormField` e trocar o índice**

No model `FormField`, adicionar o campo `kind` e substituir `@@index([eventId])` por `@@index([eventId, kind])`:

```prisma
model FormField {
  id        String        @id @default(uuid())
  eventId   String        @map("event_id")
  label     String
  type      FieldType
  required  Boolean       @default(true)
  options   Json?
  order     Int           @default(0)
  isFixed   Boolean       @default(false) @map("is_fixed")
  kind      FormFieldKind @default(registration)
  createdAt DateTime      @default(now()) @map("created_at")
  event     Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId, kind])
  @@map("form_fields")
  @@schema("ATZ_SED")
}
```

**Step 3: Adicionar o model `PostEventResponse`**

Após o model `Registration`:

```prisma
model PostEventResponse {
  id             String       @id @default(uuid())
  eventId        String       @map("event_id")
  registrationId String       @map("registration_id")
  answers        Json
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  event          Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)

  @@unique([registrationId])
  @@index([eventId])
  @@map("post_event_responses")
  @@schema("ATZ_SED")
}
```

**Step 4: Adicionar as relações inversas**

Em `model Event`, junto das outras relações (após `registrations Registration[]`):

```prisma
  postEventResponses PostEventResponse[]
```

Em `model Registration`, após `messageLogs MessageLog[]`:

```prisma
  postEventResponse PostEventResponse?
```

**Step 5: Gerar e aplicar a migração**

Run: `npm run db:migrate -- --name post_event_form`
Expected: migração criada em `app/database/prisma/migrations/`, aplicada sem erro, `prisma generate` ao final. `FormField` existentes assumem `kind = registration` (default).

**Step 6: Verificar que o client compila**

Run: `npm run build`
Expected: build sem erros de tipo.

**Step 7: Commit**

```bash
git add app/database/prisma/schema.prisma app/database/prisma/migrations
git commit -m "feat: schema do formulário pós-evento (FormField.kind + PostEventResponse)"
```

---

## Task 2: DTO + admin form-fields com suporte a `kind`

**Files:**
- Modify: `app/api/controllers/events/events_dto/form-field.dto.ts`
- Modify: `app/api/controllers/events/events_routes/form-fields.controller.ts`
- Test: `tests/unit/form-fields-kind.controller.spec.ts`

**Step 1: Adicionar `kind` ao `CreateFormFieldDto`**

No `form-field.dto.ts`, adicionar import e campo opcional:

```ts
  @ApiPropertyOptional({ enum: ['registration', 'post_event'], example: 'registration' })
  @IsOptional()
  @IsEnum(['registration', 'post_event'])
  kind?: 'registration' | 'post_event';
```

(`IsEnum`, `IsOptional`, `ApiPropertyOptional` já estão importados no arquivo.)

**Step 2: Escrever o teste que falha**

Create `tests/unit/form-fields-kind.controller.spec.ts`:

```ts
import { FormFieldsController } from '../../app/api/controllers/events/events_routes/form-fields.controller';

function makeController() {
  const prisma = {
    formField: {
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  return { ctrl: new FormFieldsController(prisma as any), prisma };
}

describe('FormFieldsController kind support', () => {
  beforeEach(() => jest.clearAllMocks());

  it('default kind registration on create when omitted', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.create('evt-1', { label: 'Nome', type: 'text' } as any);
    expect(prisma.formField.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'registration' }) }),
    );
  });

  it('passes post_event kind on create', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.create('evt-1', { label: 'Nota', type: 'text', kind: 'post_event' } as any);
    expect(prisma.formField.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'post_event' }) }),
    );
  });

  it('filters findAll by kind when given', async () => {
    const { ctrl, prisma } = makeController();
    await ctrl.findAll('evt-1', {} as any, 'post_event' as any);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });
});
```

**Step 3: Rodar o teste e confirmar a falha**

Run: `npx jest tests/unit/form-fields-kind.controller.spec.ts`
Expected: FAIL (create ainda usa `isFixed: false` sem `kind`; `findAll` não aceita kind).

**Step 4: Implementar no controller**

Em `form-fields.controller.ts`, no método `create`, adicionar `kind` ao `data`:

```ts
        order: dto.order ?? 99,
        isFixed: false,
        kind: (dto.kind ?? 'registration') as any,
```

No método `findAll`, aceitar query `kind` e aplicar no where:

```ts
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('kind') kind?: 'registration' | 'post_event',
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    const where = { eventId, ...(kind ? { kind } : {}) };
```

Adicionar a doc Swagger da query (junto dos outros `@ApiQuery`):

```ts
  @ApiQuery({ name: 'kind', required: false, enum: ['registration', 'post_event'] })
```

**Step 5: Rodar o teste e confirmar que passa**

Run: `npx jest tests/unit/form-fields-kind.controller.spec.ts`
Expected: PASS (3 testes).

**Step 6: Commit**

```bash
git add app/api/controllers/events tests/unit/form-fields-kind.controller.spec.ts
git commit -m "feat: campo kind no CRUD de form-fields (registration/post_event)"
```

---

## Task 3: Form de inscrição público só retorna `kind=registration`

**Files:**
- Modify: `app/api/controllers/public/public-events.controller.ts`
- Test: `tests/unit/public-events-form-fields.controller.spec.ts`

**Step 1: Escrever o teste que falha**

Create `tests/unit/public-events-form-fields.controller.spec.ts`:

```ts
import { PublicEventsController } from '../../app/api/controllers/public/public-events.controller';

function makeController(eventRow: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(eventRow) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ctrl: new PublicEventsController(prisma as any), prisma };
}

describe('PublicEventsController.getFormFields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only returns registration-kind fields', async () => {
    const { ctrl, prisma } = makeController({ id: 'evt-1', status: 'published' });
    await ctrl.getFormFields('slug-1');
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'registration' } }),
    );
  });
});
```

**Step 2: Rodar o teste e confirmar a falha**

Run: `npx jest tests/unit/public-events-form-fields.controller.spec.ts`
Expected: FAIL (where atual é `{ eventId: event.id }`).

**Step 3: Implementar**

Em `getFormFields`, ajustar o where do `findMany`:

```ts
    return this.prisma.formField.findMany({
      where: { eventId: event.id, kind: 'registration' },
      orderBy: { order: 'asc' },
      ...
```

**Step 4: Rodar e confirmar que passa**

Run: `npx jest tests/unit/public-events-form-fields.controller.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/controllers/public/public-events.controller.ts tests/unit/public-events-form-fields.controller.spec.ts
git commit -m "fix: form de inscrição público filtra kind=registration"
```

---

## Task 4: Endpoint público de campos pós-evento

**Files:**
- Modify: `app/api/controllers/public/public-events.controller.ts`
- Test: `tests/unit/public-post-event-fields.controller.spec.ts`

**Step 1: Escrever o teste que falha**

Create `tests/unit/public-post-event-fields.controller.spec.ts`:

```ts
import { PublicEventsController } from '../../app/api/controllers/public/public-events.controller';
import { NotFoundException } from '@nestjs/common';

function makeController(eventRow: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(eventRow) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ctrl: new PublicEventsController(prisma as any), prisma };
}

describe('PublicEventsController.getPostEventFields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns post_event fields for a published event', async () => {
    const { ctrl, prisma } = makeController({ id: 'evt-1', status: 'published' });
    await ctrl.getPostEventFields('slug-1');
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });

  it('returns post_event fields for an ended event', async () => {
    const { ctrl } = makeController({ id: 'evt-1', status: 'ended' });
    await expect(ctrl.getPostEventFields('slug-1')).resolves.toBeDefined();
  });

  it('throws 404 for a draft event', async () => {
    const { ctrl } = makeController({ id: 'evt-1', status: 'draft' });
    await expect(ctrl.getPostEventFields('slug-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

**Step 2: Rodar o teste e confirmar a falha**

Run: `npx jest tests/unit/public-post-event-fields.controller.spec.ts`
Expected: FAIL (`getPostEventFields` não existe).

**Step 3: Implementar o método**

Em `public-events.controller.ts`, adicionar após `getFormFields`:

```ts
  @Get(':slug/post-event-fields')
  @ApiOperation({ summary: 'Buscar campos do formulário pós-evento (público)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Campos do formulário pós-evento' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  async getPostEventFields(@Param('slug') slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });

    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.formField.findMany({
      where: { eventId: event.id, kind: 'post_event' },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        label: true,
        type: true,
        required: true,
        options: true,
        order: true,
      },
    });
  }
```

**Step 4: Rodar e confirmar que passa**

Run: `npx jest tests/unit/public-post-event-fields.controller.spec.ts`
Expected: PASS (3 testes).

**Step 5: Commit**

```bash
git add app/api/controllers/public/public-events.controller.ts tests/unit/public-post-event-fields.controller.spec.ts
git commit -m "feat: endpoint público de campos do formulário pós-evento"
```

---

## Task 5: Repo — buscar inscrição por contato + upsert da resposta

**Files:**
- Modify: `app/domain/registrations/ports/registration-repository.port.ts`
- Modify: `app/database/registrations/prisma-registration.repository.ts`
- Test: `tests/unit/post-event-response-repo.spec.ts`

**Step 1: Adicionar métodos ao port**

Em `registration-repository.port.ts`, adicionar a interface de dado e dois métodos:

```ts
export interface PostEventResponseData {
  eventId: string;
  registrationId: string;
  answers: Record<string, unknown>;
}

export interface RegistrationRepositoryPort {
  // ...métodos existentes...
  findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<RegistrationEntity | null>;
  upsertPostEventResponse(data: PostEventResponseData): Promise<void>;
}
```

**Step 2: Escrever o teste que falha**

Create `tests/unit/post-event-response-repo.spec.ts`:

```ts
import { PrismaRegistrationRepository } from '../../app/database/registrations/prisma-registration.repository';

function makeRepo() {
  const prisma = {
    registration: { findFirst: jest.fn().mockResolvedValue(null) },
    postEventResponse: { upsert: jest.fn().mockResolvedValue({}) },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma };
}

describe('PrismaRegistrationRepository post-event', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds by email OR phone within the event', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findByEventAndContact('evt-1', { email: 'a@b.com', phone: '5511' });
    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'evt-1',
        OR: [
          { email: { equals: 'a@b.com', mode: 'insensitive' } },
          { phone: { contains: '5511' } },
        ],
      },
    });
  });

  it('omits email clause when only phone given', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findByEventAndContact('evt-1', { phone: '5511' });
    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt-1', OR: [{ phone: { contains: '5511' } }] },
    });
  });

  it('upserts the post-event response keyed by registrationId', async () => {
    const { repo, prisma } = makeRepo();
    await repo.upsertPostEventResponse({ eventId: 'evt-1', registrationId: 'r1', answers: { q: 'a' } });
    expect(prisma.postEventResponse.upsert).toHaveBeenCalledWith({
      where: { registrationId: 'r1' },
      create: { eventId: 'evt-1', registrationId: 'r1', answers: { q: 'a' } },
      update: { answers: { q: 'a' } },
    });
  });
});
```

**Step 3: Rodar o teste e confirmar a falha**

Run: `npx jest tests/unit/post-event-response-repo.spec.ts`
Expected: FAIL (métodos não existem).

**Step 4: Implementar no repo prisma**

Em `prisma-registration.repository.ts`, importar o tipo e adicionar os métodos (usar `Prisma.InputJsonValue` como nos outros métodos):

```ts
  async findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<RegistrationEntity | null> {
    const or: Prisma.RegistrationWhereInput[] = [];
    if (contact.email) or.push({ email: { equals: contact.email, mode: 'insensitive' } });
    if (contact.phone) or.push({ phone: { contains: contact.phone } });
    if (or.length === 0) return null;
    const row = await this.prisma.registration.findFirst({ where: { eventId, OR: or } });
    return row ? this.map(row) : null;
  }

  async upsertPostEventResponse(data: {
    eventId: string;
    registrationId: string;
    answers: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.postEventResponse.upsert({
      where: { registrationId: data.registrationId },
      create: {
        eventId: data.eventId,
        registrationId: data.registrationId,
        answers: data.answers as Prisma.InputJsonValue,
      },
      update: { answers: data.answers as Prisma.InputJsonValue },
    });
  }
```

> Nota: no caso "só phone" o `or.length` é 1, mantendo `OR: [{ phone: ... }]` — bate com o teste. O guard `or.length === 0` cobre identifier vazio (defesa; o service já valida antes).

**Step 5: Rodar e confirmar que passa**

Run: `npx jest tests/unit/post-event-response-repo.spec.ts`
Expected: PASS (3 testes).

**Step 6: Commit**

```bash
git add app/domain/registrations/ports app/database/registrations/prisma-registration.repository.ts tests/unit/post-event-response-repo.spec.ts
git commit -m "feat: repo busca inscrição por contato e upsert de PostEventResponse"
```

---

## Task 6: Service — `submitPostEvent`

**Files:**
- Modify: `app/services/registrations/registrations.service.ts`
- Test: `tests/unit/submit-post-event.service.spec.ts`

**Step 1: Escrever o teste que falha**

Create `tests/unit/submit-post-event.service.spec.ts`:

```ts
import { RegistrationsService } from '../../app/services/registrations/registrations.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function make(eventStatus = 'ended', reg: any = { id: 'r1', eventId: 'evt-1' }) {
  const regRepo = {
    findByEventAndContact: jest.fn().mockResolvedValue(reg),
    upsertPostEventResponse: jest.fn().mockResolvedValue(undefined),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue({ id: 'evt-1', status: eventStatus, ownerId: 'o1' }),
  };
  const emitter = { emit: jest.fn() };
  const svc = new RegistrationsService(regRepo as any, eventsService as any, emitter as any);
  return { svc, regRepo, eventsService };
}

const FIELDS = [{ label: 'Nota', type: 'text', required: true, isFixed: false }];

describe('RegistrationsService.submitPostEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('treats identifier with @ as email', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS);
    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', { email: 'a@b.com' });
  });

  it('treats identifier without @ as phone (digits only)', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', '(55) 11 99999-0000', { Nota: '10' }, FIELDS);
    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', { phone: '5511999990000' });
  });

  it('upserts the response when registration is found', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS);
    expect(regRepo.upsertPostEventResponse).toHaveBeenCalledWith({
      eventId: 'evt-1',
      registrationId: 'r1',
      answers: { Nota: '10' },
    });
  });

  it('rejects event not published/ended', async () => {
    const { svc } = make('draft');
    await expect(svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404 when no matching registration', async () => {
    const { svc } = make('ended', null);
    await expect(svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('400 when a required post-event field is missing', async () => {
    const { svc } = make();
    await expect(svc.submitPostEvent('slug-1', 'a@b.com', {}, FIELDS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

**Step 2: Rodar o teste e confirmar a falha**

Run: `npx jest tests/unit/submit-post-event.service.spec.ts`
Expected: FAIL (`submitPostEvent` não existe).

**Step 3: Implementar o método no service**

Em `registrations.service.ts`, adicionar (reaproveitando o laço de validação de obrigatórios já presente em `updateAnswers`):

```ts
  async submitPostEvent(
    slug: string,
    identifier: string,
    answers: Record<string, unknown>,
    postEventFields: Array<{ label: string; required: boolean }>,
  ): Promise<void> {
    const event = await this.eventsService.findBySlug(slug);
    if (event.status !== 'published' && event.status !== 'ended') {
      throw new BadRequestException('Event is not accepting post-event responses');
    }

    const id = identifier?.trim() ?? '';
    const contact = id.includes('@')
      ? { email: id.toLowerCase() }
      : { phone: id.replace(/\D/g, '') };

    const reg = await this.regRepo.findByEventAndContact(event.id, contact);
    if (!reg) throw new NotFoundException('Inscrição não encontrada');

    for (const field of postEventFields) {
      if (field.required) {
        const val = answers[field.label];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw new BadRequestException(`Campo obrigatório ausente: "${field.label}"`);
        }
      }
    }

    await this.regRepo.upsertPostEventResponse({
      eventId: event.id,
      registrationId: reg.id,
      answers,
    });
  }
```

**Step 4: Rodar e confirmar que passa**

Run: `npx jest tests/unit/submit-post-event.service.spec.ts`
Expected: PASS (6 testes).

**Step 5: Commit**

```bash
git add app/services/registrations/registrations.service.ts tests/unit/submit-post-event.service.spec.ts
git commit -m "feat: RegistrationsService.submitPostEvent (match por contato + validação)"
```

---

## Task 7: Controller público de submit + DTO + wiring do módulo

**Files:**
- Create: `app/api/controllers/public/public-post-event.controller.ts`
- Create: `app/api/controllers/public/public_dto/submit-post-event.dto.ts`
- Modify: `app/api/controllers/public/public.module.ts`
- Test: `tests/unit/public-post-event.controller.spec.ts`

**Step 1: Criar o DTO**

Create `app/api/controllers/public/public_dto/submit-post-event.dto.ts`:

```ts
import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitPostEventDto {
  @ApiProperty({ example: 'joao@email.com', description: 'Email ou telefone do inscrito' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: { 'Como avalia o evento?': 'Ótimo' } })
  @IsObject()
  answers!: Record<string, unknown>;
}
```

**Step 2: Escrever o teste que falha**

Create `tests/unit/public-post-event.controller.spec.ts`:

```ts
import { PublicPostEventController } from '../../app/api/controllers/public/public-post-event.controller';

function make() {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
    formField: {
      findMany: jest.fn().mockResolvedValue([{ label: 'Nota', required: true }]),
    },
  };
  const registrations = { submitPostEvent: jest.fn().mockResolvedValue(undefined) };
  return { ctrl: new PublicPostEventController(registrations as any, prisma as any), prisma, registrations };
}

describe('PublicPostEventController.submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads post_event fields and forwards to the service', async () => {
    const { ctrl, prisma, registrations } = make();
    await ctrl.submit('slug-1', { identifier: 'a@b.com', answers: { Nota: '10' } } as any);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { event: { slug: 'slug-1' }, kind: 'post_event' } }),
    );
    expect(registrations.submitPostEvent).toHaveBeenCalledWith(
      'slug-1',
      'a@b.com',
      { Nota: '10' },
      [{ label: 'Nota', required: true }],
    );
  });
});
```

**Step 3: Rodar o teste e confirmar a falha**

Run: `npx jest tests/unit/public-post-event.controller.spec.ts`
Expected: FAIL (controller não existe).

**Step 4: Criar o controller**

Create `app/api/controllers/public/public-post-event.controller.ts`:

```ts
import { Controller, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { PrismaService } from '@database/prisma/prisma.service';
import { SubmitPostEventDto } from './public_dto/submit-post-event.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicPostEventController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':slug/post-event')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar respostas do formulário pós-evento' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Resposta registrada' })
  @ApiResponse({ status: 400, description: 'Evento inválido ou campo obrigatório ausente' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  async submit(@Param('slug') slug: string, @Body() dto: SubmitPostEventDto) {
    const fields = await this.prisma.formField.findMany({
      where: { event: { slug }, kind: 'post_event' },
      select: { label: true, required: true },
    });
    await this.registrations.submitPostEvent(slug, dto.identifier, dto.answers, fields);
    return { ok: true };
  }
}
```

**Step 5: Registrar no módulo**

Em `public.module.ts`, importar e adicionar o controller. `RegistrationsModule` já está importado e exporta `RegistrationsService`; o `PrismaService` é global no projeto (confirmar — `PublicEventsController` injeta `PrismaService` sem importar PrismaModule, logo é global):

```ts
import { PublicPostEventController } from './public-post-event.controller';
// ...
  controllers: [PublicRegistrationsController, PublicEventsController, PublicPostEventController],
```

**Step 6: Rodar o teste e confirmar que passa**

Run: `npx jest tests/unit/public-post-event.controller.spec.ts`
Expected: PASS.

**Step 7: Build de sanidade**

Run: `npm run build`
Expected: sem erros.

**Step 8: Commit**

```bash
git add app/api/controllers/public tests/unit/public-post-event.controller.spec.ts
git commit -m "feat: endpoint público POST /public/events/:slug/post-event"
```

---

## Task 8: Verificação final

**Step 1: Rodar a suíte inteira**

Run: `npm test`
Expected: todos verdes (incl. os 5 arquivos novos de spec).

**Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

**Step 3: Smoke manual (opcional, requer DB)**

- `POST /events/:id/form-fields` com `{ "label":"Como avalia?","type":"text","kind":"post_event" }` → cria campo post_event.
- `GET /public/events/:slug/post-event-fields` → retorna só esse campo.
- `POST /public/events/:slug/post-event` com `{ "identifier":"<email-de-um-inscrito>","answers":{"Como avalia?":"Ótimo"} }` → `200 {ok:true}`; conferir linha em `post_event_responses`.
- Reenviar o mesmo POST com outra nota → mesma linha atualizada (upsert), sem duplicar.

**Step 4: Commit final (se houve ajuste de lint/format)**

```bash
git add -A
git commit -m "chore: lint/format do formulário pós-evento"
```

---

## Notas de revisão / riscos

- **`PrismaService` global:** o plano assume que `PrismaService` é injetável sem importar `PrismaModule` no `PublicModule` (como já faz `PublicEventsController`). Se o build da Task 7 falhar por DI, adicionar `PrismaModule`/provider ao `PublicModule`.
- **`findBySlug`:** já usado em `createPublic`; retorna evento com `id`, `status`, `ownerId`.
- **Telefone:** match por `contains` dos dígitos (não normaliza DDI/9º dígito). Suficiente pro MVP; revisar se houver muitos "não encontrado".
- **Fora de escopo (YAGNI):** entrega do QR via automação `after_event`, dashboard de presença, evento `post_event.submitted`, leitura/listagem das respostas no admin (adicionar quando o front pedir).
