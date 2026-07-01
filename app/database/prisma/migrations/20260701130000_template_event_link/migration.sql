-- Vínculo opcional de template a evento. Nullable: template sem evento = global.
-- ON DELETE SET NULL: apagar o evento não apaga o template, só desvincula.

-- AlterTable
ALTER TABLE "ATZ_SED"."message_templates"
  ADD COLUMN "event_id" TEXT;

-- CreateIndex
CREATE INDEX "message_templates_event_id_idx" ON "ATZ_SED"."message_templates"("event_id");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."message_templates"
  ADD CONSTRAINT "message_templates_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
