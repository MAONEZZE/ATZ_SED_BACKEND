-- AlterTable
ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD COLUMN "owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD CONSTRAINT "outbox_messages_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "ATZ_SED"."profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "outbox_messages_owner_id_idx" ON "ATZ_SED"."outbox_messages"("owner_id");
