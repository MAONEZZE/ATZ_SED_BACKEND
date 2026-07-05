-- Logs/outbox de destinatários avulsos (registration_id NULL) eram invisíveis
-- no escopo do evento — adiciona event_id direto nas duas tabelas.

ALTER TABLE "ATZ_SED"."outbox_messages" ADD COLUMN "event_id" TEXT;
ALTER TABLE "ATZ_SED"."message_logs" ADD COLUMN "event_id" TEXT;

ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD CONSTRAINT "outbox_messages_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ATZ_SED"."message_logs"
  ADD CONSTRAINT "message_logs_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "outbox_messages_event_id_idx" ON "ATZ_SED"."outbox_messages"("event_id");
CREATE INDEX "message_logs_event_id_idx" ON "ATZ_SED"."message_logs"("event_id");

-- Backfill via inscrição
UPDATE "ATZ_SED"."outbox_messages" o
SET "event_id" = r."event_id"
FROM "ATZ_SED"."registrations" r
WHERE o."registration_id" = r."id" AND o."event_id" IS NULL;

UPDATE "ATZ_SED"."message_logs" ml
SET "event_id" = r."event_id"
FROM "ATZ_SED"."registrations" r
WHERE ml."registration_id" = r."id" AND ml."event_id" IS NULL;

-- Backfill manual: event_id embutido no dedup_key (manual:<eventId>:<target>:<hash>)
UPDATE "ATZ_SED"."outbox_messages" o
SET "event_id" = split_part(o."dedup_key", ':', 2)
FROM "ATZ_SED"."events" e
WHERE o."event_id" IS NULL
  AND o."trigger" = 'manual'
  AND split_part(o."dedup_key", ':', 2) = e."id";

-- Backfill logs manuais: casa com outbox por destinatário + corpo renderizado
UPDATE "ATZ_SED"."message_logs" ml
SET "event_id" = o."event_id"
FROM "ATZ_SED"."outbox_messages" o
WHERE ml."event_id" IS NULL
  AND ml."registration_id" IS NULL
  AND o."event_id" IS NOT NULL
  AND ml."recipient" = o."recipient"
  AND ml."body" = o."rendered_body";
