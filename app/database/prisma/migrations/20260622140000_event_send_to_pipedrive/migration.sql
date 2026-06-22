-- Event-level default for the Pipedrive webhook. The public registration form
-- reads this flag (via GET /public/events/:slug) and sends it on submission.

-- AlterTable
ALTER TABLE "ATZ_SED"."events"
  ADD COLUMN "send_to_pipedrive" BOOLEAN NOT NULL DEFAULT false;
