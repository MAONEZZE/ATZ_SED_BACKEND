-- Config de invite (.ics) enviada no payload do envio manual e persistida para
-- o worker assíncrono gerar o convite (date/startTime/endTime/timezone/recurrence).
-- Null = comportamento atual (deriva do Event ou convite único).

-- AlterTable
ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD COLUMN "invite_config" JSONB;
