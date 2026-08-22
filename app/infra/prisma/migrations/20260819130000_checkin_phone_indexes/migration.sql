-- Índices do check-in público por telefone (`POST /public/checkin`).
--
-- A consulta do check-in não tem evento no caminho: ela varre `registrations`
-- inteira procurando o telefone, em qualquer evento. Sem índice é seq scan a
-- cada pessoa que chega na porta.
--
-- A query (prisma-registration.repository.ts → findByPhoneWithEventDate):
--
--   SELECT ... FROM "SED".registrations r
--     JOIN "SED".events e ON e.id = r.event_id
--    WHERE e.event_date IS NOT NULL
--      AND right(regexp_replace(r.phone, '[^0-9]', '', 'g'), 8) = $1
--
-- Índice 1 — expressão idêntica à do WHERE, por igualdade. Tem que ser igualdade:
-- a primeira versão da query usava `LIKE '%' || $1`, e curinga à esquerda NÃO usa
-- índice b-tree (precisaria de pg_trgm/GIN, mais caro para o mesmo resultado).
-- `regexp_replace` e `right` são IMMUTABLE, então servem em índice.
-- Se a expressão do repositório mudar, este índice para de ser usado em silêncio.
CREATE INDEX IF NOT EXISTS "registrations_phone_digits_suffix_idx"
  ON "SED"."registrations" (right(regexp_replace("phone", '[^0-9]', '', 'g'), 8));

-- Índice 2 — o JOIN é por PK de `events`, mas `registrations.event_id` não tinha
-- índice próprio: o único índice existente é o composto (event_id, status), que
-- serve para este acesso só quando `event_id` é o prefixo — é o caso aqui, então
-- não se cria índice novo para o join. O que falta é a data: depois do corte por
-- telefone sobram poucas linhas, e o `event_date IS NOT NULL` é resolvido linha a
-- linha pela PK do evento. Índice parcial em `event_date` só ajudaria uma consulta
-- que varresse eventos por data — que não existe hoje. Deliberadamente não criado.

-- Sobre drift: índice de expressão não é representável no schema.prisma (o Prisma
-- não modela índice funcional), então ele vive só no banco. `prisma migrate diff`
-- pode acusá-lo como diferença; é esperado, não regenere o schema por causa disso.
