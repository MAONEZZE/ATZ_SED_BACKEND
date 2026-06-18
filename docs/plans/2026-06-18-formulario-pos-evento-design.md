# Design — Formulário pós-evento (QR)

**Data:** 2026-06-18
**Status:** Aprovado, pronto para plano de implementação

## Problema

Coletar dados de quem ficou até o final do evento. Segundo formulário,
distinto do de inscrição, acessado por **QR code único** exibido no fim do
evento. Respostas precisam ligar ao inscrito existente para cruzar dados
inscrição × pós-evento.

## Decisões

- **Vínculo:** respostas amarradas a uma `Registration` existente.
- **Acesso:** QR único do evento (link por `slug`). Pessoa digita
  email/telefone para casar com a `Registration`.
- **Prova de presença:** ter respondido o formulário = proxy de "ficou até o
  final". Sem rastreio manual de check-in.
- **Abordagem escolhida (A):** discriminador `kind` em `FormField` +
  nova tabela `PostEventResponse`. Reusa o form-builder existente; mantém
  `Registration` limpa; permite cruzamento direto e escala para mais surveys.
  Rejeitadas: B (modelo `Form` genérico — over-engineering, mexe no caminho de
  inscrição que já funciona) e C (colunas em `Registration` — mistura concerns).

## Schema (Prisma)

```prisma
enum FormFieldKind {
  registration
  post_event
  @@schema("ATZ_SED")
}

model FormField {
  // ...campos atuais...
  kind FormFieldKind @default(registration)   // NOVO
  @@index([eventId, kind])                     // substitui @@index([eventId])
}

model PostEventResponse {                       // NOVO
  id             String   @id @default(uuid())
  eventId        String   @map("event_id")
  registrationId String   @map("registration_id")
  answers        Json
  createdAt      DateTime @default(now()) @map("created_at")
  event          Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  @@unique([registrationId])   // 1 resposta por inscrito → upsert idempotente
  @@index([eventId])
  @@map("post_event_responses")
  @@schema("ATZ_SED")
}
```

- `Event` ganha `postEventResponses PostEventResponse[]`.
- `Registration` ganha `postEventResponse PostEventResponse?`.
- Migração segura: `FormField` existentes assumem `kind = registration` (default).

## Endpoints

### Admin (reusa CRUD de form-fields existente)
- `GET events/:eventId/form-fields` ganha filtro `?kind=registration|post_event`.
- `CreateFormFieldDto` ganha campo `kind` (default `registration`).
- Dono monta as perguntas pós-evento pelo mesmo builder. Nenhum controller novo.

### Público (fluxo QR)
- `GET /public/events/:slug/post-event-fields` → campos `kind=post_event`.
  Só se evento `published` ou `ended`.
- `POST /public/events/:slug/post-event`
  ```jsonc
  { "identifier": "email-ou-telefone", "answers": { "Pergunta": "resp", ... } }
  ```
  → acha `Registration` do evento por email **ou** telefone → upsert
  `PostEventResponse`.

### Ajustes em endpoints existentes
- `GET /public/events/:slug/form-fields` passa a filtrar `kind=registration`
  (hoje retorna todos os campos — ajuste de 1 linha).
- Export CSV de registrations idem: não vaza campos `post_event`.

## Lógica do serviço

`RegistrationsService.submitPostEvent(slug, identifier, answers)`:

1. `findBySlug` → exige status `published` ou `ended`, senão `400`.
2. Normaliza `identifier`: contém `@` → email; senão → phone (só dígitos).
3. Acha `Registration` do evento por `email` OU `phone` normalizado (primeira match).
4. Não achou → `404 "Inscrição não encontrada"`.
5. Carrega `formFields` com `kind=post_event`; valida `required` (mesmo laço de
   `updateAnswers`).
6. `upsert PostEventResponse` por `registrationId` (sobrescreve).

Controller público novo: `PublicPostEventController`. `PostEventResponse`
acessado via `PrismaService` (ou repo espelhando o padrão de registration).

## Edge cases

| Caso | Resposta |
|---|---|
| Inscrição não existe | 404 |
| Campo obrigatório vazio | 400 `Campo obrigatório ausente: "X"` |
| Evento `draft`/`cancelled` | 400 |
| Reenvio (já respondeu) | 200 upsert (idempotente) |
| Telefone duplicado em 2 inscrições | pega a primeira (raro) |

## Fora do escopo (YAGNI)

- Entrega do QR/link via automação `after_event` (trigger já existe).
- Dashboard de presença / métricas.
- Múltiplos surveys por evento (schema já suporta evoluir).
- Evento `post_event.submitted` para automações futuras.
