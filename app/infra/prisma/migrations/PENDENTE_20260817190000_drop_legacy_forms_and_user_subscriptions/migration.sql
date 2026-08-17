-- ⚠️ NÃO APLICADA DE PROPÓSITO. Aplique só depois que o frontend estiver rodando
-- contra a API nova (formulários N por evento) e você confirmar que nada precisa
-- do formato antigo.
--
-- Para aplicar:
--   1. renomeie a pasta removendo o prefixo PENDENTE_
--   2. npx prisma db execute --file <arquivo> --url "$DIRECT_URL"
--   3. npx prisma migrate resolve --applied 20260817190000_drop_legacy_forms_and_user_subscriptions
--
-- Limpa o que ficou órfão na fatia de formulários (2026-08-17): já não existe
-- código lendo nada disso — o `schema.prisma` não declara mais esses objetos e as
-- únicas menções no código são comentários explicando de onde o campo veio.
--
-- Auditoria que sustenta o descarte (rodada em 2026-08-17 no LOCAL):
--   user_subscriptions .... 122 linhas, TODAS só com registration_answers.
--                           post_event_answers e nps_answers zeradas em 100% —
--                           era duplicação pura de registrations.answers.
--                           O único dado exclusivo era pipedrive_status, que
--                           mudou de casa para registrations.pipedrive_status.
--   post_event_responses .. 0 linhas (as respostas vivem em form_responses).
--   forms.kind ............ substituído por name/slug; mantido nullable e sem
--                           default desde a migration drop_forms_kind_unique.
--   FormFieldKind ......... tipo sem nenhuma coluna usando.
--
-- IRREVERSÍVEL sem backup. Se quiser rede, antes de rodar:
--   pg_dump ... -t '"SED".user_subscriptions' > user_subscriptions.sql

DROP TABLE IF EXISTS "SED"."user_subscriptions";

DROP TABLE IF EXISTS "SED"."post_event_responses";

ALTER TABLE "SED"."forms" DROP COLUMN IF EXISTS "kind";

-- Só depois de a coluna sair, senão o tipo ainda está em uso.
DROP TYPE IF EXISTS "SED"."FormFieldKind";
