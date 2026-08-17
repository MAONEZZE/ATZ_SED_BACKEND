-- Lista fixa de instâncias WhatsApp que cada perfil PODE usar (N por perfil).
-- Ninguém é dono de instância: isso é permissão de uso, ajustada só por SQL
-- direto (não existe rota de escrita).
--
-- ⚠️ Sem backfill de propósito: perfil sem linha aqui **não dispara WhatsApp**
-- (403). Para preservar o comportamento antigo (todos podendo usar todas), rode
-- o grant abaixo depois de aplicar esta migration:
--
--   INSERT INTO "SED"."profile_whatsapp_instances" ("profile_id", "instance_id")
--   SELECT p."id", w."id" FROM "SED"."profiles" p CROSS JOIN "SED"."whatsapp_instances" w
--   ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "SED"."profile_whatsapp_instances" (
  "profile_id"  TEXT NOT NULL,
  "instance_id" TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_whatsapp_instances_pkey" PRIMARY KEY ("profile_id", "instance_id")
);

CREATE INDEX IF NOT EXISTS "profile_whatsapp_instances_instance_id_idx"
  ON "SED"."profile_whatsapp_instances"("instance_id");

ALTER TABLE "SED"."profile_whatsapp_instances"
  DROP CONSTRAINT IF EXISTS "profile_whatsapp_instances_profile_id_fkey",
  ADD CONSTRAINT "profile_whatsapp_instances_profile_id_fkey" FOREIGN KEY ("profile_id")
    REFERENCES "SED"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SED"."profile_whatsapp_instances"
  DROP CONSTRAINT IF EXISTS "profile_whatsapp_instances_instance_id_fkey",
  ADD CONSTRAINT "profile_whatsapp_instances_instance_id_fkey" FOREIGN KEY ("instance_id")
    REFERENCES "SED"."whatsapp_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
