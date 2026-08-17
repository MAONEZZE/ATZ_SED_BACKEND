-- Presença no evento: marcada no painel (em lote) ou pelo próprio inscrito na
-- página pública de check-in (QR na porta → informa o telefone).
--
-- Aditivo. `false` = não compareceu ou ainda não foi conferido — não existe
-- terceiro estado, por decisão de produto.

ALTER TABLE "SED"."registrations"
  ADD COLUMN IF NOT EXISTS "attended" BOOLEAN NOT NULL DEFAULT false;
