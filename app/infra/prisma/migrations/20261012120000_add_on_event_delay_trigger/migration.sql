-- Gatilho `on_event_delay`: dispara X tempo antes (eventDate) ou depois
-- (endDate ?? eventDate) do evento, acompanhando a data atual do evento.
--
-- ATENÇÃO: nada neste arquivo pode USAR o valor novo do enum (índice parcial,
-- UPDATE, DEFAULT). O Postgres recusa usar valor de enum criado na mesma
-- transação, e `prisma migrate deploy` roda cada migration numa transação. Os
-- índices que referenciam 'on_event_delay' ficam na migration seguinte.

ALTER TYPE "SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'on_event_delay';

DO $$ BEGIN
  CREATE TYPE "SED"."AutomationDelayDirection" AS ENUM ('before', 'after');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SED"."AutomationDelayUnit" AS ENUM ('minutes', 'hours', 'days');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "SED"."automation_rules"
  ADD COLUMN IF NOT EXISTS "delay_direction" "SED"."AutomationDelayDirection",
  ADD COLUMN IF NOT EXISTS "delay_value" INTEGER,
  ADD COLUMN IF NOT EXISTS "delay_unit" "SED"."AutomationDelayUnit",
  ADD COLUMN IF NOT EXISTS "fired_for_at" TIMESTAMPTZ(3);
