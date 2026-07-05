# Refatoração e Limpeza Profunda — ATZ_SED_BACKEND

## Contexto

O backend (NestJS 11 + Prisma 6, layered-DDD em `app/{api,services,domain,database}`, um "módulo" por domínio) cresceu de forma inconsistente. O padrão-alvo de camadas — **Controller → Service → Repository → Prisma**, com Entity de domínio só onde há regra de negócio — está aplicado por completo apenas no módulo **Events**. Os demais têm dívidas:

- **11 de 15 controllers injetam `PrismaService` direto** (ex.: `automations.controller.ts:33,50`), pulando service/repo.
- Domínios `automations`, `users` e `messaging` **não têm entities** (pastas `domain/*/entities` vazias).
- **Duplicação**: 3 CSV builders com o mesmo esqueleto; 4 repositórios reimplementam `map()`/`buildWhere()`.
- **Lixo estrutural**: `database/automations/`, `database/users/`, `services/users/` só têm `.gitkeep`; ~40 `.gitkeep` vestigiais em pastas já populadas.
- **Quebrado**: `db:seed` aponta pra `scripts/seed.ts` inexistente; `API_CONTRACTS.md` lista enums já removidos pela migration `reduce_funnel_and_triggers`.
- **API**: nomenclatura mista (singular/plural, `:id` vs `:eventId`), verbos-no-path (`/cancel`, `/send`, `/ensure`), redundância global-vs-escopo, export CSV via `/export`.
- **Testes**: 39 specs achatados em `tests/unit/`, `tests/integration` vazio, sem mutation testing.

**Resultado pretendido:** projeto uniforme (todo controller passa por service/repo), sem duplicação nem código morto, API coerente (breaking changes documentadas para o frontend), suíte de testes reorganizada por módulo + integração + mutação, e dependências sem vulnerabilidades.

## Decisões (aprovadas)

1. **Endpoints → redesign completo**: aplicar TODAS as mudanças de contrato; documentar cada uma como breaking change.
2. **Camadas → vertical-slice** (revisado após a Fase 2): layout migrado de layered (`api/services/domain/database`) para `app/modules/<dominio>` + `app/infra` + `app/shared` + `app/workers`. Fluxo controller→service→repository preservado; controller nunca toca Prisma; porta só p/ integração externa trocável (ver Princípios).
3. **Mutação → adicionar Stryker** (`@stryker-mutator/core` + `jest-runner`).

## Princípios transversais (todo código escrito)

1. **YAGNI — não escrever código à toa.** Antes de criar arquivo/classe/porta/entidade: isto é realmente necessário e agrega valor? CRUD anêmico sem regra de negócio **não** ganha entity/porta por simetria. Porta/adapter só onde há troca real de fornecedor (integrações externas).
2. **Fazer mais escrevendo menos — herança/polimorfismo.** Duplicação some via classes-base e métodos template, não copy-paste. Alvos: `PrismaRepositoryBase` (map/where/search/paginate) e `CsvBuilder` genérico (polimórfico por configuração de colunas).

## Regras de execução (todas as fases)

- Branch `feat/limpeza_profunda` (a partir de `main` atualizado). ✅ criada.
- Commits pequenos, atômicos, Conventional Commits.
- Nada destrutivo sem listar candidatos + evidência antes.
- Fim de cada fase: `npm run build` + `npm test` verdes. Não avançar quebrado.
- Ferramentas nativas: `npm`, `nest build`, `jest`, `eslint`, `npm audit`, `prisma`.
- ⚠️ `npm run lint` roda `eslint --fix` e pode mexer em arquivos alheios. Rodar lint só nos arquivos tocados / usar verificação sem `--fix`.

---

## FASE 0 — Setup ✅
- `git checkout -b feat/limpeza_profunda`.
- Levantamento de estrutura e stack concluído.

## FASE 1 — Diagnóstico e plano ✅
- Este documento.

➡️ **GATE**: aguardar aprovação antes de qualquer mudança de código (Fase 2).

---

## FASE 2 — Refatoração (sequencial por etapa)

### 2.1 — Abstrações compartilhadas
- **`app/services/shared/csv-builder.ts`** — builder genérico (BOM + `escapeCell` + headers fixos/dinâmicos + `answerToString`). Substitui `registrations-csv.ts`, `post-event-responses-csv.ts`, `user-subscriptions-csv.ts`. `csv-utils.ts` fica como helpers de célula.
- **`app/database/shared/prisma-repository.base.ts`** — classe base com `map()` abstrato + `buildContainsSearch(fields, term)` (o `OR contains insensitive` repetido em `prisma-registration.repository.ts` e `prisma-user-subscription.repository.ts`).

### 2.2 — Tirar Prisma dos controllers (híbrido pragmático)
**Objetivo:** nenhum controller toca Prisma direto — acesso a dados via **service → repository (classe Prisma, sem interface)**. Criar entity/porta só onde há regra de negócio real.

**Regras de decisão:**
- **Repositório** = classe injetável que encapsula queries Prisma; **sem porta/interface** para domínio interno (1 impl). Herda de `PrismaRepositoryBase`.
- **Porta/adapter** só para integrações externas trocáveis: `AuthPort`/`StoragePort` (Supabase), e-mail (Resend), WhatsApp (Evolution), CRM (Pipedrive).
- **Entity** só se carrega comportamento (ex.: `event.entity.ts`). CRUD anêmico usa o tipo do Prisma.

| Módulo | Controllers com Prisma | Ação mínima |
|---|---|---|
| automations | `automations.controller.ts` | `automations.repository.ts` + service; controller chama service. Sem entity/porta. |
| messaging | `messaging.controller.ts`, `global-messaging.controller.ts` | queries de templates/logs → `templates.service`+repo, `message-logs.service`+repo; extrair DTOs inline de `global-messaging`. |
| users | `profile.controller.ts`, `whatsapp.controller.ts` | `profile.service` + `profile.repository`; whatsapp via adapter Evolution. |
| registrations | `registrations.controller.ts`, `user-subscriptions.controller.ts`, `post-event-responses.controller.ts` | usar services/repos existentes; mover queries restantes; simplificar portas que não agregam. |
| events | `form-fields.controller.ts` | `form-fields.service` + repo. |
| public | `public-events`, `public-nps`, `public-post-event` controllers | rotear via services existentes. |

- **Portas de repo existentes** (`EventRepositoryPort`, `RegistrationRepositoryPort`, `OutboxRepositoryPort`, `UserSubscriptionRepositoryPort`): avaliar 1 a 1; colapsar em classe direta se só têm impl Prisma e nenhum ganho. Manter só onde um mock de teste já depende da interface.
- Um commit por módulo; build+test verdes antes do próximo.

### 2.3 — Consistência estrutural
Padronizar layout: todos os módulos com `<modulo>_routes/` + `<modulo>_dto/` (hoje `messaging`, `public`, `global-messaging` são flat).

### 2.4 — Redesign de endpoints (BREAKING — aplicar todos)
Atualizar Swagger e `API_CONTRACTS.md`. Um commit por grupo.

| # | Antes | Depois | Motivo |
|---|---|---|---|
| 1 | `:id` em rotas aninhadas (collaborators) | `:eventId` p/ evento, `:id` p/ recurso alvo | param self-documenting |
| 2 | `POST /events/:id/cancel` | `PATCH /events/:id/status {status:'cancelled', notifyParticipants}` | transição de estado = PATCH |
| 3 | `POST /messaging/send` | `POST /messages` | verbo redundante no path |
| 4 | `POST /profile/ensure` | `POST /profile` (upsert idempotente, 200/201) | verbo-ação → recurso |
| 5 | `GET .../registrations/export` (+ post-event, user-subscriptions) | `GET .../registrations?format=csv` | export = variação da listagem |
| 6 | `GET /events/:eventId/messaging/logs[/stream]` | `GET /events/:eventId/message-logs[/stream]` | achatar aninhamento |
| 7 | `/public/events/:slug/post-event-fields` | `/public/events/:slug/post-event/form-fields` | consistência |
| 8 | `/public/events/:slug/nps-fields` | `/public/events/:slug/nps/form-fields` | consistência |
| 9 | `POST /public/events/:slug/nps` | `POST /public/events/:slug/nps/responses` | substantivo de recurso |
| 10 | `POST /public/events/:slug/post-event` | `POST /public/events/:slug/post-event/responses` | substantivo de recurso |
| 11 | plural/singular misto | coleções sempre plural; `/profile/me` e `/whatsapp/groups` mantidos | REST |
| 12 | global `GET /automations`, `GET /messaging/logs` | mantidos como agregados cross-event, documentados distintos | remover ambiguidade |

### 2.5 — Reorganização de testes
Mover os 39 specs → **`unit_test/<modulo>/<coisa>.spec.ts`** (events, registrations, messaging, automations, users, public, shared/config). Criar `integration_test/` e `mutation_test/`. Atualizar jest config (`roots`/`testMatch`), globs de `format`/`lint`, imports; specs refletem novos contratos.

### 2.6 — Fix do `db:seed`
Criar `scripts/seed.ts` mínimo **ou** remover o script se seed não é usado (confirmar).

---

## FASE 3 — Limpeza e segurança (nesta ordem)
1. **Dirs vazios / `.gitkeep`**: listar candidatos + evidência; remover `.gitkeep` de pastas populadas e apagar dirs órfãos remanescentes.
2. **Código/imports/arquivos mortos**: eslint (`no-unused-vars` já é erro) + busca de referências; lista com evidência antes de remover.
3. **Auditoria de dependências**: `npm audit`; atualizar p/ versão compatível sem vuln; breaking → lista separada p/ decisão manual; reauditar.
4. **Stryker**: `npm i -D @stryker-mutator/core @stryker-mutator/jest-runner` + `stryker.conf.json` apontando p/ `mutation_test/`.

---

## Verificação (end-to-end)
- `npm run build` limpo.
- `npm test` verde na nova estrutura.
- `npx stryker run` roda (baseline).
- `npm audit` limpo (ou só itens listados p/ decisão manual).
- Swagger `/docs` (dev) + `API_CONTRACTS.md` refletem os novos contratos.
- Smoke: `npm run dev`, exercer 1 rota por módulo com JWT.

## Entrega final
- Resumo por fase.
- **Lista de breaking changes de API** (tabela 2.4) para o frontend.
- Estado de build / testes / mutação / `npm audit`.
- Itens de decisão manual: updates com breaking change, `db:seed`, remoções ambíguas.
