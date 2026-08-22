-- Correção da migration 20260817160000: o unique `(event_id, kind)` foi criado
-- pelo Prisma como ÍNDICE, então o `DROP CONSTRAINT IF EXISTS` de lá não removeu
-- nada (silenciosamente). Como `forms.kind` ainda tinha DEFAULT 'registration',
-- todo formulário novo nascia com kind='registration' e colidia com o formulário
-- de inscrição do evento — criar o segundo formulário falhava com P2002.

DROP INDEX IF EXISTS "SED"."forms_event_id_kind_key";

-- A coluna vira puramente legada: sem default, novas linhas ficam com NULL.
ALTER TABLE "SED"."forms" ALTER COLUMN "kind" DROP DEFAULT;
