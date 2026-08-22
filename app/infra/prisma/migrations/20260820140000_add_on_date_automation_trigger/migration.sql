-- Gatilho de data fixa: dispara UMA vez, no instante marcado na regra, para os
-- inscritos aprovados naquele momento. Diferente de `recurring` (cron, repete)
-- e do futuro `on_date_field` (data por inscrito, vinda do formulário).

ALTER TYPE "SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'on_date';

-- send_at é o instante em UTC; a coluna `timezone` que já existe guarda o fuso
-- em que o usuário marcou (default America/Sao_Paulo), para a UI mostrar de volta.
ALTER TABLE "SED"."automation_rules" ADD COLUMN IF NOT EXISTS "send_at" TIMESTAMPTZ;

-- fired_at é o claim do sweeper: UPDATE ... WHERE fired_at IS NULL garante que
-- duas réplicas do backend não disparem a mesma regra.
ALTER TABLE "SED"."automation_rules" ADD COLUMN IF NOT EXISTS "fired_at" TIMESTAMPTZ;
