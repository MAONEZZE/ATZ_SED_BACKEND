-- Status de entrega WhatsApp via webhook Uazapi.
-- Guarda o id da mensagem no provedor e os marcos de entrega/leitura, permitindo
-- refletir o ciclo real (sent -> delivered -> read / failed) vindo do webhook.

ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD COLUMN IF NOT EXISTS "provider_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);

ALTER TABLE "ATZ_SED"."message_logs"
  ADD COLUMN IF NOT EXISTS "provider_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "outbox_messages_provider_message_id_idx" ON "ATZ_SED"."outbox_messages"("provider_message_id");
CREATE INDEX IF NOT EXISTS "message_logs_provider_message_id_idx" ON "ATZ_SED"."message_logs"("provider_message_id");
