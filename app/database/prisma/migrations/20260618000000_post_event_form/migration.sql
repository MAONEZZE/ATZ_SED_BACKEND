-- Post-event form: FormFieldKind enum, form_fields.kind column, post_event_responses table

-- CreateEnum
CREATE TYPE "ATZ_SED"."FormFieldKind" AS ENUM ('registration', 'post_event');

-- AlterTable
ALTER TABLE "ATZ_SED"."form_fields" ADD COLUMN "kind" "ATZ_SED"."FormFieldKind" NOT NULL DEFAULT 'registration';

-- Replace index on form_fields
DROP INDEX "ATZ_SED"."form_fields_event_id_idx";
CREATE INDEX "form_fields_event_id_kind_idx" ON "ATZ_SED"."form_fields"("event_id", "kind");

-- CreateTable
CREATE TABLE "ATZ_SED"."post_event_responses" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_event_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_event_responses_registration_id_key" ON "ATZ_SED"."post_event_responses"("registration_id");

-- CreateIndex
CREATE INDEX "post_event_responses_event_id_idx" ON "ATZ_SED"."post_event_responses"("event_id");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."post_event_responses" ADD CONSTRAINT "post_event_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ATZ_SED"."post_event_responses" ADD CONSTRAINT "post_event_responses_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "ATZ_SED"."registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
