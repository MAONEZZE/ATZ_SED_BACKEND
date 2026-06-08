-- AlterTable
ALTER TABLE "ATZ_SED"."message_logs"
  ADD COLUMN "owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "ATZ_SED"."message_logs"
  ADD CONSTRAINT "message_logs_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "ATZ_SED"."profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "message_logs_owner_id_idx" ON "ATZ_SED"."message_logs"("owner_id");
