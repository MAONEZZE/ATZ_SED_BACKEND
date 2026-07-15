# SED API — Contratos de Endpoints (para o Frontend)

Base URL: `http://localhost:<PORT>` (sem prefixo global). Swagger em `/docs` (apenas `ENVIROMENT=dev`).

## ⚠️ Breaking Changes (refatoração `feat/limpeza_profunda`)

Mudanças de contrato que o frontend precisa adaptar. Rotas antigas **deixam de existir**.

| # | Antes | Depois |
|---|---|---|
| 1 | `GET/POST/DELETE /events/:id/collaborators[...]` (param `:id`) | `.../events/:eventId/collaborators[...]` (param `:eventId`) |
| 2 | `POST /events/:id/cancel` (body `{notifyParticipants}`) | `PATCH /events/:id/status` com body `{ "status": "cancelled", "notifyParticipants": true }` |
| 3 | `POST /messaging/send` | `POST /messages` |
| 4 | `POST /profile/ensure` | `POST /profile` (upsert idempotente) |
| 5 | `GET /events/:eventId/registrations/export` | `GET /events/:eventId/registrations?format=csv` |
| 5 | `GET /events/:eventId/post-event-responses/export` | `GET /events/:eventId/post-event-responses?format=csv` |
| 5 | `GET /events/:eventId/user-subscriptions/export` | `GET /events/:eventId/user-subscriptions?format=csv` |
| 6 | `GET /events/:eventId/messaging/logs` | `GET /events/:eventId/message-logs` |
| 6 | `GET /events/:eventId/messaging/logs/stream` (SSE) | `GET /events/:eventId/message-logs/stream` (SSE) |
| 7 | `GET /public/events/:slug/post-event-fields` | `GET /public/events/:slug/post-event/form-fields` |
| 8 | `GET /public/events/:slug/nps-fields` | `GET /public/events/:slug/nps/form-fields` |
| 9 | `POST /public/events/:slug/nps` | `POST /public/events/:slug/nps/responses` |
| 10 | `POST /public/events/:slug/post-event` | `POST /public/events/:slug/post-event/responses` |

Rotas globais agregadas mantidas: `GET /templates`, `GET /templates/:id`, `POST/PATCH/DELETE /templates[...]`, `GET /automations` (todos os eventos do usuário), `GET /messaging/logs` (agregado global — distinto do escopado por evento acima).

Também corrigidos neste doc os enums `FunnelStatus` e `AutomationTrigger`, que estavam desatualizados (valores removidos pela migration `reduce_funnel_and_triggers`).

## Convenções gerais

- **Auth**: todas as rotas (exceto `/public/*`) exigem header `Authorization: Bearer <supabase_jwt>`.
- **Ownership**: rotas com `:eventId`/`:id` de evento validam que o evento pertence ao usuário logado (403 caso contrário).
- **Validação**: `ValidationPipe` com `whitelist + forbidNonWhitelisted` — campos extras no body retornam **400**.
- **CORS**: métodos permitidos `GET, POST, PATCH, DELETE`; headers `Content-Type, Authorization, x-request-id`.
- **Formato de erro (padrão para tudo)**:

```json
{
  "statusCode": 404,
  "message": "Event not found",
  "requestId": "<x-request-id se enviado>",
  "timestamp": "2026-06-05T12:00:00.000Z"
}
```

- **Datas**: enviadas como ISO 8601 string (`"2026-07-01T19:00:00.000Z"`), retornadas igualmente.

### Enums

| Enum | Valores |
|---|---|
| `EventStatus` | `draft`, `published`, `cancelled`, `ended` |
| `FunnelStatus` | `pending`, `approved`, `rejected` |
| `FieldType` | `text`, `textarea`, `email`, `phone`, `select`, `multiselect`, `checkbox`, `image`, `date` |
| `MessageChannel` | `whatsapp`, `email` |
| `AutomationTrigger` | `on_registration`, `on_post_event`, `on_nps`, `on_approval`, `on_rejection`, `before_event`, `after_event`, `after_approval` |

### Objetos de retorno (shapes principais)

**Event**
```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "title": "string",
  "slug": "string",
  "description": "string | null",
  "coverUrl": "string | null",
  "location": "string | null",
  "capacity": 100,
  "dressCode": "string | null",
  "groupLink": "string | null",
  "eventDate": "ISO | null",
  "endDate": "ISO | null",
  "postRegistrationMessage": "string | null",
  "status": "draft | published | cancelled | ended",
  "evolutionInstance": "string | null",
  "evolutionToken": "string | null",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

**FormField**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "label": "string",
  "type": "FieldType",
  "required": true,
  "options": "json | null",
  "order": 0,
  "isFixed": false,
  "createdAt": "ISO"
}
```

**Registration**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "status": "FunnelStatus",
  "answers": { "<label do campo>": "valor" },
  "name": "string",
  "email": "string",
  "phone": "string",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

**MessageTemplate**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "name": "string",
  "channel": "whatsapp | email",
  "subject": "string | null",
  "body": "string",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

**AutomationRule**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "templateId": "uuid",
  "trigger": "AutomationTrigger",
  "delayMinutes": 30,
  "active": true,
  "createdAt": "ISO",
  "template": { "id": "uuid", "name": "string", "channel": "whatsapp | email" }
}
```

**MessageLog**
```json
{
  "id": "uuid",
  "registrationId": "uuid | null",
  "channel": "whatsapp | email",
  "recipient": "string",
  "body": "string",
  "status": "string",
  "errorMessage": "string | null",
  "sentAt": "ISO | null",
  "createdAt": "ISO"
}
```

**LandingPage**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "sections": [
    {
      "id": "uuid",
      "landingPageId": "uuid",
      "type": "string",
      "order": 0,
      "enabled": false,
      "content": "json | null",
      "createdAt": "ISO",
      "updatedAt": "ISO"
    }
  ]
}
```

**Profile**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "string",
  "email": "string",
  "photoUrl": "string | null",
  "evolutionInstance": "string | null",
  "evolutionToken": "string | null",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

---

## 1. Profile — `/profile` (auth)

### GET `/profile/me`
- Retorno: **200** `Profile`. **404** se perfil não existir.

### PATCH `/profile/me`
- Body (todos opcionais):
```json
{ "name": "string (min 2)", "evolutionInstance": "string", "evolutionToken": "string" }
```
- Retorno: **200** `Profile`.

### POST `/profile/ensure`
- Body: nenhum.
- Retorno: **201** `Profile` — cria perfil se não existir, senão retorna o existente. Chamar após primeiro login.

### POST `/profile/me/photo`
- Body: `multipart/form-data`, campo `file` (jpeg/png/webp, máx 5MB).
- Salva em `ATZ_SED/profile-photo/<profileId>/photo` (bucket Supabase).
- Retorno: **201** `Profile` atualizado com `photoUrl`. **400** se arquivo inválido. **404** se perfil não existir.

### DELETE `/profile/me/photo`
- Body: nenhum.
- Retorno: **200** `Profile` com `photoUrl: null`.

---

## 2. Events — `/events` (auth + ownership)

### POST `/events`
- Body:
```json
{
  "title": "string (min 3, obrigatório)",
  "description": "string?",
  "location": "string?",
  "capacity": "int >= 1 ?",
  "dressCode": "string?",
  "groupLink": "string?",
  "eventDate": "ISO date string?",
  "endDate": "ISO date string?",
  "postRegistrationMessage": "string?"
}
```
- Retorno: **201** `Event` (status inicial `draft`, slug gerado automaticamente).

### GET `/events`
- Retorno: **200** `Event[]` (somente do usuário logado).

### GET `/events/:id`
- Retorno: **200** `Event`. **404** / **403**.

### PATCH `/events/:id`
- Body: todos os campos do POST opcionais, mais:
```json
{ "evolutionInstance": "string?", "evolutionToken": "string?" }
```
- Retorno: **200** `Event`.

### PATCH `/events/:id/status`
- Body:
```json
{ "status": "draft | published | cancelled | ended" }
```
- Retorno: **200** `Event`.

### POST `/events/:id/cover`
- Body: `multipart/form-data`, campo `file` (jpeg/png/webp, máx 5MB).
- Retorno: **201** `Event` atualizado com `coverUrl`. **400** se arquivo inválido.

### DELETE `/events/:id/cover`
- Retorno: **200** `Event` com `coverUrl: null`.

### DELETE `/events/:id`
- Retorno: **204** sem corpo.

### POST `/events/:id/cancel`
- Body:
```json
{ "notifyParticipants": true }
```
- Retorno: **201** `Event` com status `cancelled`. **400** se transição inválida (ex.: já `ended`).
- Se `notifyParticipants: true`, dispara mensagens aos inscritos.

### POST `/events/:id/duplicate`
- Body: nenhum.
- Retorno: **201** `Event` novo (cópia com form fields e templates, slug novo, status `draft`).

---

## 3. Form Fields — `/events/:eventId/form-fields` (auth + ownership)

### GET `/events/:eventId/form-fields`
- Retorno: **200** `FormField[]` ordenado por `order` asc.

### POST `/events/:eventId/form-fields`
- Body:
```json
{
  "label": "string (obrigatório)",
  "type": "FieldType (obrigatório)",
  "required": "boolean? (default true)",
  "options": "json? (ex.: [\"opção A\", \"opção B\"] para select)",
  "order": "int >= 0 ? (default 99)"
}
```
- Retorno: **201** `FormField` (`isFixed` sempre `false` para campos criados via API).

### PATCH `/events/:eventId/form-fields/:id`
- Body (todos opcionais — `type` **não** pode ser alterado):
```json
{ "label": "string", "required": true, "options": "json", "order": 1 }
```
- Retorno: **200** `FormField`. **404** se não pertencer ao evento.

### DELETE `/events/:eventId/form-fields/:id`
- Retorno: **204**. **400** se campo for `isFixed` (campos fixos: nome/email/telefone não podem ser apagados).

---

## 4. Registrations — `/events/:eventId/registrations` (auth + ownership)

### GET `/events/:eventId/registrations`
- Query (opcionais): `?status=<FunnelStatus>&search=<texto>` (search em name/email/phone).
- Retorno: **200** `Registration[]`.

### GET `/events/:eventId/registrations/export`
- Query: mesmos filtros `status`/`search`.
- Retorno: **200** arquivo CSV (`Content-Type: text/csv`, `Content-Disposition: attachment`). Colunas fixas + colunas dos form fields customizados.

### GET `/events/:eventId/registrations/:id`
- Retorno: **200** `Registration`. **404**.

### PATCH `/events/:eventId/registrations/:id/status`
- Body:
```json
{ "status": "pending | screening | qualification | approved | rejected | waitlist" }
```
- Retorno: **200** `Registration`. Dispara automações vinculadas ao novo status.

---

## 5. Templates — `/events/:eventId/templates` (auth + ownership)

### GET `/events/:eventId/templates`
- Query opcional: `?include=automation` — anexa `automation` (objeto ou `null`) em cada template:
```json
{ "...template", "automation": { "id": "uuid", "trigger": "...", "delayMinutes": 0, "active": true } }
```
- Retorno: **200** `MessageTemplate[]`.

### GET `/events/:eventId/templates/:id`
- Retorno: **200** `MessageTemplate`. **404**.

### POST `/events/:eventId/templates`
- Body:
```json
{
  "name": "string (obrigatório)",
  "channel": "whatsapp | email (obrigatório)",
  "subject": "string? (usado em email)",
  "body": "string (obrigatório, aceita variáveis {{nome}} etc.)"
}
```
- Retorno: **201** `MessageTemplate`.

### PATCH `/events/:eventId/templates/:id`
- Body: todos os campos do POST opcionais.
- Retorno: **200** `MessageTemplate`. **404**.

### DELETE `/events/:eventId/templates/:id`
- Retorno: **204**. **404**.

---

## 6. Automations — `/events/:eventId/automations` (auth + ownership)

### GET `/events/:eventId/automations`
- Retorno: **200** `AutomationRule[]` (cada uma com `template: {id, name, channel}`).

### GET `/events/:eventId/automations/:id`
- Retorno: **200** `AutomationRule` com `template` completo. **404**.

### POST `/events/:eventId/automations`
- Body:
```json
{
  "templateId": "uuid (obrigatório, template do mesmo evento)",
  "trigger": "AutomationTrigger (obrigatório)",
  "delayMinutes": "int >= 0 ?",
  "active": "boolean? (default true)"
}
```
- Retorno: **201** `AutomationRule`. **404** se template não pertencer ao evento.

### PATCH `/events/:eventId/automations/:id`
- Body: todos opcionais (mesmos campos do POST).
- Retorno: **200** `AutomationRule`.

### DELETE `/events/:eventId/automations/:id`
- Retorno: **204**. **404**.

---

## 7. Messaging — `/events/:eventId/messaging` (auth + ownership)

### POST `/events/:eventId/messaging/send`
- Envio manual. Body:
```json
{
  "channel": "whatsapp | email (obrigatório)",
  "templateId": "uuid? (se omitido, usar subject/body)",
  "subject": "string? (email sem template)",
  "body": "string? (obrigatório se sem template)",
  "registrationIds": ["uuid"],
  "manualRecipients": [{ "name": "string", "email": "string?", "phone": "string?" }]
}
```
- Retorno: **202**
```json
{ "queued": 5, "skipped": 1, "skippedReason": ["fulano: sem telefone"] }
```

### GET `/events/:eventId/messaging/logs`
- Query opcional: `?limit=<n>` (default 100).
- Retorno: **200** `MessageLog[]` (mais recentes primeiro).

### GET `/events/:eventId/messaging/logs/stream` (SSE)
- `EventSource`/SSE. Emite a cada 3s:
```
data: [ ...últimos 20 MessageLog em JSON... ]
```
- Frontend: `new EventSource(url)` — atenção: EventSource nativo não envia header Authorization; usar fetch-event-source ou similar com Bearer token.

---

## 8. AI — `/ai` (auth)

### POST `/ai/email-style`
- Body:
```json
{ "content": "string (min 10 chars)" }
```
- Retorno: **200**
```json
{
  "professional": "string (html/texto reescrito)",
  "minimalist": "string",
  "elegant": "string",
  "warm": "string"
}
```

### POST `/ai/landing-chat` (SSE via POST)
- Body:
```json
{ "message": "string (obrigatório)", "landing": "<estado atual da landing, json livre>" }
```
- Retorno: stream `text/event-stream`:
```
data: {"chunk": "texto parcial..."}
data: {"chunk": "mais texto..."}
data: {"error": "mensagem"}      <- somente em falha
data: [DONE]                      <- sempre ao final
```
- Frontend: usar `fetch` com leitura de stream (POST + SSE não funciona com EventSource nativo).

---

## 9. Público (sem auth) — `/public/events`

### GET `/public/events/:slug`
- Retorno: **200** evento publicado:
```json
{
  "id", "title", "slug", "description", "coverUrl", "location",
  "capacity", "dressCode", "eventDate", "endDate",
  "postRegistrationMessage", "status",
  "landingPage": { "...": "...", "sections": ["somente enabled, ordenadas"] }
}
```
- **404** se não existir ou não estiver `published`.

### GET `/public/events/:slug/form-fields`
- Retorno: **200**
```json
[{ "id", "label", "type", "required", "options", "order" }]
```
- **404** se evento não publicado.

### POST `/public/events/:slug/registrations`
- Body: objeto livre com respostas do formulário, chaveado pelo **label** de cada campo (`GET /public/events/:slug/form-fields`). O casamento chave↔label é tolerante a diferença de maiúscula/minúscula e espaços nas pontas (ex.: label `"Nome"` casa com chave `"nome"` ou `" NOME "`).
- Extração dos campos fixos (nome/email/telefone para o registro) também é tolerante a maiúscula/minúscula, tentando as chaves `nome`/`name`, `email`, `telefone`/`phone` nessa ordem contra as respostas enviadas:
```json
{
  "nome": "Fulano",
  "email": "fulano@x.com",
  "telefone": "+5511999999999",
  "Qual sua empresa?": "ACME"
}
```
- Retorno: **201** `Registration` (status `pending`).
- **400** se evento não estiver `published` ou faltar campo obrigatório (validado contra o **label** configurado, não contra as chaves fixas acima).

---

## Resumo rápido

| Método | Rota | Auth | Retorno |
|---|---|---|---|
| GET | `/profile/me` | ✅ | Profile |
| PATCH | `/profile/me` | ✅ | Profile |
| POST | `/profile/ensure` | ✅ | Profile |
| POST | `/profile/me/photo` | ✅ | Profile (multipart `file`) |
| DELETE | `/profile/me/photo` | ✅ | Profile |
| POST | `/events` | ✅ | Event |
| GET | `/events` | ✅ | Event[] |
| GET | `/events/:id` | ✅ | Event |
| PATCH | `/events/:id` | ✅ | Event |
| PATCH | `/events/:id/status` | ✅ | Event |
| POST | `/events/:id/cover` | ✅ | Event (multipart `file`) |
| DELETE | `/events/:id/cover` | ✅ | Event |
| DELETE | `/events/:id` | ✅ | 204 |
| POST | `/events/:id/cancel` | ✅ | Event |
| POST | `/events/:id/duplicate` | ✅ | Event |
| GET | `/events/:eventId/form-fields` | ✅ | FormField[] |
| POST | `/events/:eventId/form-fields` | ✅ | FormField |
| PATCH | `/events/:eventId/form-fields/:id` | ✅ | FormField |
| DELETE | `/events/:eventId/form-fields/:id` | ✅ | 204 |
| GET | `/events/:eventId/registrations` | ✅ | Registration[] |
| GET | `/events/:eventId/registrations/export` | ✅ | CSV |
| GET | `/events/:eventId/registrations/:id` | ✅ | Registration |
| PATCH | `/events/:eventId/registrations/:id/status` | ✅ | Registration |
| GET | `/events/:eventId/templates` | ✅ | MessageTemplate[] |
| GET | `/events/:eventId/templates/:id` | ✅ | MessageTemplate |
| POST | `/events/:eventId/templates` | ✅ | MessageTemplate |
| PATCH | `/events/:eventId/templates/:id` | ✅ | MessageTemplate |
| DELETE | `/events/:eventId/templates/:id` | ✅ | 204 |
| GET | `/events/:eventId/automations` | ✅ | AutomationRule[] |
| GET | `/events/:eventId/automations/:id` | ✅ | AutomationRule |
| POST | `/events/:eventId/automations` | ✅ | AutomationRule |
| PATCH | `/events/:eventId/automations/:id` | ✅ | AutomationRule |
| DELETE | `/events/:eventId/automations/:id` | ✅ | 204 |
| POST | `/events/:eventId/messaging/send` | ✅ | 202 {queued, skipped, skippedReason} |
| GET | `/events/:eventId/messaging/logs` | ✅ | MessageLog[] |
| GET | `/events/:eventId/messaging/logs/stream` | ✅ | SSE MessageLog[] |
| POST | `/ai/email-style` | ✅ | {professional, minimalist, elegant, warm} |
| POST | `/ai/landing-chat` | ✅ | SSE chunks |
| GET | `/public/events/:slug` | ❌ | Evento público + landing |
| GET | `/public/events/:slug/form-fields` | ❌ | FormField[] público |
| POST | `/public/events/:slug/registrations` | ❌ | Registration |
