-- registrations_event_phone_new_key indexava dígitos crus do telefone. Linha
-- sem telefone grava `phone: ''`, e `''` entra no índice como valor normal —
-- a segunda linha só-email do mesmo evento colidia em ('event_id', '') e
-- estourava 500 no import (Crítico 3).
--
-- Recriar na mesma transação para não abrir janela sem proteção de unicidade.
--
-- Dívida consciente: o índice chaveia por dígitos crus, e o app deduplica por
-- normalizePhone() (app/shared/handlers/phone.ts). '5511999998888' e
-- '11999998888' são distintos aqui e idênticos para o app. Fora de escopo
-- deste fix — resolve só o crash do valor vazio.
DROP INDEX IF EXISTS "SED"."registrations_event_phone_new_key";

CREATE UNIQUE INDEX IF NOT EXISTS "registrations_event_phone_new_key"
  ON "SED"."registrations" ("event_id", (regexp_replace("phone", '[^0-9]', '', 'g')))
  WHERE "created_at" >= '2026-08-17' AND regexp_replace("phone", '[^0-9]', '', 'g') <> '';
