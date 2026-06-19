-- Track last editor: events.last_edited_by (FK -> profiles, SET NULL on delete)

-- AlterTable
ALTER TABLE "ATZ_SED"."events" ADD COLUMN "last_edited_by" TEXT;

-- CreateIndex
CREATE INDEX "events_last_edited_by_idx" ON "ATZ_SED"."events"("last_edited_by");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."events" ADD CONSTRAINT "events_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "ATZ_SED"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
