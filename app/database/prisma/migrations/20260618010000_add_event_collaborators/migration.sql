-- Event collaborators: share an event with other registered users (total equality)

-- CreateTable
CREATE TABLE "ATZ_SED"."event_collaborators" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_collaborators_event_id_profile_id_key" ON "ATZ_SED"."event_collaborators"("event_id", "profile_id");

-- CreateIndex
CREATE INDEX "event_collaborators_profile_id_idx" ON "ATZ_SED"."event_collaborators"("profile_id");

-- AddForeignKey
ALTER TABLE "ATZ_SED"."event_collaborators" ADD CONSTRAINT "event_collaborators_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "ATZ_SED"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ATZ_SED"."event_collaborators" ADD CONSTRAINT "event_collaborators_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "ATZ_SED"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
