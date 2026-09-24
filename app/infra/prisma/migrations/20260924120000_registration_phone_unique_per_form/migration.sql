-- Sem dedup entre formulários: a mesma pessoa em dois formulários do evento
-- vira dois inscritos. O índice único passa de (evento, telefone) para
-- (evento, formulário de origem, telefone), mantendo o recorte por data e a
-- exclusão do telefone vazio da migration 20260915120000.
--
-- origin_form_id nulo (form apagado, ou inscrito sem form) não colide: NULL é
-- distinto no índice único. Usar COALESCE faria o delete de dois forms com o
-- mesmo telefone estourar a unicidade no SET NULL.
--
-- Recriar na mesma transação para não abrir janela sem proteção de unicidade.
DROP INDEX IF EXISTS "SED"."registrations_event_phone_new_key";

CREATE UNIQUE INDEX IF NOT EXISTS "registrations_event_phone_new_key"
  ON "SED"."registrations" ("event_id", "origin_form_id", (regexp_replace("phone", '[^0-9]', '', 'g')))
  WHERE "created_at" >= '2026-08-17 00:00:00+00'::timestamptz
    AND regexp_replace("phone", '[^0-9]', '', 'g') <> '';
