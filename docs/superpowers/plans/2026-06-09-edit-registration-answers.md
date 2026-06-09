# Edit Registration Answers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PATCH /events/:eventId/registrations/:id` so the event organizer can edit all form-field answers for a registration, validating against the event's FormFields and syncing the fixed columns (`name`, `email`, `phone`).

**Architecture:** The controller loads the event's FormFields via the already-injected `PrismaService`, passes them to a new `RegistrationsService.updateAnswers()` method that validates and extracts fixed-column values, then delegates persistence to a new `RegistrationRepositoryPort.updateAnswers()` method implemented in `PrismaRegistrationRepository`.

**Tech Stack:** NestJS, Prisma, class-validator, Jest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `app/api/controllers/registrations/registrations_dto/update-registration-answers.dto.ts` | DTO for PATCH body |
| **Modify** | `app/domain/registrations/ports/registration-repository.port.ts` | Add `updateAnswers` + `UpdateAnswersData` |
| **Modify** | `app/database/registrations/prisma-registration.repository.ts` | Implement `updateAnswers` |
| **Modify** | `app/services/registrations/registrations.service.ts` | Add `updateAnswers` service method |
| **Modify** | `app/api/controllers/registrations/registrations_routes/registrations.controller.ts` | Add `PATCH :id` handler |
| **Create** | `tests/unit/registrations-update-answers-repo.spec.ts` | Repository unit tests |
| **Create** | `tests/unit/registrations-update-answers-service.spec.ts` | Service unit tests |

---

## Task 1 — DTO

**Files:**
- Create: `app/api/controllers/registrations/registrations_dto/update-registration-answers.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
// app/api/controllers/registrations/registrations_dto/update-registration-answers.dto.ts
import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRegistrationAnswersDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { Nome: 'João Silva', 'E-mail': 'joao@example.com', Telefone: '11999999999' },
  })
  @IsObject()
  answers!: Record<string, unknown>;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/controllers/registrations/registrations_dto/update-registration-answers.dto.ts
git commit -m "feat: add UpdateRegistrationAnswersDto"
```

---

## Task 2 — Repository Port + Prisma Implementation

**Files:**
- Modify: `app/domain/registrations/ports/registration-repository.port.ts`
- Modify: `app/database/registrations/prisma-registration.repository.ts`
- Create: `tests/unit/registrations-update-answers-repo.spec.ts`

- [ ] **Step 1: Write the failing repository test**

Create `tests/unit/registrations-update-answers-repo.spec.ts`:

```typescript
import { PrismaRegistrationRepository } from '../../app/database/registrations/prisma-registration.repository';
import { Prisma } from '@prisma/client';

function makeRepo() {
  const row = {
    id: 'reg-1',
    eventId: 'evt-1',
    status: 'pending',
    answers: { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999' },
    name: 'João',
    email: 'joao@test.com',
    phone: '11999',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
  const prisma = {
    registration: {
      update: jest.fn().mockResolvedValue(row),
    },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma, row };
}

describe('PrismaRegistrationRepository.updateAnswers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls prisma.registration.update with answers JSON and all three fixed columns', async () => {
    const { repo, prisma } = makeRepo();
    const answers = { Nome: 'Maria', 'E-mail': 'maria@test.com', Telefone: '11888' };

    await repo.updateAnswers('reg-1', {
      answers,
      name: 'Maria',
      email: 'maria@test.com',
      phone: '11888',
    });

    expect(prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: {
        answers: answers as Prisma.InputJsonValue,
        name: 'Maria',
        email: 'maria@test.com',
        phone: '11888',
      },
    });
  });

  it('omits name/email/phone keys when they are not present in data', async () => {
    const { repo, prisma } = makeRepo();
    const answers = { Cidade: 'SP' };

    await repo.updateAnswers('reg-1', { answers });

    expect(prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: { answers: answers as Prisma.InputJsonValue },
    });
  });

  it('returns mapped RegistrationEntity', async () => {
    const { repo } = makeRepo();
    const result = await repo.updateAnswers('reg-1', { answers: {} });
    expect(result.id).toBe('reg-1');
    expect(result.eventId).toBe('evt-1');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest tests/unit/registrations-update-answers-repo.spec.ts --no-coverage
```

Expected: FAIL — `repo.updateAnswers is not a function`

- [ ] **Step 3: Add `UpdateAnswersData` and `updateAnswers` to the repository port**

Replace the full content of `app/domain/registrations/ports/registration-repository.port.ts`:

```typescript
import { RegistrationEntity, FunnelStatus } from '../entities/registration.entity';

export const REGISTRATION_REPOSITORY_PORT = Symbol('REGISTRATION_REPOSITORY_PORT');

export interface CreateRegistrationData {
  eventId: string;
  answers: Record<string, unknown>;
  name: string;
  email: string;
  phone: string;
}

export interface UpdateAnswersData {
  answers: Record<string, unknown>;
  name?: string;
  email?: string;
  phone?: string;
}

export interface RegistrationRepositoryPort {
  findById(id: string): Promise<RegistrationEntity | null>;
  findAllByEvent(
    eventId: string,
    status?: FunnelStatus,
    search?: string,
  ): Promise<RegistrationEntity[]>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    status?: FunnelStatus,
    search?: string,
  ): Promise<{ data: RegistrationEntity[]; total: number }>;
  create(data: CreateRegistrationData): Promise<RegistrationEntity>;
  updateStatus(id: string, status: FunnelStatus): Promise<RegistrationEntity>;
  updateAnswers(id: string, data: UpdateAnswersData): Promise<RegistrationEntity>;
}
```

- [ ] **Step 4: Implement `updateAnswers` in `PrismaRegistrationRepository`**

In `app/database/registrations/prisma-registration.repository.ts`:

1. Update the import from the port to include `UpdateAnswersData`:

```typescript
import {
  RegistrationRepositoryPort,
  CreateRegistrationData,
  UpdateAnswersData,
} from '@domain/registrations/ports/registration-repository.port';
```

2. Add this method at the end of the class, after `updateStatus`:

```typescript
async updateAnswers(
  id: string,
  data: UpdateAnswersData,
): Promise<RegistrationEntity> {
  const row = await this.prisma.registration.update({
    where: { id },
    data: {
      answers: data.answers as Prisma.InputJsonValue,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    },
  });
  return this.map(row);
}
```

- [ ] **Step 5: Run repository test — expect pass**

```bash
npx jest tests/unit/registrations-update-answers-repo.spec.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/domain/registrations/ports/registration-repository.port.ts \
        app/database/registrations/prisma-registration.repository.ts \
        tests/unit/registrations-update-answers-repo.spec.ts
git commit -m "feat: add updateAnswers to registration repository port and Prisma implementation"
```

---

## Task 3 — Service Method

**Files:**
- Modify: `app/services/registrations/registrations.service.ts`
- Create: `tests/unit/registrations-update-answers-service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/unit/registrations-update-answers-service.spec.ts`:

```typescript
import { RegistrationsService } from '../../app/services/registrations/registrations.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type FormFieldLike = { label: string; type: string; required: boolean; isFixed: boolean };

function makeService(regOverrides: Partial<{ id: string; eventId: string }> = {}) {
  const reg = {
    id: 'reg-1',
    eventId: 'evt-1',
    status: 'pending',
    answers: {},
    name: 'Old Name',
    email: 'old@test.com',
    phone: '11000',
    createdAt: new Date(),
    updatedAt: new Date(),
    canTransitionTo: jest.fn(),
    ...regOverrides,
  };
  const regRepo = {
    findById: jest.fn().mockResolvedValue(reg),
    updateAnswers: jest.fn().mockResolvedValue({ ...reg, answers: { Nome: 'New' } }),
    updateStatus: jest.fn(),
    create: jest.fn(),
    findAllByEvent: jest.fn(),
    findAllByEventPaginated: jest.fn(),
  };
  const eventsService = { findBySlug: jest.fn(), findById: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const service = new RegistrationsService(
    regRepo as any,
    eventsService as any,
    eventEmitter as any,
  );
  return { service, regRepo };
}

const allFields: FormFieldLike[] = [
  { label: 'Nome', type: 'text', required: true, isFixed: true },
  { label: 'E-mail', type: 'email', required: true, isFixed: true },
  { label: 'Telefone', type: 'phone', required: true, isFixed: true },
  { label: 'Cidade', type: 'text', required: false, isFixed: false },
];

describe('RegistrationsService.updateAnswers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundException when registration not found', async () => {
    const { service, regRepo } = makeService();
    regRepo.findById.mockResolvedValue(null);
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1' },
        allFields,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when registration belongs to different event', async () => {
    const { service } = makeService({ eventId: 'OTHER' });
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1' },
        allFields,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when required field is missing from answers', async () => {
    const { service } = makeService();
    // 'Telefone' is required but omitted
    await expect(
      service.updateAnswers('reg-1', 'evt-1', { Nome: 'X', 'E-mail': 'x@x.com' }, allFields),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when required field value is empty string', async () => {
    const { service } = makeService();
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: '', 'E-mail': 'x@x.com', Telefone: '1' },
        allFields,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts extra unknown keys in answers without error', async () => {
    const { service } = makeService();
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1', UnknownField: 'foo' },
        allFields,
      ),
    ).resolves.not.toThrow();
  });

  it('syncs name/email/phone from fixed fields into the repository call', async () => {
    const { service, regRepo } = makeService();
    const answers = { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999', Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, allFields);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', {
      answers,
      name: 'João',
      email: 'joao@test.com',
      phone: '11999',
    });
  });

  it('omits fixed column keys when their label is absent from answers', async () => {
    const { service, regRepo } = makeService();
    // fields: only a non-required non-fixed field — no fixed fields present
    const fieldsNoFixed: FormFieldLike[] = [
      { label: 'Cidade', type: 'text', required: false, isFixed: false },
    ];
    const answers = { Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, fieldsNoFixed);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', { answers });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest tests/unit/registrations-update-answers-service.spec.ts --no-coverage
```

Expected: FAIL — `service.updateAnswers is not a function`

- [ ] **Step 3: Add `updateAnswers` to `RegistrationsService`**

In `app/services/registrations/registrations.service.ts`, add this method after `updateStatus`. No new imports needed — `NotFoundException` and `BadRequestException` are already imported.

```typescript
async updateAnswers(
  id: string,
  eventId: string,
  answers: Record<string, unknown>,
  formFields: Array<{ label: string; type: string; required: boolean; isFixed: boolean }>,
): Promise<RegistrationEntity> {
  const reg = await this.regRepo.findById(id);
  if (!reg || reg.eventId !== eventId) {
    throw new NotFoundException('Registration not found');
  }

  for (const field of formFields) {
    if (field.required) {
      const val = answers[field.label];
      if (val === undefined || val === null || String(val).trim() === '') {
        throw new BadRequestException(`Campo obrigatório ausente: "${field.label}"`);
      }
    }
  }

  const updateData: { answers: Record<string, unknown>; name?: string; email?: string; phone?: string } =
    { answers };

  for (const f of formFields.filter((f) => f.isFixed)) {
    const raw = answers[f.label];
    const val = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
    if (f.type === 'text' && val !== undefined) updateData.name = val;
    else if (f.type === 'email' && val !== undefined) updateData.email = val;
    else if (f.type === 'phone' && val !== undefined) updateData.phone = val;
  }

  return this.regRepo.updateAnswers(id, updateData);
}
```

- [ ] **Step 4: Run service tests — expect pass**

```bash
npx jest tests/unit/registrations-update-answers-service.spec.ts --no-coverage
```

Expected: PASS (7 tests)

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/services/registrations/registrations.service.ts \
        tests/unit/registrations-update-answers-service.spec.ts
git commit -m "feat: add updateAnswers to RegistrationsService with FormField validation and fixed-column sync"
```

---

## Task 4 — Controller Handler

**Files:**
- Modify: `app/api/controllers/registrations/registrations_routes/registrations.controller.ts`

- [ ] **Step 1: Add import and PATCH `:id` handler to the controller**

Replace the full content of `app/api/controllers/registrations/registrations_routes/registrations.controller.ts`:

```typescript
import { Controller, Get, Patch, Param, Body, UseGuards, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { buildRegistrationsCsv } from '@services/registrations/registrations-csv';
import { FunnelStatus } from '@domain/registrations/entities/registration.entity';
import { UpdateRegistrationStatusDto } from '../registrations_dto/update-registration-status.dto';
import { UpdateRegistrationAnswersDto } from '../registrations_dto/update-registration-answers.dto';
import { PrismaService } from '@database/prisma/prisma.service';
import { PaginationQueryDto, Paginated } from '@api/common/pagination';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller('events/:eventId/registrations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class RegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar inscrições do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'] })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome ou email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de inscrições' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: FunnelStatus,
    @Query('search') search?: string,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.registrations.findAllPaginated(
      eventId,
      page,
      limit,
      status,
      search,
    );
    return { data, total, page, limit };
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar inscrições em CSV' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'screening', 'qualification', 'approved', 'rejected', 'waitlist'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Arquivo CSV', content: { 'text/csv': {} } })
  async exportCsv(
    @Param('eventId') eventId: string,
    @Res() res: Response,
    @Query('status') status?: FunnelStatus,
    @Query('search') search?: string,
  ) {
    const [regs, formFields] = await Promise.all([
      this.registrations.findAll(eventId, status, search),
      this.prisma.formField.findMany({
        where: { eventId, isFixed: false },
        orderBy: { order: 'asc' },
        select: { label: true },
      }),
    ]);
    const csv = buildRegistrationsCsv(regs, formFields);
    const date = new Date().toISOString().slice(0, 10);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="inscricoes-${eventId}-${date}.csv"`)
      .send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar inscrição por ID' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Inscrição encontrada' })
  findOne(@Param('id') id: string) {
    return this.registrations.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar respostas da inscrição' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Inscrição atualizada' })
  @ApiResponse({ status: 400, description: 'Campo obrigatório ausente' })
  @ApiResponse({ status: 404, description: 'Inscrição não encontrada' })
  async updateAnswers(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationAnswersDto,
  ) {
    const formFields = await this.prisma.formField.findMany({
      where: { eventId },
      select: { label: true, type: true, required: true, isFixed: true },
    });
    return this.registrations.updateAnswers(id, eventId, dto.answers, formFields);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status da inscrição (funil)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID da inscrição' })
  @ApiResponse({ status: 200, description: 'Status atualizado' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrations.updateStatus(id, dto.status, user.id);
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass including the new ones.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/controllers/registrations/registrations_routes/registrations.controller.ts
git commit -m "feat: add PATCH /events/:eventId/registrations/:id endpoint to edit registration answers"
```
