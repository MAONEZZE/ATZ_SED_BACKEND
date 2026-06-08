# Design: Envio de Mensagens sem Evento Obrigatório

**Data:** 2026-06-08
**Status:** Aprovado

## Contexto

Atualmente todo disparo de mensagem exige `eventId` via path param (`POST /events/:eventId/messaging/send`). O requisito é permitir disparos avulsos — sem vínculo com evento — onde o frontend envia destinatários e mensagem diretamente.

## Decisão

Migrar para `POST /messaging/send` com `eventId` opcional no body (Opção B). Endpoint antigo removido.

## Endpoint

**Removido:** `POST /events/:eventId/messaging/send`

**Novo:** `POST /messaging/send`
- Controller: `GlobalMessagingController` (`app/api/controllers/global-messaging/`)
- Guards: `JwtAuthGuard` apenas
- Ownership validado no service quando `eventId` presente

## DTO — SendMessageDto

```typescript
{
  eventId?: string;           // opcional — vincula ao evento
  instancia?: string;         // obrigatório se channel=whatsapp e sem eventId
  channel: 'whatsapp' | 'email';
  templateId?: string;        // deve pertencer ao eventId se informado
  subject?: string;
  body?: string;              // obrigatório se sem templateId
  registrationIds?: string[]; // só válido se eventId presente
  manualRecipients?: ManualRecipientDto[];
}
```

**Validações de negócio (no service):**
- `channel === 'whatsapp'` + sem `eventId` + sem `instancia` → `BadRequestException`
- `registrationIds` presente + sem `eventId` → `BadRequestException`
- Ao menos um destinatário (`registrationIds` ou `manualRecipients`) → `BadRequestException`
- Se `templateId` presente: template deve pertencer ao `eventId` (se informado) ou ser global

## ManualSendService

**Nova assinatura:**
```typescript
send(input: SendMessageInput, userId: string): Promise<SendMessageResult>
```

**Fluxo com `eventId`:**
1. Busca evento no BD
2. Valida `event.ownerId === userId` → `ForbiddenException` se falhar
3. `instancia` = `event.evolutionInstance`
4. Resolve `registrationIds` do BD (scoped ao evento)

**Fluxo sem `eventId`:**
1. `instancia` = `input.instancia`
2. `registrationIds` não permitido (já validado no service entry)
3. Apenas `manualRecipients`

**dedupKey sem evento:**
```
manual:global:{target}:{sha1_do_body_renderizado}
```

## Domain Port — EnqueueMessageData

```typescript
// antes
eventId: string;

// depois
eventId?: string;
```

## Camadas sem alteração

| Camada | Motivo |
|--------|--------|
| `OutboxService` | Passa `eventId` como-está |
| `MessageDispatchWorker` | Já lida com `outbox.eventId ?? null` |
| `EvolutionAdapter` | Sem mudança de contrato |
| `ResendAdapter` | Sem mudança de contrato |
| Schema Prisma | `OutboxMessage.eventId` já é `String?` |

## Impacto no Frontend

- Trocar chamada de `POST /events/:eventId/messaging/send` para `POST /messaging/send`
- Mover `eventId` para o body (opcional)
- Incluir `instancia` no body quando não houver evento (WhatsApp)

## Fluxo de Dados

```
POST /messaging/send
  { eventId?, instancia?, channel, body, manualRecipients }
        │
        ▼
GlobalMessagingController.send(dto, currentUser)
        │
        ▼
ManualSendService.send(input, userId)
  ├── com eventId: busca evento, valida ownership, instancia = event.evolutionInstance
  └── sem eventId: instancia = input.instancia
        │
        ▼ (por destinatário)
OutboxService.enqueue({ eventId?, instancia, channel, recipient, renderedBody, ... })
        │
        ├── INSERT OutboxMessage (eventId nullable)
        └── BullMQ job com delay (anti-ban WhatsApp)
                │
                ▼
        MessageDispatchWorker
          ├── whatsapp → EvolutionAdapter.sendWhatsApp(instancia, recipient, body)
          └── email    → ResendAdapter.sendEmail(recipient, subject, body)
                │
                ▼
        UPDATE OutboxMessage (sent/failed)
        INSERT MessageLog (eventId nullable)
```
