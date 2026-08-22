-- Fecha o drift entre as 56 migrations e o schema.prisma:
-- pipedrive sai de events/registrations e passa para forms/form_responses (commit 5ebc010),
-- send_at/fired_at viram timestamp(3), e ajustes de default/indice.


-- DropIndex
DROP INDEX "SED"."events_last_edited_by_idx";

-- AlterTable
ALTER TABLE "SED"."automation_rules" ALTER COLUMN "send_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "fired_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SED"."events" DROP COLUMN "send_to_pipedrive";

-- AlterTable
ALTER TABLE "SED"."folders" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SED"."form_responses" ADD COLUMN     "pipedrive_status" "SED"."PipedriveStatus",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SED"."forms" ADD COLUMN     "send_to_pipedrive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SED"."registrations" DROP COLUMN "pipedrive_status";

