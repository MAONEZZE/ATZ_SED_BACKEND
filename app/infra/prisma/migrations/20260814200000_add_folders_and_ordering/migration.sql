-- Pastas de organização dos eventos no painel, aninháveis, mais a ordem manual
-- (drag & drop) de pastas e eventos.
--
-- Aditivo: nenhuma coluna existente muda de tipo ou de nulabilidade.
-- Deletar pasta NÃO deleta evento — events.folder_id é ON DELETE SET NULL. As
-- subpastas têm SET NULL na FK (viram raiz); a promoção para o pai é feita pelo
-- repositório dentro da transação de delete.

CREATE TABLE IF NOT EXISTS "SED"."folders" (
  "id"         TEXT NOT NULL,
  "owner_id"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "parent_id"  TEXT,
  "order"      INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "folders_owner_id_idx" ON "SED"."folders"("owner_id");
CREATE INDEX IF NOT EXISTS "folders_parent_id_idx" ON "SED"."folders"("parent_id");

ALTER TABLE "SED"."folders"
  DROP CONSTRAINT IF EXISTS "folders_owner_id_fkey",
  ADD CONSTRAINT "folders_owner_id_fkey" FOREIGN KEY ("owner_id")
    REFERENCES "SED"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SED"."folders"
  DROP CONSTRAINT IF EXISTS "folders_parent_id_fkey",
  ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id")
    REFERENCES "SED"."folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SED"."events"
  ADD COLUMN IF NOT EXISTS "folder_id" TEXT,
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "events_folder_id_idx" ON "SED"."events"("folder_id");

ALTER TABLE "SED"."events"
  DROP CONSTRAINT IF EXISTS "events_folder_id_fkey",
  ADD CONSTRAINT "events_folder_id_fkey" FOREIGN KEY ("folder_id")
    REFERENCES "SED"."folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
