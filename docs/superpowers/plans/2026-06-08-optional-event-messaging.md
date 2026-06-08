# Optional Event Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir disparos de mensagem sem evento vinculado via `POST /messaging/send` com `eventId` opcional no body.

**Architecture:** `eventId` torna-se opcional em toda a cadeia (domain port → service → controller). Ownership é validado no service quando `eventId` presente. Endpoint sai de `/events/:eventId/messaging/send` (removido) para `POST /messaging/send` no `GlobalMessagingController`.

**Tech Stack:** NestJS, BullMQ, Prisma, class-validator, Jest

---

## File Map

| Ação | Arquivo |
|------|---------|
| Modify | `app/domain/messaging/ports/outbox-repository.port.ts` |
| Modify | `app/api/controllers/messaging/messaging_dto/send-message.dto.ts` |
| Modify | `app/services/messaging/manual-send.service.ts` |
| Modify | `app/api/controllers/global-messaging/global-messaging.controller.ts` |
| Modify | `app/api/controllers/global-messaging/global-messaging.module.ts` |
| Modify | `app/api/controllers/messaging/messaging.controller.ts` |
| Modify | `app/api/controllers/messaging/messaging.module.ts` |
| Modify | `tests/unit/manual-send.service.spec.ts` |

---

### Task 1: Tornar `eventId` opcional no domain port

**Files:**
- Modify: `app/domain/messaging/ports/outbox-repository.port.ts`

- [ ] **Step 1: Alterar campo `eventId` de `string` para `string | undefined`**

Substituir no arquivo:

```typescript
export interface EnqueueMessageData {
  eventId?: string;   // era: eventId: string
  registrationId?: string;
  templateId?: string;
  trigger: string;
  dedupKey?: string;
  channel: MessageChannel;
  recipient: string;
  instancia?: string;
  renderedBody: string;
  renderedSubject?: string;
}
```

- [ ] **Step 2: Verificar que não há erros de compilação**

```bash
npx tsc --noEmit
```

Expected: zero erros relacionados a `eventId`.

- [ ] **Step 3: Commit**

```bash
git add app/domain/messaging/ports/outbox-repository.port.ts
git commit -m "feat: make eventId optional in EnqueueMessageData domain port"
```

---

### Task 2: Atualizar SendMessageDto

**Files:**
- Modify: `app/api/controllers/messaging/messaging_dto/send-message.dto.ts`

- [ ] **Step 1: Adicionar campos `eventId` e `instancia` ao DTO**

Substituir o conteúdo completo do arquivo:

```typescript
import { IsString, IsOptional, IsIn, IsArray, IsEmail, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualRecipientDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '5511999999999' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'uuid-do-evento', description: 'Vincula disparo a um evento. Opcional.' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ example: 'minha-instancia', description: 'Instância Evolution. Obrigatório se channel=whatsapp e sem eventId.' })
  @IsOptional()
  @IsString()
  instancia?: string;

  @ApiProperty({ enum: ['whatsapp', 'email'], example: 'whatsapp' })
  @IsIn(['whatsapp', 'email'])
  channel!: 'whatsapp' | 'email';

  @ApiPropertyOptional({ example: 'uuid-do-template' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ example: 'Assunto do email' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Conteúdo da mensagem. Suporta {{name}}, {{event.title}}.' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: ['uuid-inscricao-1', 'uuid-inscricao-2'], description: 'Só válido com eventId.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  registrationIds?: string[];

  @ApiPropertyOptional({ type: [ManualRecipientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualRecipientDto)
  manualRecipients?: ManualRecipientDto[];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/controllers/messaging/messaging_dto/send-message.dto.ts
git commit -m "feat: add optional eventId and instancia fields to SendMessageDto"
```

---

### Task 3: Refatorar ManualSendService

**Files:**
- Modify: `app/services/messaging/manual-send.service.ts`

- [ ] **Step 1: Reescrever o service com nova assinatura e lógica condicional**

Substituir o conteúdo completo do arquivo:

```typescript
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '@database/prisma/prisma.service';
import { EventsService } from '@services/events/events.service';
import { OutboxService } from '@services/messaging/outbox.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';
import type { MessageChannel } from '@domain/messaging/types/message-channel.type';

export interface ManualRecipientInput {
  name: string;
  email?: string;
  phone?: string;
}

export interface SendMessageInput {
  eventId?: string;
  instancia?: string;
  channel: MessageChannel;
  templateId?: string;
  subject?: string;
  body?: string;
  registrationIds?: string[];
  manualRecipients?: ManualRecipientInput[];
}

export interface SendMessageResult {
  queued: number;
  skipped: number;
  skippedReason: string[];
}

interface ResolvedRecipient {
  registrationId?: string;
  name: string;
  email: string;
  phone: string;
}

@Injectable()
export class ManualSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
    private readonly config: ConfigService,
  ) {}

  async send(input: SendMessageInput, userId: string): Promise<SendMessageResult> {
    // Guard: registrationIds só com eventId
    if (input.registrationIds?.length && !input.eventId) {
      throw new BadRequestException('registrationIds require an eventId');
    }
    // Guard: WhatsApp sem evento exige instancia no body
    if (input.channel === 'whatsapp' && !input.eventId && !input.instancia) {
      throw new BadRequestException('instancia is required for WhatsApp when no eventId is provided');
    }

    // Resolve evento (ownership) ou instancia avulsa
    let resolvedInstancia: string | undefined;
    let eventContext: {
      id: string;
      title: string;
      eventDate: Date | null;
      location: string | null;
      capacity: number | null;
      dressCode: string | null;
      groupLink: string | null;
      evolutionInstance?: string;
    } | null = null;

    if (input.eventId) {
      const event = await this.eventsService.findById(input.eventId);
      if (event.ownerId !== userId) {
        throw new ForbiddenException('You do not own this event');
      }
      resolvedInstancia = event.evolutionInstance ?? undefined;
      eventContext = event;
    } else {
      resolvedInstancia = input.instancia;
    }

    // Resolve template (opcional)
    let template: {
      id: string;
      channel: string;
      subject: string | null;
      body: string;
    } | null = null;
    if (input.templateId) {
      template = await this.prisma.messageTemplate.findFirst({
        where: {
          id: input.templateId,
          ...(input.eventId ? { eventId: input.eventId } : {}),
        },
      });
      if (!template) throw new NotFoundException('Template not found');
      if (template.channel !== input.channel) {
        throw new BadRequestException(
          `Template channel '${template.channel}' does not match requested channel '${input.channel}'`,
        );
      }
    }

    const bodySource = input.body ?? template?.body;
    if (!bodySource) {
      throw new BadRequestException('Either templateId or body is required');
    }
    const subjectSource = input.subject ?? template?.subject ?? undefined;

    // Resolve destinatários
    const registrations =
      input.registrationIds?.length && input.eventId
        ? await this.prisma.registration.findMany({
            where: { id: { in: input.registrationIds }, eventId: input.eventId },
          })
        : [];
    const recipients: ResolvedRecipient[] = [
      ...registrations.map((r) => ({
        registrationId: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
      })),
      ...(input.manualRecipients ?? []).map((m) => ({
        name: m.name,
        email: m.email ?? '',
        phone: m.phone ?? '',
      })),
    ];
    if (recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    const skippedReason: string[] = [];
    let queued = 0;
    let skipped = 0;
    const seenTargets = new Set<string>();

    const isWhatsapp = input.channel === 'whatsapp';
    const minDelay = this.config.get<number>('WA_MIN_DELAY_MS') ?? 8000;
    const maxDelay = this.config.get<number>('WA_MAX_DELAY_MS') ?? 30000;
    let delayCursor = 0;

    for (const recipient of recipients) {
      const target = input.channel === 'email' ? recipient.email : recipient.phone;
      if (!target) {
        skipped++;
        skippedReason.push(
          input.channel === 'email'
            ? `${recipient.name}: sem email`
            : `${recipient.name}: sem telefone`,
        );
        continue;
      }
      if (seenTargets.has(target)) {
        skipped++;
        skippedReason.push(`${recipient.name}: destinatário duplicado (${target})`);
        continue;
      }
      seenTargets.add(target);

      const variables = this.renderer.buildVariables({
        registration: {
          name: recipient.name,
          email: recipient.email,
          phone: recipient.phone,
        },
        event: eventContext ?? undefined,
      });
      const renderedBody = this.renderer.render(bodySource, variables);
      const renderedSubject = subjectSource
        ? this.renderer.render(subjectSource, variables)
        : undefined;

      const hash = createHash('sha1').update(renderedBody).digest('hex');
      const eventPrefix = input.eventId ?? 'global';
      const dedupKey = `manual:${eventPrefix}:${target}:${hash}`;

      if (isWhatsapp) delayCursor += randomInt(minDelay, maxDelay + 1);
      await this.outbox.enqueue(
        {
          eventId: input.eventId,
          registrationId: recipient.registrationId,
          templateId: template?.id,
          trigger: 'manual',
          dedupKey,
          channel: input.channel,
          recipient: target,
          instancia: resolvedInstancia,
          renderedBody,
          renderedSubject,
        },
        { delayMs: isWhatsapp ? delayCursor : 0 },
      );
      queued++;
    }

    return { queued, skipped, skippedReason };
  }
}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add app/services/messaging/manual-send.service.ts
git commit -m "feat: refactor ManualSendService to support optional eventId with ownership check"
```

---

### Task 4: Atualizar testes do ManualSendService

**Files:**
- Modify: `tests/unit/manual-send.service.spec.ts`

- [ ] **Step 1: Reescrever o arquivo de testes**

Substituir o conteúdo completo:

```typescript
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';

const USER_ID = 'user-owner-1';

const event = {
  id: 'evt-1',
  title: 'Tech Day',
  eventDate: new Date('2026-06-15T18:00:00'),
  location: 'SP',
  capacity: 100,
  dressCode: null,
  groupLink: null,
  ownerId: USER_ID,
  evolutionInstance: 'inst-1',
};

const regJoao = {
  id: 'reg-1',
  eventId: 'evt-1',
  name: 'João',
  email: 'joao@test.com',
  phone: '+5511999999999',
};

const template = {
  id: 'tmpl-1',
  eventId: 'evt-1',
  channel: 'email',
  subject: 'Oi {{nome}}',
  body: 'Olá {{nome}}, bem-vindo ao {{evento}}!',
};

const pacing: Record<string, number> = {
  WA_MIN_DELAY_MS: 1000,
  WA_MAX_DELAY_MS: 1000,
};

function makeService(overrides?: { registrations?: unknown[]; template?: unknown; event?: unknown }) {
  const prisma = {
    registration: {
      findMany: jest.fn().mockResolvedValue(overrides?.registrations ?? [regJoao]),
    },
    messageTemplate: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides && 'template' in overrides ? overrides.template : template),
    },
  };
  const resolvedEvent = overrides && 'event' in overrides ? overrides.event : event;
  const eventsService = { findById: jest.fn().mockResolvedValue(resolvedEvent) };
  const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((key: string) => pacing[key]) };
  const service = new ManualSendService(
    prisma as any,
    eventsService as any,
    outbox as any,
    new TemplateRenderer(),
    config as any,
  );
  return { service, prisma, eventsService, outbox };
}

describe('ManualSendService.send — com evento', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequest when no recipients at all', async () => {
    const { service } = makeService({ registrations: [] });
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', body: 'oi' }, USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound when templateId does not exist for event', async () => {
    const { service } = makeService({ template: null });
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', templateId: 'tmpl-x', registrationIds: ['reg-1'] }, USER_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequest when template channel mismatches request channel', async () => {
    const { service } = makeService({ template: { ...template, channel: 'whatsapp' } });
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', templateId: 'tmpl-1', registrationIds: ['reg-1'] }, USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequest when neither templateId nor body provided', async () => {
    const { service } = makeService();
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', registrationIds: ['reg-1'] }, USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when userId does not own event', async () => {
    const { service } = makeService({ event: { ...event, ownerId: 'other-user' } });
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', body: 'oi', registrationIds: ['reg-1'] }, USER_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('renders template variables and enqueues per recipient', async () => {
    const { service, outbox } = makeService();
    const result = await service.send(
      { eventId: 'evt-1', channel: 'email', templateId: 'tmpl-1', registrationIds: ['reg-1'] },
      USER_ID,
    );
    expect(result.queued).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        registrationId: 'reg-1',
        templateId: 'tmpl-1',
        trigger: 'manual',
        channel: 'email',
        recipient: 'joao@test.com',
        renderedBody: 'Olá João, bem-vindo ao Tech Day!',
        renderedSubject: 'Oi João',
        dedupKey: expect.stringMatching(/^manual:evt-1:joao@test\.com:[0-9a-f]+$/),
      }),
      expect.any(Object),
    );
  });

  it('request body overrides template body', async () => {
    const { service, outbox } = makeService();
    await service.send(
      { eventId: 'evt-1', channel: 'email', templateId: 'tmpl-1', body: 'Custom para {{nome}}', registrationIds: ['reg-1'] },
      USER_ID,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ renderedBody: 'Custom para João' }),
      expect.any(Object),
    );
  });

  it('skips recipients without email on email channel', async () => {
    const { service, outbox } = makeService({
      registrations: [regJoao, { ...regJoao, id: 'reg-2', name: 'Sem', email: '' }],
    });
    const result = await service.send(
      { eventId: 'evt-1', channel: 'email', body: 'oi', registrationIds: ['reg-1', 'reg-2'] },
      USER_ID,
    );
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('skips manual recipients without phone on whatsapp channel', async () => {
    const { service, outbox } = makeService({ registrations: [] });
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'whatsapp',
        body: 'oi',
        manualRecipients: [
          { name: 'Zap', phone: '+5511888888888' },
          { name: 'SemFone', email: 'x@y.com' },
        ],
      },
      USER_ID,
    );
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: '+5511888888888', instancia: 'inst-1' }),
      expect.any(Object),
    );
  });

  it('email sends sem delay de pacing (opts.delayMs 0)', async () => {
    const { service, outbox } = makeService();
    await service.send({ eventId: 'evt-1', channel: 'email', body: 'oi', registrationIds: ['reg-1'] }, USER_ID);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email' }),
      expect.objectContaining({ delayMs: 0 }),
    );
  });

  it('whatsapp acumula delay crescente por destinatário (anti-ban jitter)', async () => {
    const { service, outbox } = makeService({
      registrations: [
        { ...regJoao, id: 'r1', phone: '+5511000000001' },
        { ...regJoao, id: 'r2', phone: '+5511000000002' },
        { ...regJoao, id: 'r3', phone: '+5511000000003' },
      ],
    });
    const result = await service.send(
      { eventId: 'evt-1', channel: 'whatsapp', body: 'oi', registrationIds: ['r1', 'r2', 'r3'] },
      USER_ID,
    );
    expect(result.queued).toBe(3);
    const delays = outbox.enqueue.mock.calls.map((c: any[]) => c[1]?.delayMs);
    expect(delays).toEqual([1000, 2000, 3000]);
  });

  it('dedups recipients by channel target across registrations and manual', async () => {
    const { service, outbox } = makeService();
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'email',
        body: 'oi',
        registrationIds: ['reg-1'],
        manualRecipients: [{ name: 'Dup', email: 'joao@test.com' }],
      },
      USER_ID,
    );
    expect(result.queued).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});

describe('ManualSendService.send — sem evento', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequest when registrationIds provided without eventId', async () => {
    const { service } = makeService();
    await expect(
      service.send({ channel: 'email', body: 'oi', registrationIds: ['reg-1'] }, USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequest when channel=whatsapp, no eventId and no instancia', async () => {
    const { service } = makeService();
    await expect(
      service.send({ channel: 'whatsapp', body: 'oi', manualRecipients: [{ name: 'A', phone: '5511999' }] }, USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('enqueues whatsapp message using instancia from body when no eventId', async () => {
    const { service, outbox } = makeService({ registrations: [] });
    const result = await service.send(
      {
        channel: 'whatsapp',
        instancia: 'instancia-avulsa',
        body: 'Olá avulso',
        manualRecipients: [{ name: 'Maria', phone: '5511777777777' }],
      },
      USER_ID,
    );
    expect(result.queued).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: undefined,
        instancia: 'instancia-avulsa',
        recipient: '5511777777777',
        channel: 'whatsapp',
      }),
      expect.any(Object),
    );
  });

  it('dedupKey usa prefixo "global" quando sem eventId', async () => {
    const { service, outbox } = makeService({ registrations: [] });
    await service.send(
      {
        channel: 'email',
        body: 'oi',
        manualRecipients: [{ name: 'Ana', email: 'ana@test.com' }],
      },
      USER_ID,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupKey: expect.stringMatching(/^manual:global:ana@test\.com:[0-9a-f]+$/),
      }),
      expect.any(Object),
    );
  });

  it('does not call eventsService.findById when no eventId', async () => {
    const { service, eventsService } = makeService({ registrations: [] });
    await service.send(
      { channel: 'email', body: 'oi', manualRecipients: [{ name: 'Ana', email: 'ana@test.com' }] },
      USER_ID,
    );
    expect(eventsService.findById).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar os testes**

```bash
npx jest tests/unit/manual-send.service.spec.ts --no-coverage
```

Expected: todos os testes passando.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/manual-send.service.spec.ts
git commit -m "test: update ManualSendService tests for optional eventId and ownership check"
```

---

### Task 5: Adicionar endpoint `POST /messaging/send` ao GlobalMessagingController

**Files:**
- Modify: `app/api/controllers/global-messaging/global-messaging.controller.ts`

- [ ] **Step 1: Adicionar endpoint `send` ao controller**

Substituir o conteúdo completo:

```typescript
import { Controller, Get, Post, Body, HttpCode, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { SendMessageDto } from '../messaging/messaging_dto/send-message.dto';

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class GlobalMessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualSend: ManualSendService,
  ) {}

  @Post('messaging/send')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enviar mensagem — eventId opcional no body' })
  @ApiResponse({ status: 202, description: 'Mensagem(ns) enfileirada(s)' })
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.manualSend.send(dto, user.id);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de todos os eventos do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de templates com evento' })
  findTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.messageTemplate.findMany({
      where: { event: { ownerId: user.id } },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('automations')
  @ApiOperation({ summary: 'Listar automações de todos os eventos do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de automações com evento e template' })
  findAutomations(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.automationRule.findMany({
      where: { event: { ownerId: user.id } },
      include: {
        event: { select: { id: true, title: true } },
        template: { select: { id: true, name: true, channel: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('messaging/logs')
  @ApiOperation({ summary: 'Listar logs de mensagens de todos os eventos do usuário' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de registros (padrão: 200)' })
  @ApiResponse({ status: 200, description: 'Lista de logs com evento' })
  findLogs(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.prisma.messageLog.findMany({
      where: { event: { ownerId: user.id } },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 200,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/controllers/global-messaging/global-messaging.controller.ts
git commit -m "feat: add POST /messaging/send endpoint to GlobalMessagingController"
```

---

### Task 6: Atualizar GlobalMessagingModule com dependências do ManualSendService

**Files:**
- Modify: `app/api/controllers/global-messaging/global-messaging.module.ts`

- [ ] **Step 1: Adicionar providers e imports necessários**

Substituir o conteúdo completo:

```typescript
import { Module } from '@nestjs/common';
import { GlobalMessagingController } from './global-messaging.controller';
import { GuardsModule } from '@api/config/guards/guards.module';
import { WorkersModule } from '@api/workers/workers.module';
import { EventsModule } from '@api/controllers/events/events.module';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';

@Module({
  imports: [GuardsModule, WorkersModule, EventsModule],
  controllers: [GlobalMessagingController],
  providers: [ManualSendService, TemplateRenderer],
})
export class GlobalMessagingModule {}
```

- [ ] **Step 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/controllers/global-messaging/global-messaging.module.ts
git commit -m "feat: wire ManualSendService dependencies into GlobalMessagingModule"
```

---

### Task 7: Remover endpoint `send` do MessagingController e limpar MessagingModule

**Files:**
- Modify: `app/api/controllers/messaging/messaging.controller.ts`
- Modify: `app/api/controllers/messaging/messaging.module.ts`

- [ ] **Step 1: Remover método `send` e imports de ManualSendService do MessagingController**

Substituir conteúdo completo de `messaging.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Param,
  UseGuards,
  Sse,
  MessageEvent,
  Query,
} from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('events/:eventId/messaging')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class MessagingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Listar logs de mensagens do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de registros (padrão: 100)' })
  @ApiResponse({ status: 200, description: 'Lista de logs' })
  async getLogs(@Param('eventId') eventId: string, @Query('limit') limit?: string) {
    return this.prisma.messageLog.findMany({
      where: { OR: [{ eventId }, { eventId: null, registration: { eventId } }] },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Sse('logs/stream')
  @ApiOperation({ summary: 'Stream SSE de logs de mensagens (polling 3s)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Server-Sent Events stream', content: { 'text/event-stream': {} } })
  streamLogs(@Param('eventId') eventId: string): Observable<MessageEvent> {
    return interval(3000).pipe(
      switchMap(() =>
        this.prisma.messageLog.findMany({
          where: { OR: [{ eventId }, { eventId: null, registration: { eventId } }] },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ),
      map((logs) => ({ data: JSON.stringify(logs) })),
    );
  }
}
```

- [ ] **Step 2: Remover ManualSendService e dependências extras do MessagingModule**

Substituir conteúdo completo de `messaging.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [MessagingController],
})
export class MessagingModule {}
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 4: Rodar todos os testes**

```bash
npx jest --no-coverage
```

Expected: todos passando.

- [ ] **Step 5: Commit**

```bash
git add app/api/controllers/messaging/messaging.controller.ts app/api/controllers/messaging/messaging.module.ts
git commit -m "refactor: remove send endpoint from MessagingController, keep logs only"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Rodar suite completa**

```bash
npx jest --no-coverage
```

Expected: todos os testes passando, zero falhas.

- [ ] **Step 2: Verificar build de produção**

```bash
npm run build
```

Expected: build sem erros.

- [ ] **Step 3: Commit final se necessário**

```bash
git add -A
git status  # deve estar limpo após commits anteriores
```
