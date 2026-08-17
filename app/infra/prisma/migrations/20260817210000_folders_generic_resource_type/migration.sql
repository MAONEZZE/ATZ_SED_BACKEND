-- Folder deixa de organizar só evento: passa a organizar também template de
-- mensagem e regra de automação. Duas colunas novas em folders resolvem isso:
--
--   * resource_type -> discriminador. Uma pasta serve a UM tipo de registro,
--     não existe pasta mista. Default 'event', então as pastas que já existem
--     continuam pastas de evento sem precisar de backfill explícito.
--   * event_id (nullable) -> segundo eixo de escopo. NULL = pasta do painel do
--     dono (o comportamento de hoje, filtrado por owner_id). Preenchido = a
--     pasta vive DENTRO do evento e acompanha o evento no compartilhamento, em
--     vez de ficar presa ao perfil que a criou. CASCADE: apagar o evento apaga
--     as pastas que moram nele, e os recursos dentro delas sobrevivem porque a
--     FK folder_id deles é SET NULL.
--
-- owner_id continua NOT NULL e passa a significar só "quem criou". Quem
-- autoriza escrita numa pasta de evento é o papel no evento, não o owner_id.
--
-- message_templates e automation_rules ganham folder_id + "order" no mesmo
-- desenho já usado em events (FK SET NULL, order default 0).
--
-- Aditivo: nenhuma coluna existente muda de tipo ou de nulabilidade, e nenhuma
-- linha existente muda de significado (toda pasta atual = event / painel).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FolderResourceType' AND n.nspname = 'SED'
  ) THEN
    CREATE TYPE "SED"."FolderResourceType" AS ENUM ('event', 'message_template', 'automation_rule');
  END IF;
END $$;

ALTER TABLE "SED"."folders"
  ADD COLUMN IF NOT EXISTS "resource_type" "SED"."FolderResourceType" NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS "event_id" TEXT;

CREATE INDEX IF NOT EXISTS "folders_event_id_idx" ON "SED"."folders"("event_id");
CREATE INDEX IF NOT EXISTS "folders_owner_id_resource_type_idx" ON "SED"."folders"("owner_id", "resource_type");

ALTER TABLE "SED"."folders" DROP CONSTRAINT IF EXISTS "folders_event_id_fkey";
ALTER TABLE "SED"."folders" ADD CONSTRAINT "folders_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "SED"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nulabilidade de event_id por tipo. É regra de produto, mas é barata de
-- garantir aqui e evita pasta impossível entrando por SQL manual:
--   event            -> pasta do painel, event_id sempre NULL
--   automation_rule  -> regra só existe dentro de evento, event_id obrigatório
--   message_template -> os dois casos (template global x template do evento)
ALTER TABLE "SED"."folders" DROP CONSTRAINT IF EXISTS "folders_event_scope_check";
ALTER TABLE "SED"."folders" ADD CONSTRAINT "folders_event_scope_check" CHECK (
     ("resource_type" = 'event'           AND "event_id" IS NULL)
  OR ("resource_type" = 'automation_rule' AND "event_id" IS NOT NULL)
  OR  "resource_type" = 'message_template'
);

-- Templates de mensagem viram pastáveis e ordenáveis.
ALTER TABLE "SED"."message_templates"
  ADD COLUMN IF NOT EXISTS "folder_id" TEXT,
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "message_templates_folder_id_idx" ON "SED"."message_templates"("folder_id");

ALTER TABLE "SED"."message_templates" DROP CONSTRAINT IF EXISTS "message_templates_folder_id_fkey";
ALTER TABLE "SED"."message_templates" ADD CONSTRAINT "message_templates_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "SED"."folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras de automação idem.
ALTER TABLE "SED"."automation_rules"
  ADD COLUMN IF NOT EXISTS "folder_id" TEXT,
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "automation_rules_folder_id_idx" ON "SED"."automation_rules"("folder_id");

ALTER TABLE "SED"."automation_rules" DROP CONSTRAINT IF EXISTS "automation_rules_folder_id_fkey";
ALTER TABLE "SED"."automation_rules" ADD CONSTRAINT "automation_rules_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "SED"."folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
