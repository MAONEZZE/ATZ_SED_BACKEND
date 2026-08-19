-- Limpeza da parte SEM DADO EM RISCO que sobrou da fatia de formulários N por
-- evento (2026-08-17). Metade da migration PENDENTE_20260817190000, que foi
-- dividida em duas: o drop de `user_subscriptions` (122 linhas) ficou de fora e
-- segue pendente em PENDENTE_20260817230000_drop_user_subscriptions, porque lá
-- existe perda de dado a decidir. Aqui não existe.
--
-- Auditoria conferida no banco em 2026-08-17, imediatamente antes de aplicar:
--   post_event_responses .. 0 linhas. As respostas vivem em form_responses.
--   forms.kind ............ 44 linhas preenchidas (registration 35,
--                           post_event 4, nps 5), nenhuma leitura no código:
--                           não está no schema.prisma e não aparece em nenhum
--                           .ts fora de comentário. Substituída por name/slug.
--                           O rastro de quem era o quê continua nos slugs
--                           `pos-evento` e `nps` dos formulários de backfill.
--   FormFieldKind ......... tipo sem nenhuma coluna usando.
--
-- O unique parcial (event_id, kind) já havia caído em drop_forms_kind_unique;
-- o DROP COLUMN leva qualquer índice remanescente junto.
--
-- IRREVERSÍVEL, mas sem perda de dado de negócio.

DROP TABLE IF EXISTS "SED"."post_event_responses";

ALTER TABLE "SED"."forms" DROP COLUMN IF EXISTS "kind";

-- Só depois de a coluna sair, senão o tipo ainda está em uso.
DROP TYPE IF EXISTS "SED"."FormFieldKind";
