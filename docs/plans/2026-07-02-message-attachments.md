# Message Attachments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir anexar arquivos (múltiplos) no envio de mensagem, entregues por email (Resend) e WhatsApp (Evolution).

**Architecture:** Upload desacoplado do envio. `POST /messages/attachments` sobe o arquivo pro Supabase Storage e devolve um `path`. `POST /messages` recebe `attachments:[{path,filename,mimetype}]`; o `ManualSendService` resolve cada `path` numa URL pública server-side (evita SSRF) e persiste `{url,filename,mimetype}` na coluna `OutboxMessage.attachments`. O worker consome a URL: email → Resend `attachments[{filename,path:url}]`; WhatsApp → novo `EvolutionAdapter.sendMedia` (1 mídia por mensagem, após o texto). Idempotência de retry via novo contador `sentAttachments`.

**Tech Stack:** NestJS, Prisma (Supabase Postgres, schema `ATZ_SED`), BullMQ, `@nestjs/platform-express` (multer memory storage), Supabase Storage, Resend, Evolution API. Testes: Jest + ts-jest.

**Convenções do repo (não quebrar):**
- Código em `app/` (não `src/`). Aliases: `@modules/*`, `@infra/*`, `@shared/*`, `@workers/*`.
- Controller NUNCA toca Prisma direto (arquitetura híbrida). Vai via service.
- Migração Prisma: **NUNCA** `migrate dev`/`reset` (Supabase real, drift). Aplicar SQL aditivo via `prisma db execute` + `prisma migrate resolve --applied`. Seguir o workflow registrado.
- Storage já existe: bucket `SUPABASE_STORAGE_BUCKET` (default `ATZ_SED`), padrão folder-dentro-do-bucket (ver `profile.service.ts` / `events.service.ts`). **Não** precisa criar bucket novo.
- Rodar UM teste: `npx jest tests/unit_test/messaging/<arquivo>.spec.ts -t "<nome>"`.
- Build: `npx tsc --noEmit`. Suite: `npm test`.

---

## Task 1: Tipos de anexo (DTO + port)

**Files:**
- Modify: `app/modules/messaging/dto/send-message.dto.ts`
- Modify: `app/modules/messaging/ports/outbox-repository.port.ts`

**Step 1: Escrever teste de validação do DTO**

Create: `tests/unit_test/messaging/send-message-dto.spec.ts`

```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendMessageDto } from '@modules/messaging/dto/send-message.dto';

describe('SendMessageDto attachments', () => {
  it('accepts a well-formed attachment array', async () => {
    const dto = plainToInstance(SendMessageDto, {
      channel: 'email',
      body: 'oi',
      manualRecipients: [{ name: 'X', email: 'x@y.com' }],
      attachments: [{ path: 'message-attachments/u1/abc-file.pdf', filename: 'file.pdf', mimetype: 'application/pdf' }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an attachment missing path', async () => {
    const dto = plainToInstance(SendMessageDto, {
      channel: 'email',
      body: 'oi',
      attachments: [{ filename: 'file.pdf', mimetype: 'application/pdf' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Rodar teste — deve falhar**

Run: `npx jest tests/unit_test/messaging/send-message-dto.spec.ts`
Expected: FAIL (campo `attachments` inexistente / sem validação nested).

**Step 3: Implementar `AttachmentRefDto` + campo no DTO**

Em `send-message.dto.ts`, adicionar antes de `SendMessageDto`:

```typescript
export class AttachmentRefDto {
  @ApiProperty({ example: 'message-attachments/uuid-user/uuid-arquivo.pdf', description: 'path retornado por POST /messages/attachments' })
  @IsString()
  path!: string;

  @ApiProperty({ example: 'contrato.pdf' })
  @IsString()
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  mimetype!: string;
}
```

Adicionar campo ao final de `SendMessageDto` (antes do `}`):

```typescript
  @ApiPropertyOptional({ type: [AttachmentRefDto], description: 'Anexos previamente enviados via POST /messages/attachments.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
```

**Step 4: Adicionar tipos ao port**

Em `app/modules/messaging/ports/outbox-repository.port.ts`, adicionar após `InviteConfigInput`:

```typescript
export interface OutboxAttachment {
  /** URL pública resolvida server-side (não vem do client). */
  url: string;
  filename: string;
  mimetype: string;
}
```

E acrescentar em `EnqueueMessageData` (após `inviteConfig?`):

```typescript
  attachments?: OutboxAttachment[];
```

**Step 5: Rodar teste — deve passar**

Run: `npx jest tests/unit_test/messaging/send-message-dto.spec.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add app/modules/messaging/dto/send-message.dto.ts app/modules/messaging/ports/outbox-repository.port.ts tests/unit_test/messaging/send-message-dto.spec.ts
git commit -m "feat(messaging): tipos de anexo no send DTO e outbox port"
```

---

## Task 2: `StoragePort.getPublicUrl`

**Files:**
- Modify: `app/infra/storage/storage.port.ts`
- Modify: `app/infra/storage/supabase-storage.adapter.ts`
- Test: `tests/unit_test/shared/supabase-storage.adapter.spec.ts` (criar)

**Step 1: Teste do adapter**

```typescript
import { SupabaseStorageAdapter } from '@infra/storage/supabase-storage.adapter';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      }),
    },
  }),
}));

describe('SupabaseStorageAdapter.getPublicUrl', () => {
  it('builds a public url from bucket + path', () => {
    const cfg = { get: (k: string) => (k === 'SUPABASE_URL' ? 'https://x' : 'key') };
    const adapter = new SupabaseStorageAdapter(cfg as any);
    expect(adapter.getPublicUrl('ATZ_SED', 'message-attachments/u1/f.pdf')).toBe(
      'https://cdn.test/message-attachments/u1/f.pdf',
    );
  });
});
```

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/shared/supabase-storage.adapter.spec.ts`
Expected: FAIL (`getPublicUrl` não existe).

**Step 3: Implementar**

Em `storage.port.ts`, adicionar à interface `StoragePort`:

```typescript
  getPublicUrl(bucket: string, path: string): string;
```

Em `supabase-storage.adapter.ts`, adicionar método:

```typescript
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
```

**Step 4: Rodar — passa**

Run: `npx jest tests/unit_test/shared/supabase-storage.adapter.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/infra/storage/storage.port.ts app/infra/storage/supabase-storage.adapter.ts tests/unit_test/shared/supabase-storage.adapter.spec.ts
git commit -m "feat(storage): getPublicUrl no StoragePort/Supabase adapter"
```

---

## Task 3: Migração Prisma — `attachments` + `sent_attachments`

**Files:**
- Modify: `app/infra/prisma/schema.prisma` (model `OutboxMessage`, ~linha 284)
- Create: `app/infra/prisma/migrations/<timestamp>_message_attachments/migration.sql`

**Step 1: Editar schema**

No model `OutboxMessage`, após `sentParts ... @map("sent_parts")` (linha 300), adicionar:

```prisma
  attachments     Json?          @map("attachments")
  sentAttachments Int            @default(0) @map("sent_attachments")
```

**Step 2: Criar arquivo de migração**

Path (use timestamp real, ex. `20260702120000_message_attachments`):
`app/infra/prisma/migrations/20260702120000_message_attachments/migration.sql`

```sql
ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD COLUMN IF NOT EXISTS "attachments" JSONB,
  ADD COLUMN IF NOT EXISTS "sent_attachments" INTEGER NOT NULL DEFAULT 0;
```

**Step 3: Aplicar sem drift (workflow Supabase — NÃO usar migrate dev)**

```bash
npx prisma db execute \
  --schema app/infra/prisma/schema.prisma \
  --file app/infra/prisma/migrations/20260702120000_message_attachments/migration.sql
npx prisma migrate resolve --applied 20260702120000_message_attachments --schema app/infra/prisma/schema.prisma
npx prisma generate --schema app/infra/prisma/schema.prisma
```

Expected: `db execute` sem erro; `migrate resolve` marca aplicada; `generate` regenera o client com `attachments`/`sentAttachments`.

> Se algum comando exigir credencial/rede indisponível, PARE e reporte — não rode `migrate dev`/`reset`.

**Step 4: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem erros (client tipado com os campos novos).

**Step 5: Commit**

```bash
git add app/infra/prisma/schema.prisma app/infra/prisma/migrations/20260702120000_message_attachments/
git commit -m "feat(db): OutboxMessage.attachments + sent_attachments (migracao aditiva)"
```

---

## Task 4: Persistir `attachments` no outbox repository

**Files:**
- Modify: `app/modules/messaging/prisma-outbox.repository.ts:14-44`
- Test: `tests/unit_test/messaging/outbox-attachments.spec.ts` (criar)

**Step 1: Teste**

```typescript
import { PrismaOutboxRepository } from '@modules/messaging/prisma-outbox.repository';

describe('PrismaOutboxRepository.enqueue attachments', () => {
  it('persists attachments as JSON', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'o1' });
    const prisma = { outboxMessage: { create } };
    const repo = new PrismaOutboxRepository(prisma as any);
    await repo.enqueue({
      trigger: 'manual', channel: 'email', recipient: 'x@y.com',
      renderedBody: 'oi', dedupKey: 'k1',
      attachments: [{ url: 'https://cdn/f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' }],
    } as any);
    expect(create.mock.calls[0][0].data.attachments).toEqual([
      { url: 'https://cdn/f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' },
    ]);
  });

  it('writes JsonNull when no attachments', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'o1' });
    const repo = new PrismaOutboxRepository({ outboxMessage: { create } } as any);
    await repo.enqueue({ trigger: 'manual', channel: 'email', recipient: 'x', renderedBody: 'oi', dedupKey: 'k2' } as any);
    // Prisma.JsonNull, não undefined
    expect(create.mock.calls[0][0].data.attachments).toBeDefined();
  });
});
```

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/messaging/outbox-attachments.spec.ts`
Expected: FAIL (`attachments` não é gravado).

**Step 3: Implementar**

Em `prisma-outbox.repository.ts`, dentro do `try` do `enqueue`, trocar o destructuring e o `data`:

```typescript
      const { inviteConfig, attachments, ...rest } = data;
      const row = await this.prisma.outboxMessage.create({
        data: {
          ...rest,
          status: 'pending',
          inviteConfig: inviteConfig
            ? (inviteConfig as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          attachments: attachments?.length
            ? (attachments as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        select: { id: true },
      });
```

**Step 4: Rodar — passa**

Run: `npx jest tests/unit_test/messaging/outbox-attachments.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/modules/messaging/prisma-outbox.repository.ts tests/unit_test/messaging/outbox-attachments.spec.ts
git commit -m "feat(messaging): persiste attachments no outbox"
```

---

## Task 5: `ManualSendService` resolve paths → URLs e propaga

**Files:**
- Modify: `app/modules/messaging/manual-send.service.ts`
- Modify: `app/modules/messaging/global-messaging.module.ts` (importar `StorageModule`)
- Test: `tests/unit_test/messaging/manual-send.service.spec.ts` (adicionar casos + ajustar `makeService`)

**Step 1: Ajustar helper do teste e adicionar casos**

No `makeService` do spec, injetar um storage fake e config com bucket/folder. Trocar a construção do service:

```typescript
  const storage = { getPublicUrl: jest.fn((_b: string, p: string) => `https://cdn/${p}`), upload: jest.fn(), delete: jest.fn() };
  const cfg: Record<string, unknown> = {
    ...pacing,
    SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
    SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: 'message-attachments',
  };
  const config = { get: jest.fn((key: string) => cfg[key]) };
  const service = new ManualSendService(
    prisma as any, eventsService as any, outbox as any,
    new TemplateRenderer(), config as any, storage as any,
  );
  return { service, prisma, eventsService, outbox, storage };
```

Adicionar testes:

```typescript
  it('resolves attachment path to public url and forwards to outbox', async () => {
    const { service, outbox } = makeService();
    await service.send({
      eventId: 'evt-1', channel: 'email', body: 'oi', registrationIds: ['reg-1'],
      attachments: [{ path: 'message-attachments/user-1/abc-f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' }],
    }, 'user-1');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ url: 'https://cdn/message-attachments/user-1/abc-f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' }],
      }),
      expect.any(Object),
    );
  });

  it('rejects attachment path not owned by the sender', async () => {
    const { service } = makeService();
    await expect(service.send({
      eventId: 'evt-1', channel: 'email', body: 'oi', registrationIds: ['reg-1'],
      attachments: [{ path: 'message-attachments/OTHER-user/x.pdf', filename: 'x.pdf', mimetype: 'application/pdf' }],
    }, 'user-1')).rejects.toThrow(BadRequestException);
  });
```

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/messaging/manual-send.service.spec.ts`
Expected: FAIL (ctor não aceita storage / attachments não propagado).

**Step 3: Implementar**

Em `manual-send.service.ts`:

(a) imports:
```typescript
import { STORAGE_PORT, StoragePort } from '@infra/storage/storage.port';
import type { InviteConfigInput, OutboxAttachment } from '@modules/messaging/ports/outbox-repository.port';
```

(b) `SendMessageInput`: adicionar
```typescript
  attachments?: { path: string; filename: string; mimetype: string }[];
```

(c) ctor: adicionar parâmetro
```typescript
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
```
(e importar `Inject` de `@nestjs/common`).

(d) No início de `send`, após as validações de invite (~linha 72), resolver anexos:
```typescript
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const attachmentFolder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ?? 'message-attachments';
    let resolvedAttachments: OutboxAttachment[] | undefined;
    if (input.attachments?.length) {
      const prefix = `${attachmentFolder}/${userId}/`;
      resolvedAttachments = input.attachments.map((a) => {
        if (!a.path.startsWith(prefix)) {
          throw new BadRequestException('Attachment path does not belong to the sender');
        }
        return { url: this.storage.getPublicUrl(bucket, a.path), filename: a.filename, mimetype: a.mimetype };
      });
    }
```

(e) No objeto passado a `this.outbox.enqueue(...)` (dentro do loop), adicionar:
```typescript
            attachments: resolvedAttachments,
```

**Step 4: Wire do módulo**

Em `global-messaging.module.ts`: importar e adicionar `StorageModule` ao `imports`:
```typescript
import { StorageModule } from '@infra/storage/storage.module';
// ...
  imports: [GuardsModule, WorkersModule, EventsModule, MessagingDbModule, AutomationsDbModule, StorageModule],
```

**Step 5: Rodar — passa (e suite messaging inteira)**

Run: `npx jest tests/unit_test/messaging/manual-send.service.spec.ts`
Expected: PASS (todos os casos antigos + novos).

**Step 6: Commit**

```bash
git add app/modules/messaging/manual-send.service.ts app/modules/messaging/global-messaging.module.ts tests/unit_test/messaging/manual-send.service.spec.ts
git commit -m "feat(messaging): resolve anexo path->url e valida ownership"
```

---

## Task 6: Endpoint `POST /messages/attachments`

**Files:**
- Create: `app/modules/messaging/message-attachments.service.ts`
- Modify: `app/modules/messaging/global-messaging.controller.ts`
- Modify: `app/modules/messaging/global-messaging.module.ts` (provider)
- Test: `tests/unit_test/messaging/message-attachments.service.spec.ts` (criar)

**Step 1: Teste do service**

```typescript
import { MessageAttachmentsService } from '@modules/messaging/message-attachments.service';

describe('MessageAttachmentsService.upload', () => {
  it('uploads under {folder}/{userId}/ and returns metadata', async () => {
    const upload = jest.fn().mockResolvedValue({ url: 'https://cdn/x', path: 'p' });
    const storage = { upload, delete: jest.fn(), getPublicUrl: jest.fn() };
    const cfg: Record<string, string> = {
      SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
      SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: 'message-attachments',
    };
    const svc = new MessageAttachmentsService(storage as any, { get: (k: string) => cfg[k] } as any);
    const res = await svc.upload('user-1', { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'contrato.pdf', size: 1 } as any);
    const [bucket, path] = upload.mock.calls[0];
    expect(bucket).toBe('ATZ_SED');
    expect(path).toMatch(/^message-attachments\/user-1\/[0-9a-f-]+-contrato\.pdf$/);
    expect(res).toEqual(expect.objectContaining({ path, filename: 'contrato.pdf', mimetype: 'application/pdf' }));
  });
});
```

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/messaging/message-attachments.service.spec.ts`
Expected: FAIL (service inexistente).

**Step 3: Implementar service**

Create `app/modules/messaging/message-attachments.service.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { STORAGE_PORT, StoragePort } from '@infra/storage/storage.port';

export interface UploadedAttachment {
  path: string;
  filename: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class MessageAttachmentsService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  async upload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<UploadedAttachment> {
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ?? 'message-attachments';
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    const path = `${folder}/${userId}/${randomUUID()}-${safeName}`;
    await this.storage.upload(bucket, path, file.buffer, file.mimetype);
    return { path, filename: file.originalname, mimetype: file.mimetype, size: file.size };
  }
}
```

**Step 4: Rodar — passa**

Run: `npx jest tests/unit_test/messaging/message-attachments.service.spec.ts`
Expected: PASS

**Step 5: Endpoint no controller**

Em `global-messaging.controller.ts`:

Imports (adicionar aos existentes de `@nestjs/common`): `UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator`. Adicionar `import { FileInterceptor } from '@nestjs/platform-express';`. Adicionar `ApiConsumes, ApiBody` aos imports de `@nestjs/swagger`. Injetar `MessageAttachmentsService` no ctor.

Adicionar método (após `send`):

```typescript
  @Post('messages/attachments')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload de anexo para envio de mensagem' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, description: 'Anexo enviado; use o path no POST /messages' })
  uploadAttachment(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /(image\/(jpeg|png|webp|gif))|(application\/pdf)|(application\/msword)|(application\/vnd\.openxmlformats-officedocument\.[\w.-]+)|(application\/vnd\.ms-(excel|powerpoint))|(video\/mp4)|(audio\/(mpeg|ogg))/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.upload(user.id, file);
  }
```

**Step 6: Provider no módulo**

Em `global-messaging.module.ts`, adicionar `MessageAttachmentsService` ao `providers` e importar. (StorageModule já foi importado na Task 5.)

**Step 7: Build + teste**

Run: `npx tsc --noEmit && npx jest tests/unit_test/messaging/message-attachments.service.spec.ts`
Expected: sem erros; PASS.

**Step 8: Commit**

```bash
git add app/modules/messaging/message-attachments.service.ts app/modules/messaging/global-messaging.controller.ts app/modules/messaging/global-messaging.module.ts tests/unit_test/messaging/message-attachments.service.spec.ts
git commit -m "feat(messaging): endpoint POST /messages/attachments"
```

---

## Task 7: `ResendAdapter.sendEmail` com anexos

**Files:**
- Modify: `app/infra/integrations/resend.adapter.ts`
- Test: `tests/unit_test/messaging/resend.adapter.spec.ts` (criar)

**Step 1: Teste**

```typescript
const send = jest.fn().mockResolvedValue({ error: null });
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send } })) }));
import { ResendAdapter } from '@infra/integrations/resend.adapter';

describe('ResendAdapter.sendEmail attachments', () => {
  beforeEach(() => jest.clearAllMocks());
  const cfg = { get: (k: string) => (k === 'RESEND_FROM_EMAIL' ? 'from@x.com' : 'key') };

  it('maps user attachments to Resend path field alongside ics', async () => {
    const adapter = new ResendAdapter(cfg as any);
    await adapter.sendEmail('to@x.com', 'sub', '<p>hi</p>', 'ICSDATA', [
      { filename: 'contrato.pdf', url: 'https://cdn/contrato.pdf' },
    ]);
    const arg = send.mock.calls[0][0];
    expect(arg.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filename: 'contrato.pdf', path: 'https://cdn/contrato.pdf' }),
        expect.objectContaining({ filename: 'evento.ics' }),
      ]),
    );
  });
});
```

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/messaging/resend.adapter.spec.ts`
Expected: FAIL (assinatura sem 5º parâmetro).

**Step 3: Implementar**

Em `resend.adapter.ts`, trocar a assinatura e o array:

```typescript
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    icsContent?: string,
    attachments?: { filename: string; url: string }[],
  ): Promise<void> {
    const files: Array<{ filename: string; content?: string; path?: string }> = [];
    if (icsContent) {
      files.push({ filename: 'evento.ics', content: Buffer.from(icsContent).toString('base64') });
    }
    for (const a of attachments ?? []) {
      files.push({ filename: a.filename, path: a.url });
    }

    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      html,
      attachments: files,
    });

    if (error) {
      this.logger.error({ error, to }, 'Resend failed');
      throw new Error(`Resend error: ${error.message}`);
    }
  }
```

**Step 4: Rodar — passa**

Run: `npx jest tests/unit_test/messaging/resend.adapter.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/infra/integrations/resend.adapter.ts tests/unit_test/messaging/resend.adapter.spec.ts
git commit -m "feat(integrations): anexos arbitrarios no ResendAdapter.sendEmail"
```

---

## Task 8: `EvolutionAdapter.sendMedia`

**Files:**
- Modify: `app/infra/integrations/evolution.adapter.ts`
- Test: `tests/unit_test/messaging/evolution-adapter-media.spec.ts` (criar)

**Step 1: Teste**

```typescript
import { EvolutionAdapter } from '@infra/integrations/evolution.adapter';

function cfg() {
  const b: Record<string, unknown> = { EVOLUTION_API_URL: 'https://evo', EVOLUTION_API_KEY: 'k' };
  return { get: (k: string) => b[k] };
}

describe('EvolutionAdapter.sendMedia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /message/sendMedia/{instance} with mediatype/mimetype/media/fileName', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn() });
    (global as any).fetch = fetchFn;
    const adapter = new EvolutionAdapter(cfg() as any);
    await adapter.sendMedia('inst-1', '+5511', 'https://cdn/f.pdf', 'document', 'application/pdf', 'f.pdf', 'legenda');
    expect(fetchFn.mock.calls[0][0]).toBe('https://evo/message/sendMedia/inst-1');
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toEqual(expect.objectContaining({
      number: '+5511', mediatype: 'document', mimetype: 'application/pdf',
      media: 'https://cdn/f.pdf', fileName: 'f.pdf', caption: 'legenda',
    }));
  });

  it('throws on non-ok response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const adapter = new EvolutionAdapter(cfg() as any);
    await expect(adapter.sendMedia('i', '+55', 'u', 'image', 'image/png', 'a.png')).rejects.toThrow('Evolution API error');
  });
});
```

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/messaging/evolution-adapter-media.spec.ts`
Expected: FAIL.

**Step 3: Implementar**

Em `evolution.adapter.ts`, adicionar método (após `sendPart`):

```typescript
  async sendMedia(
    instancia: string,
    to: string,
    mediaUrl: string,
    mediatype: 'image' | 'video' | 'audio' | 'document',
    mimetype: string,
    fileName: string,
    caption?: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/message/sendMedia/${instancia}`;
    const payload: Record<string, unknown> = { number: to, mediatype, mimetype, media: mediaUrl, fileName };
    if (caption) payload.caption = caption;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.apiKey },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({ instancia, status: response.status, error: errorText }, 'Evolution API sendMedia error');
      throw new Error(`Evolution API error (${response.status}): ${errorText}`);
    }
  }
```

**Step 4: Rodar — passa**

Run: `npx jest tests/unit_test/messaging/evolution-adapter-media.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/infra/integrations/evolution.adapter.ts tests/unit_test/messaging/evolution-adapter-media.spec.ts
git commit -m "feat(integrations): EvolutionAdapter.sendMedia"
```

---

## Task 9: Worker dispara anexos (email + whatsapp) com idempotência

**Files:**
- Modify: `app/workers/message-dispatch.worker.ts`
- Test: `tests/unit_test/messaging/message-dispatch.worker.spec.ts` (adicionar casos)

**Step 1: Teste (2 casos)**

Adicionar ao spec do worker (mockar `resend.sendEmail`, `evolution.sendWhatsApp`, `evolution.sendMedia`, e `prisma.outboxMessage.findUnique/update`, `messageLog.create`):

```typescript
  it('email: passa anexos resolvidos para o Resend', async () => {
    // outbox com channel 'email', attachments preenchido, sentParts/sentAttachments 0
    // ... montar mocks conforme o helper existente do arquivo ...
    // expect(resend.sendEmail).toHaveBeenCalledWith(
    //   expect.any(String), expect.any(String), expect.any(String), undefined,
    //   [{ filename: 'f.pdf', url: 'https://cdn/f.pdf' }],
    // );
  });

  it('whatsapp: envia texto e depois cada mídia; retoma de sentAttachments', async () => {
    // outbox whatsapp, attachments com 2 itens, sentAttachments = 1
    // expect(evolution.sendMedia).toHaveBeenCalledTimes(1) — só o item índice 1
    // expect(prisma.outboxMessage.update).toHaveBeenCalledWith(
    //   expect.objectContaining({ data: { sentAttachments: 2 } }) — ou equivalente
    // );
  });
```

> Seguir a estrutura de mocks já usada no arquivo. Se o helper existente não expõe `attachments`/`sentAttachments`, estender o objeto `outbox` fake com esses campos.

**Step 2: Rodar — falha**

Run: `npx jest tests/unit_test/messaging/message-dispatch.worker.spec.ts`
Expected: FAIL nos casos novos.

**Step 3: Implementar no worker**

(a) Import do tipo:
```typescript
import type { InviteConfigInput, OutboxAttachment } from '@modules/messaging/ports/outbox-repository.port';
```

(b) No bloco `email` (após montar `body`/`icsContent`, antes de `sendEmail`), montar anexos e passar:
```typescript
        const emailAttachments = ((outbox.attachments as OutboxAttachment[] | null) ?? []).map((a) => ({
          filename: a.filename,
          url: a.url,
        }));

        await this.resend.sendEmail(
          outbox.recipient,
          outbox.renderedSubject ?? 'Mensagem do evento',
          body,
          icsContent,
          emailAttachments.length ? emailAttachments : undefined,
        );
```

(c) No bloco `else` (whatsapp), após o `sendWhatsApp` (texto), adicionar envio de mídia com retomada:
```typescript
        const attachments = (outbox.attachments as OutboxAttachment[] | null) ?? [];
        for (let i = outbox.sentAttachments; i < attachments.length; i++) {
          const a = attachments[i];
          await this.evolution.sendMedia(
            instancia,
            outbox.recipient,
            a.url,
            this.mediaTypeOf(a.mimetype),
            a.mimetype,
            a.filename,
          );
          await this.prisma.outboxMessage.update({
            where: { id: outbox.id },
            data: { sentAttachments: i + 1 },
          });
        }
```

(d) Helper privado:
```typescript
  private mediaTypeOf(mimetype: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }
```

> `outbox` vem de `prisma.outboxMessage.findUnique/findFirst` — já traz `attachments` e `sentAttachments` após a Task 3. Sem mudança de query necessária.

**Step 4: Rodar — passa (spec do worker inteiro)**

Run: `npx jest tests/unit_test/messaging/message-dispatch.worker.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/workers/message-dispatch.worker.ts tests/unit_test/messaging/message-dispatch.worker.spec.ts
git commit -m "feat(worker): dispara anexos email/whatsapp com idempotencia (sentAttachments)"
```

---

## Task 10: Env var opcional + verificação final

**Files:**
- Modify: `app/shared/config/env.validation.ts`
- Modify: `.env.example` (se existir)

**Step 1: Adicionar env opcional**

Em `env.validation.ts` (schema zod), adicionar:
```typescript
  SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: z.string().optional(),
```
(Opcional — código tem default `message-attachments`. Não quebra fixtures.)

Se houver `.env.example`, documentar a var.

**Step 2: Build + suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: build limpo; TODA a suite verde (nenhum teste antigo quebrado — atenção especial a `manual-send.service.spec.ts` e `message-dispatch.worker.spec.ts`).

**Step 3: Verificação manual do fluxo (verification-before-completion)**

Conferir manualmente (ou via e2e se houver harness): 
1. `POST /messages/attachments` com PDF válido → 201 `{path,...}`.
2. `POST /messages/attachments` com arquivo >25MB ou tipo proibido → 400/413.
3. `POST /messages` com `attachments:[{path}]` de outro usuário → 400.
4. `POST /messages` válido → 202; conferir row `outbox_messages.attachments` populada.

> Envio real por Resend/Evolution depende de credenciais + bucket público. Se indisponível no ambiente, reportar como não-verificado (não afirmar "funciona").

**Step 4: Commit**

```bash
git add app/shared/config/env.validation.ts .env.example
git commit -m "chore(env): SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS opcional"
```

---

## Notas / Riscos
- **Bucket público:** anexos ficam em URL pública (mesmo bucket de capas/fotos). Se sigilo for requisito, trocar por signed URL — fora de escopo agora.
- **Anexos órfãos:** upload sem envio subsequente não é limpo. YAGNI por ora (registrado no design).
- **WhatsApp:** cada anexo = 1 mensagem separada, enviada após o texto. Sem legenda por padrão (parâmetro `caption` existe no adapter mas não é preenchido pelo worker — decisão futura).
- **Retry:** `sentParts` (texto) + `sentAttachments` (mídia) evitam duplicação. Email é atômico (Resend 1 chamada), sem contador.
