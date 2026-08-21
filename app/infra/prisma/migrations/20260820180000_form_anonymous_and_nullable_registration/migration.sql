-- Formulários anônimos (pesquisa/voto sem telefone/e-mail). Ver
-- docs/plans/2026-08-20-formularios-anonimos.md.
-- registration_id vira nullable: resposta anônima não pendura em Registration.
-- O unique (form_id, registration_id) não muda — Postgres trata NULL como
-- NULLS DISTINCT por padrão, então múltiplas respostas anônimas (NULL) nunca colidem.
ALTER TABLE "SED"."forms"
  ADD COLUMN "anonymous" boolean NOT NULL DEFAULT false;

ALTER TABLE "SED"."form_responses"
  ALTER COLUMN "registration_id" DROP NOT NULL;
