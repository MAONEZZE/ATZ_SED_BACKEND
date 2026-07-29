-- Troca do provedor de WhatsApp: Evolution API -> Uazapi.
-- A Uazapi identifica cada instância por um token próprio (header `token`), então
-- cada instância passa a guardar seu token no banco. Renomeia tabela/colunas/constraints
-- de evolution_* para uazapi_* e adiciona a coluna token.

-- Renomeia a tabela e seus objetos (PK + índice único de name)
ALTER TABLE "ATZ_SED"."evolution_instances" RENAME TO "uazapi_instances";
ALTER TABLE "ATZ_SED"."uazapi_instances" RENAME CONSTRAINT "evolution_instances_pkey" TO "uazapi_instances_pkey";
ALTER INDEX "ATZ_SED"."evolution_instances_name_key" RENAME TO "uazapi_instances_name_key";

-- Token Uazapi por instância (preenchido via UPDATE após a migração)
ALTER TABLE "ATZ_SED"."uazapi_instances" ADD COLUMN IF NOT EXISTS "token" TEXT;

-- Renomeia as colunas do evento
ALTER TABLE "ATZ_SED"."events" RENAME COLUMN "evolution_instance_id" TO "uazapi_instance_id";
ALTER TABLE "ATZ_SED"."events" RENAME COLUMN "evolution_token" TO "uazapi_token";

-- Renomeia FK e índice para bater com o novo nome da coluna
ALTER TABLE "ATZ_SED"."events" RENAME CONSTRAINT "events_evolution_instance_id_fkey" TO "events_uazapi_instance_id_fkey";
ALTER INDEX "ATZ_SED"."events_evolution_instance_id_idx" RENAME TO "events_uazapi_instance_id_idx";
