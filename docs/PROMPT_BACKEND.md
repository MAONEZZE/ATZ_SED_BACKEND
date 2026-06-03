# SED — Prompt de Desenvolvimento do BACKEND (NestJS)

> Prompt de referência para construir o backend da plataforma **SED — Save Event Date**.
> Use este documento como especificação para um agente de código ou como roadmap de implementação.

---

## 0. Contexto do produto

O SED é um SaaS de gestão de eventos curados: organizadores criam eventos, montam formulários de inscrição dinâmicos e landing pages públicas, recebem inscritos e os conduzem por um funil (`pending → screening → qualification → approved / rejected / waitlist`). Em cada etapa, automações disparam mensagens por **WhatsApp** (via Evolution API) e **e-mail** (via Resend).

O backend é responsável por **toda a lógica de negócio**, incluindo o envio das mensagens — WhatsApp (via Evolution API) e e-mail (via Resend) saem diretamente do worker, a partir da outbox, sem throttling nem delays. O Supabase é usado **somente como banco de dados (PostgreSQL) e provedor de autenticação** — nada de Edge Functions, nada de `pg_cron`, nada de RLS como camada de segurança.

---

## 1. Princípios de arquitetura (NÃO NEGOCIÁVEIS)

1. **Independência do Supabase.** O objetivo é poder trocar o Supabase por um PostgreSQL próprio no futuro com o mínimo de atrito. Portanto:
   - Acesso a dados **exclusivamente via ORM (Prisma)** usando a connection string do PostgreSQL. **Nunca** usar `@supabase/supabase-js` para CRUD de dados.
   - **Autorização vive no NestJS** (Guards + checagem de propriedade), **não em RLS**. Como o Prisma acessa o banco com a conexão de serviço, a RLS é ignorada de qualquer forma — logo, a segurança PRECISA estar na aplicação.
   - **Auth como port do domínio.** O `domain` define `AuthPort`; a implementação `SupabaseAuthAdapter` vive no `database`. Trocar de provedor (auth próprio, Keycloak, Clerk...) = trocar o adapter, sem tocar em `services`/`domain`.
   - **Storage como port do domínio.** O `domain` define `StoragePort`; implementação inicial `SupabaseStorageAdapter`; futura: S3/R2 — troca de adapter.
   - **Migrations geridas pelo Prisma Migrate**, não pelas migrations do Supabase. O schema precisa ser portátil.
   - **Sem dependência de Supabase Realtime.** Atualizações em tempo real (ex.: logs de mensagem) saem do próprio backend via SSE/WebSocket ou polling.

2. **Outbox como fonte da verdade das mensagens.** Toda mensagem a enviar é uma linha durável no banco (tabela `outbox_messages`), com status e chave de deduplicação única. O envio externo é um passo separado, retentável e auditável.

3. **Fila e agendamento no backend.** BullMQ + Redis para filas e jobs. O agendamento (`before_event` / `after_event`) substitui o `pg_cron` por jobs repetíveis do BullMQ. Nada de cron no banco.

4. **Envio direto pelo worker, sem delays.** Tanto e-mail (Resend) quanto WhatsApp (Evolution API) são enviados diretamente pelo worker do backend, consumindo a outbox. Sem delays aleatórios, sem throttling anti-bloqueio e sem serialização por instância — as mensagens vão assim que a fila as processa.

5. **Idempotência.** A constraint única `dedup_key = (registration_id, template_id, trigger)` impede envio duplicado mesmo sob reexecução/retry.

---

## 2. Stack

- **Runtime/Framework:** Node.js 20 LTS + NestJS 10 + TypeScript (strict).
- **ORM:** Prisma (PostgreSQL provider).
- **Banco:** PostgreSQL 15 (hoje hospedado no Supabase; amanhã, qualquer Postgres).
- **Fila/Jobs:** BullMQ + Redis.
- **Validação:** `class-validator` + `class-transformer` (DTOs) e/ou Zod.
- **Auth:** Supabase Auth (validação de JWT no backend) atrás de interface própria.
- **Integrações:** Evolution API (WhatsApp), Resend (e-mail), Google Gemini 2.5 Flash (IA), Google Calendar/ICS.
- **Observabilidade:** logger estruturado (pino), health checks, métricas.
- **Testes:** Jest (unit) + Supertest (e2e).
- **Infra local:** Docker Compose (PostgreSQL + Redis) para desenvolvimento offline do Supabase.

---

## 3. Arquitetura e estrutura do projeto

**Arquitetura:** camadas (Clean / Layered Architecture) + módulos por domínio. São **4 camadas** dentro de `app/`, cada uma subdividida pelos **mesmos módulos de domínio**. Regra de ouro: *feature nova = o mesmo módulo replicado nas 4 camadas*.

**Fluxo de dependência:** `api → services → domain ← database`
O `domain` é o centro e não depende de ninguém. `services` dependem do `domain` (entidades + ports/interfaces). `database` depende do `domain` (implementa os ports de repositório). `api` depende dos `services`. Nenhuma camada interna conhece o Nest/Prisma — o framework vive nas bordas (`api` e `database`).

```
backend/
├── app/
│   ├── api/                         # CAMADA DE ENTRADA HTTP
│   │   ├── controllers/
│   │   │   ├── events/
│   │   │   │   ├── events_routes/   # controllers Nest (definição das rotas) do módulo
│   │   │   │   └── events_dto/      # contratos de request/response (class-validator/Zod)
│   │   │   ├── registrations/
│   │   │   │   ├── registrations_routes/
│   │   │   │   └── registrations_dto/
│   │   │   └── ...                  # um por módulo (users, landing, templates, automations, messaging, ai)
│   │   └── config/                  # módulos Nest (wiring/DI), middlewares, guards, interceptors, exception handlers
│   │
│   ├── services/                    # CAMADA DE REGRAS DE NEGÓCIO (casos de uso)
│   │   ├── events/                  # orquestra os casos de uso do módulo (depende só de domain)
│   │   ├── registrations/
│   │   ├── automations/
│   │   ├── messaging/
│   │   └── ...
│   │
│   ├── domain/                      # CAMADA DE DOMÍNIO (puro, sem framework)
│   │   ├── events/                  # entidades, value objects, regras puras
│   │   │   ├── entities/
│   │   │   └── ports/               # interfaces: repositórios + adaptadores (Auth, Storage, Channel, AI)
│   │   ├── registrations/
│   │   ├── messaging/               # ex.: OutboxRepositoryPort, MessageChannelPort
│   │   └── ...
│   │
│   └── database/                    # CAMADA DE PERSISTÊNCIA (adaptadores de saída)
│       ├── prisma/                  # PrismaService + schema.prisma (schema ATZ_SED)
│       ├── migrations/
│       ├── events/                  # repositórios que IMPLEMENTAM os ports do domain
│       ├── registrations/
│       └── ...
│
├── tests/
│   ├── unit/
│   └── integration/
├── scripts/                         # utilitários, tarefas operacionais
├── plans/                           # planos de features
└── logs/
```

**Onde ficam as integrações externas e a fila** (Evolution, Resend, Gemini, Calendar, Supabase Auth/Storage, Redis/BullMQ): são **adaptadores de infraestrutura que implementam ports definidos no `domain`** (ex.: `MessageChannelPort` → `EvolutionAdapter`/`ResendAdapter`; `AuthPort` → `SupabaseAuthAdapter`; `StoragePort` → `SupabaseStorageAdapter`; `AiPort` → `GeminiAdapter`). Como sua estrutura nomeia 4 camadas e o `database` é a camada de saída/infra, encaixei esses adaptadores ali (em subpastas por responsabilidade, ex.: `database/integrations/`, `database/auth/`, `database/storage/`, `database/queue/`). **Se você preferir uma 5ª camada `infrastructure/` dedicada só para adaptadores externos**, é uma troca de uma linha — me avise. Os **workers do BullMQ** são pontos de entrada não-HTTP; podem viver em `app/api/workers/` (entrada) ou junto da fila em `database/queue/` — escolha uma e mantenha.

> **Nest com `app/` em vez de `src/`:** basta apontar `sourceRoot` no `nest-cli.json` e o `rootDir`/paths no `tsconfig.json` para `app/`. O Nest não exige a pasta `src`.

---

## 4. Roadmap de implementação

> Cada fase é entregável e testável de forma independente. Não avance sem que a anterior esteja com testes verdes.

### Implementação 1 — Fundação do projeto
**Objetivo:** projeto NestJS de pé na arquitetura em camadas, configuração e infra local funcionando.
- Inicializar NestJS + TypeScript strict + ESLint/Prettier, com `sourceRoot = app/` (nest-cli.json + tsconfig paths).
- Criar o esqueleto das **4 camadas** (`app/api`, `app/services`, `app/domain`, `app/database`) e das pastas de raiz (`tests/unit`, `tests/integration`, `scripts/`, `plans/`, `logs/`). Configurar lint para **proibir importações que violem o fluxo** `api → services → domain ← database` (ex.: regra de boundaries do ESLint).
- `config/` (em `app/api/config`): validação das variáveis de ambiente (Zod/Joi): `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`/JWKS, `GEMINI_API_KEY`, etc.; middlewares; `ValidationPipe` global; exception handlers (filtro global).
- **Docker Compose** local: PostgreSQL + Redis.
- `PrismaService` em `app/database/prisma`, conectando via `DATABASE_URL` (pgbouncer) + `DIRECT_URL` (migrations).
- Health check (`/health`) checando DB e Redis.
- Logger estruturado (pino) em `logs/`.
- **Entregável:** `GET /health` retorna 200; esqueleto das 4 camadas criado; lint barra dependência cruzada indevida.

### Implementação 2 — Autenticação e autorização
**Objetivo:** identidade e permissões 100% controladas pelo backend, com Supabase Auth como provedor trocável.
- Port `AuthPort` no `domain` (métodos: `verifyToken(jwt)`, `getUser(id)`); adapter `SupabaseAuthAdapter` no `database` que valida o JWT do Supabase (via JWKS/secret).
- `JwtAuthGuard` que injeta o usuário autenticado no request.
- **RBAC** próprio: enum de papéis (`admin` | `organizer`), `RolesGuard` + decorator `@Roles()`.
- `OwnershipGuard` genérico: garante que o organizador só acessa recursos dos próprios eventos (substitui a RLS de "organizer").
- Migrar a lógica do trigger `handle_new_user`: no primeiro login/registro, criar `profile` + role `organizer` (idempotente).
- **Entregável:** endpoints protegidos rejeitam sem token; organizer não acessa evento alheio; admin tem leitura ampla.

### Implementação 3 — Modelo de dados (Prisma + schema `ATZ_SED`)
**Objetivo:** schema portátil, versionado por migrations, **todas as tabelas no schema `ATZ_SED` do Supabase**.
- Configurar o datasource do Prisma para o schema customizado (case-sensitive, precisa de aspas no Postgres):
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
    schemas   = ["ATZ_SED"]
  }
  generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["multiSchema"]
  }
  ```
- Cada model leva `@@schema("ATZ_SED")`. Garantir que o schema exista (a migration cria via `CREATE SCHEMA IF NOT EXISTS "ATZ_SED"`, ou criá-lo manualmente no Supabase antes do primeiro `migrate`). Como o acesso é via Prisma (Postgres direto), **não** é preciso expor o schema na API REST do Supabase.
- Models Prisma (em `app/database/prisma/schema.prisma`): `profiles`, `user_roles`, `events`, `form_fields`, `registrations`, `message_templates`, `automation_rules`, `message_logs`, `landing_pages`, `landing_sections`, e a **nova** `outbox_messages`.
- **Separação domínio × persistência:** os models Prisma são detalhe de persistência (camada `database`). As **entidades de negócio puras** vivem em `app/domain/<módulo>/entities` e são mapeadas de/para os models nos repositórios. `services` nunca importam o Prisma Client.
- Enums (status de evento, status do funil, canal, trigger, status da outbox) — todos no schema `ATZ_SED`.
- Constraint única na `outbox_messages`: `@@unique([registrationId, templateId, trigger])`.
- Índices para consultas quentes (eventos por owner, inscrições por evento/status, outbox por instancia+status).
- Seed de desenvolvimento (em `scripts/`).
- **Entregável:** `prisma migrate dev` cria todas as tabelas dentro do schema `ATZ_SED`; seed popula dados de teste.

### Implementação 4 — Eventos, formulário e landing (CRUD)
**Objetivo:** organizador cria e gerencia eventos.
- CRUD de `events` com geração de slug único (`titulo-XXXXXX`) e regras de status (`draft/published/cancelled/ended`).
- Ao criar evento: criar campos fixos do formulário (nome, phone, email, address — não deletáveis) e, **em código** (substituindo o trigger do banco), criar a `landing_page` com as 10 seções (hero, about, registration habilitadas por padrão).
- CRUD de `form_fields` (com proteção dos campos fixos) e de `landing_sections`.
- Upload de capa via `StoragePort` (bucket `event-covers`).
- Regras de evento cancelado (edição readonly).
- **Entregável:** ciclo completo criar → editar → publicar → cancelar de um evento.

### Implementação 5 — Inscrições e funil
**Objetivo:** receber inscrições públicas e mover pelo funil.
- Endpoint **público** de inscrição (`POST /public/events/:slug/registrations`): valida contra os `form_fields`, grava `registration` com status `pending`, respostas em JSONB.
- Upload de inscrição (campos tipo `image`) via `StoragePort` (bucket `registration-uploads`).
- Endpoints de mudança de status (transições do funil) com validação das transições permitidas.
- Cada transição **emite um evento de domínio** (ex.: `RegistrationStatusChanged`) que o motor de automações escuta (fase 8).
- **Entregável:** inscrição pública cria registro; organizador move status; eventos de domínio são emitidos.

### Implementação 6 — Outbox + fila (BullMQ)
**Objetivo:** infraestrutura durável de mensagens (o coração da robustez).
- Tabela `outbox_messages` (id, registration_id, instancia, telefone/email, canal, mensagem renderizada, status `pending|processing|sent|failed`, dedup_key UNIQUE, attempts, error, timestamps).
- Serviço `OutboxService.enqueue(...)`: cria a linha de forma idempotente (respeita a constraint).
- Fila BullMQ `message-dispatch` com: retry com backoff exponencial e dead-letter.
- Reclaim de mensagens presas em `processing` há mais de X minutos (volta para `pending`).
- **Entregável:** enfileirar a mesma mensagem duas vezes não duplica; falha externa é retentada; mensagem morta vai para dead-letter.

### Implementação 7 — Canais de envio
**Objetivo:** entregar e-mail e WhatsApp diretamente pelo worker, a partir da outbox.

**Worker de disparo (`message-dispatch`):** consome a outbox e, para cada mensagem, chama o provider do canal correspondente, atualiza o status (`sent`/`failed`) e grava `message_logs`.

**E-mail (Resend):**
- `ResendProvider` envia o HTML renderizado. No trigger `on_approval`, anexar ICS + botão "Adicionar à Agenda" (Google Calendar).

**WhatsApp (Evolution API):**
- `EvolutionProvider` envia a mensagem renderizada usando as credenciais da `instancia` (do `profile` ou sobrescritas por evento).
- Tratar erros da Evolution (instância desconectada, número inválido) como `failed` com motivo, para retry/dead-letter.
- **Entregável:** e-mail e WhatsApp reais enviados a partir da outbox; falhas refletidas no status; nunca duplica (constraint) nem perde (reclaim de `processing`).

### Implementação 8 — Motor de automações + agendamento
**Objetivo:** disparar mensagens nas etapas certas, substituindo `pg_cron`.
- Engine que escuta eventos de domínio e dispara `automation_rules` ativas para o trigger correspondente: `on_registration` (janela < 10 min), `on_screening`, `on_qualification`, `on_approval` (gera ICS), `on_rejection`, `on_waitlist`, `after_approval`.
- Resolução de variáveis de template (case-insensitive): `{{nome}}`, `{{email}}`, `{{telefone}}`, `{{evento}}`, `{{data}}`, `{{local}}`, `{{capacidade}}`, `{{dress_code}}`, `{{link_grupo}}`, `{{video_url}}`, `{{testimonial_url}}`, `{{backstage_url}}`, `{{invite}}`. **Renderização sempre no backend** → mensagem final vai pronta para a outbox.
- Cada disparo passa pelo `OutboxService.enqueue` (dedup garantido).
- **Agendados** (`before_event` / `after_event` com `delay_minutes`): **job repetível do BullMQ** (a cada minuto) que varre eventos elegíveis dentro das janelas de tolerância (2h / 24h) e enfileira na outbox. Substitui `check-scheduled-automations`.
- **Entregável:** mudança de status dispara automação; agendados disparam pelo BullMQ sem nenhum cron no banco.

### Implementação 9 — IA (Gemini)
**Objetivo:** funcionalidades de IA migradas das Edge Functions para o Nest.
- `POST /ai/email-style`: Gemini gera HTML de e-mail responsivo em 4 estilos (profissional, minimalista, elegante, acolhedor).
- `POST /ai/landing-chat` (**SSE/streaming**): chat que edita a landing (reordenar/ativar seções, cores, conteúdo). Resposta em streaming para o front consumir token a token.
- `GeminiProvider` isolado em `integrations` (chave em env do backend).
- **Entregável:** geração de e-mail e chat de landing funcionando como endpoints do backend.

### Implementação 10 — Cancelamento, exclusão e duplicação
**Objetivo:** operações de ciclo de vida do evento (ex-Edge Function `cancel-event`).
- `POST /events/:id/cancel` com toggle "notificar participantes": muda status e, se ligado, enfileira notificação (WhatsApp + e-mail) para approved/pending/waitlist via outbox.
- Exclusão em cascata (automações, logs, templates, inscrições, campos, landing) — via relações `onDelete: Cascade` no Prisma.
- Duplicação de evento (copia evento com novo slug, form fields e templates; nasce em `draft`).
- **Entregável:** cancelar/excluir/duplicar funcionando com as devidas notificações e cascatas.

### Implementação 11 — Observabilidade, segurança e hardening
**Objetivo:** deixar pronto para produção.
- `message_logs` completo (status, erro, conteúdo) + endpoint de histórico; tempo real via SSE do backend (substitui Realtime do Supabase).
- Rate limiting de API (throttler), CORS, headers de segurança (helmet).
- Tratamento consistente de erros + correlação de requests (request-id).
- Logs estruturados; alertas para: instancia Evolution desconectada, dead-letter crescendo, fila atrasada.
- Cobertura de testes nas regras críticas (dedup, transições de funil, retry/dead-letter da fila).
- **Entregável:** dashboards de saúde + alertas + suíte de testes verde.

### Implementação 12 — Deploy
**Objetivo:** rodar em produção desacoplado do Supabase no que for possível.
- Containerizar (Dockerfile multi-stage).
- Redis gerenciado; aplicar migrations no deploy (`prisma migrate deploy`).
- Variáveis de ambiente segregadas por ambiente; segredos em secret manager.
- **Entregável:** API + workers em produção, consumindo a outbox e enviando pelos dois canais.

---

## 5. Estratégia de saída do Supabase (futuro)

Quando quiser sair do Supabase, o caminho fica curto **se as fases acima forem seguidas**:
1. **Banco:** apontar `DATABASE_URL` para o novo PostgreSQL e rodar as migrations Prisma. Migrar os dados (dump/restore).
2. **Auth:** trocar o adapter de `AuthPort` (ex.: para Auth próprio, Keycloak, Clerk, etc.) — o resto do código não muda.
3. **Storage:** trocar o adapter de `StoragePort` (ex.: S3/R2) e migrar os arquivos dos buckets.

Nenhuma dessas trocas exige reescrever a lógica de negócio, porque ela nunca dependeu de recursos proprietários do Supabase.
