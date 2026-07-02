-- Event: período (endDate) e mensagem pós-inscrição
ALTER TABLE "ATZ_SED"."events"
  ADD COLUMN "end_date" TIMESTAMP(3),
  ADD COLUMN "post_registration_message" TEXT;

-- Outbox: dedupKey próprio + FKs nullable (suporte a envio manual / destinatários avulsos)
ALTER TABLE "ATZ_SED"."outbox_messages" ADD COLUMN "dedup_key" TEXT;

UPDATE "ATZ_SED"."outbox_messages"
  SET "dedup_key" = "registration_id" || ':' || "template_id" || ':' || "trigger";

ALTER TABLE "ATZ_SED"."outbox_messages" ALTER COLUMN "dedup_key" SET NOT NULL;

DROP INDEX "ATZ_SED"."outbox_messages_registration_id_template_id_trigger_key";

CREATE UNIQUE INDEX "outbox_messages_dedup_key_key" ON "ATZ_SED"."outbox_messages"("dedup_key");

ALTER TABLE "ATZ_SED"."outbox_messages" ALTER COLUMN "registration_id" DROP NOT NULL;
ALTER TABLE "ATZ_SED"."outbox_messages" ALTER COLUMN "template_id" DROP NOT NULL;

-- MessageLog: registration opcional (logs de envio manual avulso)
ALTER TABLE "ATZ_SED"."message_logs" ALTER COLUMN "registration_id" DROP NOT NULL;
