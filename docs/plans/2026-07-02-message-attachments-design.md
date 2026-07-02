# Design — Upload de anexo no envio de mensagem

**Data:** 2026-07-02
**Branch:** feat/limpeza_profunda
**Status:** Aprovado

## Contexto

Hoje `POST /messages` (`GlobalMessagingController.send` → `ManualSendService.send`)
recebe apenas JSON (`SendMessageDto`). Não há campo de anexo/arquivo. O único
anexo gerado é o `.ics` do convite, criado pelo backend — não recebido.

Pipeline de envio é **assíncrono e atrasado** (BullMQ; WhatsApp em batches com
delay de horas). Portanto o arquivo precisa ser persistido em storage antes do
envio; o worker busca a URL na hora do dispatch. Isso é imposto pela arquitetura.

### Infra já existente (reuso)
- **Multer + Supabase Storage**: `POST /events/:id/cover`, `POST /profile/me/photo`
  já usam `FileInterceptor` + `ParseFilePipe` + `SupabaseStorageAdapter`
  (`StoragePort.upload` → `{ url, path }`).
- **Email (Resend)**: `ResendAdapter.sendEmail` já manda attachment (`.ics`).
  Resend aceita `attachments: [{ filename, path: url }]` — URL hospedada direto.
- **WhatsApp (Evolution)**: `EvolutionAdapter` só tem `sendText`. Precisa de novo
  `sendMedia`.

## Decisões (brainstorming)
- **Canais:** ambos (email + WhatsApp).
- **Formato:** endpoint de upload separado (send continua JSON).
- **Quantidade:** múltiplos anexos por mensagem.
- **Limites:** 25MB por anexo, tipos comuns (image/document/video/audio).

## Fluxo geral (2 passos, canal-agnóstico)

```
1. POST /messages/attachments  (multipart)
     → sobe Supabase → { path, filename, mimetype, size }
2. POST /messages (JSON)  attachments:[{ path, filename, mimetype }]
     → outbox → worker → adapter
```

## Componentes

### 1. Endpoint upload — `POST /messages/attachments`
- `@UseGuards(JwtAuthGuard)`, `FileInterceptor('file')`, `@ApiConsumes('multipart/form-data')`.
- `ParseFilePipe`:
  - `MaxFileSizeValidator` 25MB.
  - `FileTypeValidator` regex: `image/(jpeg|png|webp|gif)`,
    `application/pdf`, `application/msword`,
    `application/vnd.openxmlformats-officedocument.*`,
    `application/vnd.ms-excel`, `application/vnd.ms-powerpoint`,
    `video/mp4`, `audio/(mpeg|ogg)`.
- Sobe pro bucket **`message-attachments`** (público), path `${userId}/${uuid}-${filename}`.
- Retorna `{ path, filename, mimetype, size }`. **Não** retorna URL crua — o client
  referencia por `path`.

### 2. Send DTO (`SendMessageDto`)
- Novo campo `attachments?: AttachmentRefDto[]`, com `{ path, filename, mimetype }`,
  `@ValidateNested({ each: true })`.
- **Segurança:** worker reconstrói a URL pública server-side via storage; não confia
  em URL vinda do client → evita SSRF. Adicionar `getPublicUrl(bucket, path)` ao
  `StoragePort` (+ adapter).

### 3. Persistência
- Coluna nova `OutboxMessage.attachments Json?` (array de `{ path, filename, mimetype }`).
- Migração **aditiva** via `prisma db execute` + `migrate resolve` (workflow de drift
  do Supabase — nunca `migrate dev`/`reset`).
- `OutboxService.enqueue` e o port carregam `attachments`.

### 4. Worker dispatch (`MessageDispatchWorker`)
- **Email:** `ResendAdapter.sendEmail` estende assinatura p/ receber
  `attachments: [{ filename, url }]`, mapeando p/ `path` do Resend. Merge com o `.ics`.
- **WhatsApp:** novo `EvolutionAdapter.sendMedia(instancia, to, url, mediatype, mimetype, fileName, caption?)`
  → `POST /message/sendMedia/{instance}` `{ number, mediatype, mimetype, media: url, fileName, caption }`.
  Ordem: envia texto (parts atuais) e depois cada mídia como mensagem separada.
- **Idempotência de retry:** hoje `sentParts` rastreia partes de texto. Adicionar
  `sentAttachments` (counter) para não duplicar mídia em reenvio.

### 5. Bucket
- Criar `message-attachments` no Supabase (público) — passo manual/config.

## Data flow

```
client --(multipart file)--> POST /messages/attachments
                                  └─ SupabaseStorageAdapter.upload → path
client <-- { path, filename, mimetype, size }

client --(JSON + attachments[])--> POST /messages
                                       └─ ManualSendService.send
                                            └─ OutboxService.enqueue (attachments no row + job)
BullMQ delay ...
worker --> MessageDispatchWorker.process
             ├─ storage.getPublicUrl(path) → url
             ├─ email: Resend.sendEmail(..., attachments:[{filename,url}])
             └─ whatsapp: text parts → Evolution.sendMedia(...) por anexo
```

## Error handling
- Upload: `ParseFilePipe` rejeita size/type (400).
- Send: `ValidateNested` rejeita attachment malformado (400).
- Dispatch: falha de adapter marca `OutboxMessage.status='failed'` + `MessageLog`
  (comportamento atual). Retry respeita `sentParts`/`sentAttachments`.

## Testes
- **unit:** ManualSend passa attachments→outbox; `Evolution.sendMedia` payload;
  `Resend` attachments mapping.
- **worker:** dispara mídia após texto; idempotente em retry (`sentParts` +
  `sentAttachments`).
- **e2e:** upload valida size/type; send com attachments enfileira.

## Fora de escopo (YAGNI)
- Retenção/limpeza de anexos órfãos (subiu mas nunca enviou).
