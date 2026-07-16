-- AlterTable: events gains evolution_instance_id (FK to evolution_instances)
ALTER TABLE "ATZ_SED"."events" ADD COLUMN IF NOT EXISTS "evolution_instance_id" TEXT;

-- AddForeignKey
ALTER TABLE "ATZ_SED"."events" ADD CONSTRAINT "events_evolution_instance_id_fkey" FOREIGN KEY ("evolution_instance_id") REFERENCES "ATZ_SED"."evolution_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: events.evolution_instance (name) -> events.evolution_instance_id (FK)
UPDATE "ATZ_SED"."events" e
SET "evolution_instance_id" = i."id"
FROM "ATZ_SED"."evolution_instances" i
WHERE e."evolution_instance" = i."name";

-- CreateIndex
CREATE INDEX "events_evolution_instance_id_idx" ON "ATZ_SED"."events"("evolution_instance_id");

-- AlterTable: drop string instance columns (superseded by FK; owner no longer carries an instance)
ALTER TABLE "ATZ_SED"."events" DROP COLUMN "evolution_instance";
ALTER TABLE "ATZ_SED"."profiles" DROP COLUMN "evolution_instance";
