-- Refatoração arquitetural: código para de expor o nome do fornecedor
-- (Uazapi) e passa a usar nomenclatura de domínio (WhatsApp), como já
-- documentado no plano. Renomeia tabela, colunas e os constraints/índices
-- que carregam o nome antigo, para não deixar nomenclatura mista no banco.

ALTER TABLE "ATZ_SED"."uazapi_instances" RENAME TO "whatsapp_instances";
ALTER TABLE "ATZ_SED"."whatsapp_instances" RENAME CONSTRAINT "uazapi_instances_pkey" TO "whatsapp_instances_pkey";
ALTER INDEX "ATZ_SED"."uazapi_instances_name_key" RENAME TO "whatsapp_instances_name_key";

ALTER TABLE "ATZ_SED"."events" RENAME COLUMN "uazapi_instance_id" TO "whatsapp_instance_id";
ALTER TABLE "ATZ_SED"."events" RENAME COLUMN "uazapi_token" TO "whatsapp_token";

ALTER TABLE "ATZ_SED"."events" RENAME CONSTRAINT "events_uazapi_instance_id_fkey" TO "events_whatsapp_instance_id_fkey";
ALTER INDEX "ATZ_SED"."events_uazapi_instance_id_idx" RENAME TO "events_whatsapp_instance_id_idx";
