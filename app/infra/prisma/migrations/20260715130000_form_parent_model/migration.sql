-- Form: parent metadata table (description + post_registration_message) per
-- event+kind scope. Replaces the same two fields living directly on Event,
-- and becomes the new owner of FormField (via form_id instead of
-- event_id+kind).

-- CreateTable
CREATE TABLE "ATZ_SED"."forms" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "kind" "ATZ_SED"."FormFieldKind" NOT NULL DEFAULT 'registration',
    "description" TEXT,
    "post_registration_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forms_event_id_kind_key" ON "ATZ_SED"."forms"("event_id", "kind");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."forms" ADD CONSTRAINT "forms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one forms row per (event_id, kind) distinct combination already present in form_fields.
INSERT INTO "ATZ_SED"."forms" ("id", "event_id", "kind", "created_at", "updated_at")
SELECT gen_random_uuid()::text, ff."event_id", ff."kind", now(), now()
FROM (SELECT DISTINCT "event_id", "kind" FROM "ATZ_SED"."form_fields") ff;

-- Backfill: guarantee a 'registration' forms row for every event (even one with
-- no form_fields rows yet), carrying description/post_registration_message
-- forward from the Event columns being retired below.
INSERT INTO "ATZ_SED"."forms" ("id", "event_id", "kind", "description", "post_registration_message", "created_at", "updated_at")
SELECT gen_random_uuid()::text, e."id", 'registration', e."description", e."post_registration_message", now(), now()
FROM "ATZ_SED"."events" e
WHERE NOT EXISTS (
    SELECT 1 FROM "ATZ_SED"."forms" f WHERE f."event_id" = e."id" AND f."kind" = 'registration'
);

-- Populate description/post_registration_message on 'registration' forms rows
-- that were created from the form_fields backfill above (not yet carrying them).
UPDATE "ATZ_SED"."forms" f
SET "description" = e."description", "post_registration_message" = e."post_registration_message"
FROM "ATZ_SED"."events" e
WHERE f."event_id" = e."id" AND f."kind" = 'registration' AND f."description" IS NULL AND f."post_registration_message" IS NULL;

-- AlterTable: form_fields gains form_id
ALTER TABLE "ATZ_SED"."form_fields" ADD COLUMN "form_id" TEXT;

UPDATE "ATZ_SED"."form_fields" ff
SET "form_id" = f."id"
FROM "ATZ_SED"."forms" f
WHERE f."event_id" = ff."event_id" AND f."kind" = ff."kind";

ALTER TABLE "ATZ_SED"."form_fields" ALTER COLUMN "form_id" SET NOT NULL;

-- DropForeignKey / DropIndex: drop the event_id+kind based objects being replaced
ALTER TABLE "ATZ_SED"."form_fields" DROP CONSTRAINT "form_fields_event_id_fkey";
DROP INDEX "ATZ_SED"."form_fields_event_id_kind_idx";

-- AlterTable: form_fields drops event_id/kind (now reachable via form_id -> forms.event_id/kind)
ALTER TABLE "ATZ_SED"."form_fields" DROP COLUMN "event_id";
ALTER TABLE "ATZ_SED"."form_fields" DROP COLUMN "kind";

-- CreateIndex
CREATE INDEX "form_fields_form_id_idx" ON "ATZ_SED"."form_fields"("form_id");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "ATZ_SED"."forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: events loses description/post_registration_message (moved to Form)
ALTER TABLE "ATZ_SED"."events" DROP COLUMN "description";
ALTER TABLE "ATZ_SED"."events" DROP COLUMN "post_registration_message";
