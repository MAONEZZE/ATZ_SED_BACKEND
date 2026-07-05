-- Decouple message_templates from events: replace event_id with owner_id

-- 1. Add owner_id (nullable for backfill)
ALTER TABLE "ATZ_SED"."message_templates" ADD COLUMN "owner_id" TEXT;

-- 2. Backfill owner_id from the linked event
UPDATE "ATZ_SED"."message_templates" t
SET "owner_id" = e."owner_id"
FROM "ATZ_SED"."events" e
WHERE t."event_id" = e."id";

-- 3. Drop event linkage
ALTER TABLE "ATZ_SED"."message_templates" DROP CONSTRAINT "message_templates_event_id_fkey";
ALTER TABLE "ATZ_SED"."message_templates" DROP COLUMN "event_id";

-- 4. Enforce ownership
ALTER TABLE "ATZ_SED"."message_templates" ALTER COLUMN "owner_id" SET NOT NULL;

ALTER TABLE "ATZ_SED"."message_templates"
  ADD CONSTRAINT "message_templates_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "ATZ_SED"."profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "message_templates_owner_id_idx" ON "ATZ_SED"."message_templates"("owner_id");
