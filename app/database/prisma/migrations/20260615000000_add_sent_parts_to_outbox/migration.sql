-- Adiciona contador de partes enviadas (split \n\n no envio WhatsApp).
-- Aplicado manualmente via `prisma db execute` por causa de drift no histórico
-- (evitar `migrate reset` que apagaria dados do Supabase).
ALTER TABLE "ATZ_SED"."outbox_messages"
  ADD COLUMN "sent_parts" INTEGER NOT NULL DEFAULT 0;
