-- Gatilho `on_date_form_field`: recorrência MENSAL por dia-do-mês. O DIA vem da
-- resposta de um campo tipo `on_date_automation_field`; a HORA vem da regra
-- (`send_time` + a coluna `timezone` que já existe). Mês e ano da resposta são
-- ignorados: resposta 2026-10-20 => dia 20, todo mês.
-- Dia 29/30/31 em mês curto é limitado ao último dia do mês (clamp, no código).
--
-- Diferente de `on_date` (disparo único, mesmo instante para todos) e de
-- `recurring` (cron por regra, sem relação com o formulário).
--
-- ATENÇÃO: nada neste arquivo pode USAR os valores novos do enum (índice parcial,
-- UPDATE, DEFAULT). O Postgres recusa usar valor de enum criado na mesma
-- transação, e `prisma migrate deploy` roda cada migration numa transação.

ALTER TYPE "SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'on_date_form_field';
ALTER TYPE "SED"."FieldType"        ADD VALUE IF NOT EXISTS 'on_date_automation_field';

-- Hora do disparo mensal, "HH:mm", lida no `timezone` da regra. NULL nos outros
-- gatilhos; o sweeper assume 09:00 se vier nulo.
ALTER TABLE "SED"."automation_rules" ADD COLUMN IF NOT EXISTS "send_time" TEXT;

-- Nome próprio da regra. NULL = a UI cai no nome do template, como hoje.
ALTER TABLE "SED"."automation_rules" ADD COLUMN IF NOT EXISTS "name" TEXT;
