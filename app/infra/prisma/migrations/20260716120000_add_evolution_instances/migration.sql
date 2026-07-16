-- CreateTable
CREATE TABLE "ATZ_SED"."evolution_instances" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evolution_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evolution_instances_name_key" ON "ATZ_SED"."evolution_instances"("name");

-- Seed: 7 known Evolution API instances.
INSERT INTO "ATZ_SED"."evolution_instances" ("id", "name", "nickname", "created_at", "updated_at") VALUES
    (gen_random_uuid()::text, 'wpp_jacob', 'Telefone do Jacob', now(), now()),
    (gen_random_uuid()::text, 'wpp_let', 'Telefone da Letícia', now(), now()),
    (gen_random_uuid()::text, 'wpp_kelly', 'Telefone da Kelly', now(), now()),
    (gen_random_uuid()::text, 'wpp_jonny', 'Telefone do Jonathan', now(), now()),
    (gen_random_uuid()::text, 'wpp_alex', 'Telefone do Alex', now(), now()),
    (gen_random_uuid()::text, 'wpp_mari', 'Telefone da Mariana', now(), now()),
    (gen_random_uuid()::text, 'wpp_atlaz', 'Telefone da Carol', now(), now())
ON CONFLICT ("name") DO NOTHING;
